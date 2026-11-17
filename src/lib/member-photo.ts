import type { SupabaseClient } from '@supabase/supabase-js';
import { isBase64Image, normalizeImageSrc } from '@/lib/image-utils';

export const MEMBER_PHOTO_BUCKET = 'gym-assets';
export const MEMBER_PHOTO_FOLDER = 'member-photos';

/** Converts a data URI (or raw base64) into binary bytes + mime type. */
export function dataUrlToBytes(src: string): { bytes: Uint8Array; mime: string; ext: string } {
  const dataUrl = normalizeImageSrc(src) || src;
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
  if (!match) throw new Error('Not a data URL');
  const mime = match[1] || 'image/jpeg';
  const payload = match[3];
  const binary = match[2] ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : mime.includes('svg') ? 'svg' : 'jpg';
  return { bytes, mime, ext };
}

/**
 * If `photo` is a base64 image, uploads it to Supabase Storage and returns the public URL.
 * URLs and empty values are returned unchanged, so it is safe to call on every save.
 */
export async function ensureMemberPhotoUrl(
  supabase: SupabaseClient,
  photo: string | null | undefined,
  keyHint?: string | null
): Promise<string | null> {
  if (!photo || !photo.trim()) return null;
  if (!isBase64Image(photo) && !photo.trim().startsWith('data:')) return photo.trim();

  // Uploaded through our own API route: it checks the user is signed in, then writes
  // with the service role. Uploading straight from the browser was being rejected by
  // Storage RLS ("new row violates row-level security policy").
  void supabase;
  const res = await fetch('/api/member-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ photo: photo.trim(), keyHint: keyHint ?? undefined }),
  });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    // A redirect to the login page (expired session) comes back as HTML with no url.
    const reason = json.error || (res.redirected ? 'your login session has expired, please log in again' : `server error ${res.status}`);
    throw new Error(`Photo upload failed: ${reason}`);
  }
  return json.url;
}
