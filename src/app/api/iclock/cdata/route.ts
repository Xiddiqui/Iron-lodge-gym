/**
 * /api/iclock/cdata — ZKTeco K50 iClock Push Protocol Handler
 *
 * The K50 device is configured with your server's domain. It automatically
 * calls:
 *   GET  /iclock/cdata  → device handshake / option fetch
 *   POST /iclock/cdata  → attendance punch data (ATTLOG)
 *
 * Next.js rewrite in next.config.ts maps /iclock/* → /api/iclock/*
 *
 * The device identifies members by their "Pin" (User ID), which is mapped
 * to the member's member_number field in the database.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase admin client (bypasses RLS — only used server-side)
// ─────────────────────────────────────────────────────────────────────────────
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key || key === 'your_service_role_key') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured. Add the real key to .env.local');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /iclock/cdata  — Device registration / option handshake
// The K50 calls this first to negotiate settings with the server.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get('SN') || 'UNKNOWN';

  console.log(`[Biometric] Device handshake — SN: ${sn}`);

  // iClock option response — device settings
  // TimeZone=5 = UTC+5 (Pakistan Standard Time)
  // Realtime=1 = push punches immediately, don't batch
  const optionResponse = [
    `GET OPTION FROM: ${sn}`,
    'Stamp=9999',
    'OpStamp=0',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;14:05',
    'TransInterval=1',
    'TransFlag=1111000000',
    'TimeZone=5',
    'Realtime=1',
    'Encrypt=None',
  ].join('\n');

  return new Response(optionResponse, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /iclock/cdata  — Attendance punch data receiver
// Body format (tab-separated per line):
//   Pin  Date               Status  Verify  WorkCode  Reserved1  Reserved2
//   1001 2026-08-04 14:30:00 0      1       0         0          0
//
// Pin    = member_number (User ID enrolled on K50)
// Date   = punch datetime in device local time (PKT = UTC+5)
// Status = 0/255 = check-in, 1 = check-out
// Verify = 1 = fingerprint, 0 = PIN, 4 = card
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = (searchParams.get('table') || '').toUpperCase();
  const sn = searchParams.get('SN') || 'UNKNOWN';

  // Only process attendance logs; acknowledge all other table types
  if (table !== 'ATTLOG') {
    console.log(`[Biometric] Received table=${table} from SN=${sn} — acknowledged, no action`);
    return new Response('OK', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  let body = '';
  try {
    body = await request.text();
  } catch {
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }


  console.log(`[Biometric] ATTLOG from SN=${sn}:\n${body}`);

  let adminClient: ReturnType<typeof getAdminClient>;
  try {
    adminClient = getAdminClient();
  } catch (err: any) {
    console.error('[Biometric] Service role key not configured:', err.message);
    // Still return OK to the device so it doesn't retry forever
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  // Parse punch records — one per line, tab-separated
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: string[] = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const pin = parts[0]?.trim();       // member_number
    const dateStr = parts[1]?.trim();   // "YYYY-MM-DD HH:MM:SS"

    if (!pin || !dateStr) continue;

    try {
      const res = await processPunch({ adminClient, pin, dateStr });
      if (res?.reason) {
        results.push(`[Pin #${pin}]: ${res.reason}`);
      } else {
        results.push(`[Pin #${pin}]: Processed`);
      }
    } catch (err: any) {
      console.error(`[Biometric] Error processing punch for pin=${pin}:`, err);
      results.push(`[Pin #${pin} Error]: ${err.message}`);
    }
  }

  return new Response(`OK\n${results.join('\n')}`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// processPunch — Core business logic for a single fingerprint punch
// ─────────────────────────────────────────────────────────────────────────────
async function processPunch({
  adminClient,
  pin,
  dateStr,
}: {
  adminClient: ReturnType<typeof getAdminClient>;
  pin: string;
  dateStr: string;
}) {
  // Parse punch time — device sends in PKT (UTC+5), convert to UTC
  // "2026-08-04 14:30:00" → "2026-08-04T14:30:00+05:00" → UTC ISO string
  const pktDateStr = dateStr.replace(' ', 'T') + '+05:00';
  const punchTime = new Date(pktDateStr);

  if (isNaN(punchTime.getTime())) {
    console.warn(`[Biometric] Invalid date string: ${dateStr}`);
    return;
  }

  // Look up active member by member_number (pin)
  // Try exact match first
  let { data: member } = await adminClient
    .from('members')
    .select('id, full_name, photo_url, member_number')
    .eq('member_number', pin)
    .eq('active', true)
    .maybeSingle();

  // Fallback 1: Try integer equivalence (e.g. pin '1' matches member_number '0001' or '001')
  if (!member && !isNaN(Number(pin))) {
    const numPin = Number(pin).toString();
    const { data: allActiveMembers } = await adminClient
      .from('members')
      .select('id, full_name, photo_url, member_number')
      .eq('active', true);

    if (allActiveMembers) {
      member = allActiveMembers.find(
        (m: any) => m.member_number && Number(m.member_number) === Number(pin)
      ) || null;
    }
  }

  if (!member) {
    console.warn(`[Biometric] No active member found matching pin/member_number="${pin}"`);
    return { success: false, reason: `No active member with member_number="${pin}" found in database` };
  }

  // Determine the UTC date for this punch (used for "same day" dedup check)
  const punchDateUTC = punchTime.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const dayStart = `${punchDateUTC}T00:00:00.000Z`;
  const dayEnd = `${punchDateUTC}T23:59:59.999Z`;

  // Check for existing attendance on this UTC date
  const { data: existing } = await adminClient
    .from('attendance')
    .select('id, check_in')
    .eq('member_id', member.id)
    .gte('check_in', dayStart)
    .lte('check_in', dayEnd)
    .order('check_in', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Fetch member's current fee status
  const feeStatus = await getMemberFeeStatus(adminClient, member.id);

  if (existing) {
    // ── DUPLICATE SCAN ─────────────────────────────────────────────────────
    // Member already has attendance today — send warning notification
    console.log(`[Biometric] Duplicate scan for ${member.full_name} (already in at ${existing.check_in})`);

    await adminClient.from('biometric_notifications').insert({
      type: 'duplicate',
      member_id: member.id,
      member_name: member.full_name,
      member_photo_url: member.photo_url,
      member_number: member.member_number,
      fee_status: feeStatus.status,
      fee_amount_due: feeStatus.amountDue,
      check_in_time: punchTime.toISOString(),
      existing_check_in: existing.check_in,
    });
  } else {
    // ── NEW CHECK-IN ────────────────────────────────────────────────────────
    console.log(`[Biometric] New check-in for ${member.full_name} at ${punchTime.toISOString()}`);

    // Insert attendance record
    const { error: attErr } = await adminClient.from('attendance').insert({
      member_id: member.id,
      check_in: punchTime.toISOString(),
      source: 'biometric',
      // marked_by is null for biometric entries (no staff involved)
    });

    if (attErr) {
      if (attErr.code === '23505') {
        // Unique constraint — race condition duplicate, treat as duplicate notification
        console.warn(`[Biometric] Race condition duplicate for member ${member.id}`);
        await adminClient.from('biometric_notifications').insert({
          type: 'duplicate',
          member_id: member.id,
          member_name: member.full_name,
          member_photo_url: member.photo_url,
          member_number: member.member_number,
          fee_status: feeStatus.status,
          fee_amount_due: feeStatus.amountDue,
          check_in_time: punchTime.toISOString(),
          existing_check_in: null,
        });
      } else {
        throw attErr;
      }
      return;
    }

    // Send check-in notification for real-time popup on all clients
    await adminClient.from('biometric_notifications').insert({
      type: 'checkin',
      member_id: member.id,
      member_name: member.full_name,
      member_photo_url: member.photo_url,
      member_number: member.member_number,
      fee_status: feeStatus.status,
      fee_amount_due: feeStatus.amountDue,
      check_in_time: punchTime.toISOString(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMemberFeeStatus — Resolve member's current payment status
// ─────────────────────────────────────────────────────────────────────────────
async function getMemberFeeStatus(
  adminClient: ReturnType<typeof getAdminClient>,
  memberId: string
): Promise<{ status: 'paid' | 'due' | 'overdue'; amountDue: number }> {
  const { data: records } = await adminClient
    .from('fee_records')
    .select('paid, period_month, period_end, amount')
    .eq('member_id', memberId)
    .order('period_month', { ascending: false })
    .limit(1);

  const record = records?.[0];
  if (!record) return { status: 'due', amountDue: 0 };
  if (record.paid) return { status: 'paid', amountDue: 0 };

  const periodEnd = new Date(record.period_end);
  const today = new Date();

  if (periodEnd < today) {
    return { status: 'overdue', amountDue: Number(record.amount) };
  }

  return { status: 'due', amountDue: Number(record.amount) };
}
