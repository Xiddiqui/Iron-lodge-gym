#!/usr/bin/env node
/**
 * One-time migration: moves base64 photos stored in members.photo_url (and member_pending_edits)
 * into Supabase Storage (bucket "gym-assets", folder "member-photos") and replaces the column
 * value with the public URL.
 *
 * Usage (from the project root):
 *   node scripts/migrate-member-photos.mjs --dry-run   # report only, changes nothing
 *   node scripts/migrate-member-photos.mjs             # migrate
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (the real secret key).
 * Safe to re-run: rows that already hold a URL are skipped.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const DRY_RUN = process.argv.includes('--dry-run');
const BUCKET = 'gym-assets';
const FOLDER = 'member-photos';

const env = { ...process.env };
if (fs.existsSync('.env.local')) {
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || key.startsWith('your_')) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and a real SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const PREFIXES = [
  ['/9j/', 'image/jpeg'], ['iVBORw0KGgo', 'image/png'], ['R0lGOD', 'image/gif'],
  ['UklGR', 'image/webp'], ['PHN2Zw', 'image/svg+xml'], ['PD94bWw', 'image/svg+xml'],
];

function decodePhoto(raw) {
  const s = raw.trim();
  const m = s.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (m) {
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'binary');
    return { buf, mime: m[1] || 'image/jpeg' };
  }
  if (/^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('blob:')) return null; // already a URL/path
  const hit = PREFIXES.find(([p]) => s.startsWith(p));
  if (hit || (!s.includes(' ') && s.length > 50)) return { buf: Buffer.from(s, 'base64'), mime: hit ? hit[1] : 'image/jpeg' };
  return null;
}
const extFor = (mime) => (mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : mime.includes('svg') ? 'svg' : 'jpg');

async function ensureBucket() {
  const { data, error } = await sb.storage.getBucket(BUCKET);
  if (data) return;
  if (DRY_RUN) { console.log(`(bucket "${BUCKET}" does not exist; would be created)`); return; }
  const { error: cErr } = await sb.storage.createBucket(BUCKET, { public: true });
  if (cErr) throw new Error(`Could not create bucket: ${cErr.message} (${error?.message})`);
  console.log(`Created public bucket "${BUCKET}"`);
}

async function upload(buf, mime, keyHint) {
  const path = `${FOLDER}/${String(keyHint).replace(/[^a-zA-Z0-9_-]/g, '_')}.${extFor(mime)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(error.message);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function migrateMembers() {
  // Fetch only ids first (cheap), then each photo one at a time to keep memory/egress bounded.
  const ids = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('members').select('id, member_number, full_name')
      .not('photo_url', 'is', null).not('photo_url', 'like', 'http%').range(from, from + 999);
    if (error) throw error;
    ids.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`members: ${ids.length} rows with a non-URL photo`);
  let done = 0, skipped = 0, failed = 0;
  for (const m of ids) {
    const { data: row, error } = await sb.from('members').select('photo_url').eq('id', m.id).single();
    if (error) { failed++; console.error(`  ✗ ${m.full_name}: ${error.message}`); continue; }
    const decoded = row.photo_url ? decodePhoto(row.photo_url) : null;
    if (!decoded || decoded.buf.length === 0) { skipped++; continue; }
    const label = `${m.member_number ?? ''} ${m.full_name}`.trim();
    if (DRY_RUN) { done++; console.log(`  would upload ${label} (${Math.round(decoded.buf.length / 1024)} KB)`); continue; }
    try {
      const publicUrl = await upload(decoded.buf, decoded.mime, m.id);
      const { error: uErr } = await sb.from('members').update({ photo_url: publicUrl }).eq('id', m.id);
      if (uErr) throw new Error(uErr.message);
      done++;
      console.log(`  ✓ ${label}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${label}: ${e.message}`);
    }
  }
  console.log(`members: ${DRY_RUN ? 'would migrate' : 'migrated'} ${done}, skipped ${skipped}, failed ${failed}`);
}

async function migratePendingEdits() {
  const { data, error } = await sb.from('member_pending_edits').select('id, changes').eq('status', 'pending');
  if (error) { console.log(`member_pending_edits: skipped (${error.message})`); return; }
  let done = 0;
  for (const r of data) {
    const photo = r.changes?.photo_url;
    const decoded = typeof photo === 'string' ? decodePhoto(photo) : null;
    if (!decoded) continue;
    if (DRY_RUN) { done++; continue; }
    try {
      const publicUrl = await upload(decoded.buf, decoded.mime, `pending_${r.id}`);
      const { error: uErr } = await sb.from('member_pending_edits').update({ changes: { ...r.changes, photo_url: publicUrl } }).eq('id', r.id);
      if (uErr) throw new Error(uErr.message);
      done++;
    } catch (e) { console.error(`  ✗ pending edit ${r.id}: ${e.message}`); }
  }
  console.log(`member_pending_edits: ${DRY_RUN ? 'would migrate' : 'migrated'} ${done}`);
}

/**
 * Rewrites links that point at an OLD Supabase project's storage
 * (e.g. https://<old-ref>.supabase.co/storage/v1/object/public/Images/users/x.jpg)
 * to the same bucket/path on the current project. Assumes the storage folders were
 * copied to the new project with the same bucket name and paths.
 */
const currentOrigin = new URL(url).origin;
function rewriteLegacy(value) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value.trim());
    if (u.origin !== currentOrigin && u.hostname.endsWith('.supabase.co') && u.pathname.startsWith('/storage/v1/object/')) {
      return `${currentOrigin}${u.pathname}${u.search}`;
    }
  } catch { /* not a URL */ }
  return null;
}

async function rewriteLegacyLinks(table, column) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(`id, ${column}`)
      .like(column, 'http%supabase.co/storage/%').not(column, 'like', `${currentOrigin}%`).range(from, from + 999);
    if (error) { console.log(`${table}.${column}: skipped (${error.message})`); return; }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  let done = 0, failed = 0;
  for (const r of rows) {
    const next = rewriteLegacy(r[column]);
    if (!next) continue;
    if (DRY_RUN) { done++; if (done <= 3) console.log(`  ${r[column]}\n    -> ${next}`); continue; }
    const { error } = await sb.from(table).update({ [column]: next }).eq('id', r.id);
    if (error) { failed++; console.error(`  ✗ ${table} ${r.id}: ${error.message}`); } else done++;
  }
  console.log(`${table}.${column}: ${DRY_RUN ? 'would rewrite' : 'rewrote'} ${done} old-project links${failed ? `, failed ${failed}` : ''}`);
}

async function checkSampleExists() {
  // Confirms the copied files really exist on the new project before trusting the rewrite.
  const { data } = await sb.from('members').select('photo_url').like('photo_url', `${currentOrigin}/storage/%`).limit(1);
  const sample = data?.[0]?.photo_url;
  if (!sample) return;
  const res = await fetch(sample, { method: 'HEAD' });
  console.log(`sample image check: HTTP ${res.status} ${sample}`);
}

console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Project: ${new URL(url).host}`);
await ensureBucket();
await migrateMembers();
await migratePendingEdits();
await rewriteLegacyLinks('members', 'photo_url');
await rewriteLegacyLinks('profiles', 'photo_url');
await rewriteLegacyLinks('biometric_notifications', 'member_photo_url');
await rewriteLegacyLinks('inactive_member_notifications', 'member_photo_url');
await checkSampleExists();
