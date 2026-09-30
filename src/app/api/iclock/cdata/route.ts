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

  // Format current Pakistan Standard Time (PKT / UTC+5) for device RTC sync
  const now = new Date();
  const pktDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const pktDateTimeStr = pktDateFormatter.format(now).replace(', ', ' ').replace(',', ' ');

  // iClock option response — device settings
  // TimeZone=5 = UTC+5 (Pakistan Standard Time)
  // Realtime=1 = push punches immediately, don't batch
  // DateTime=YYYY-MM-DD HH:MM:SS = synchronizes device hardware clock
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
    `DateTime=${pktDateTimeStr}`,
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
  let punchTime = new Date(pktDateStr);

  if (isNaN(punchTime.getTime())) {
    console.warn(`[Biometric] Invalid date string: ${dateStr}`);
    return;
  }

  // Check for device RTC clock drift on live incoming punches:
  // If the device sent a timestamp for today (PKT date) but the time of day is drifted (> 15 mins),
  // the device's internal RTC is off (e.g. 1pm instead of 8pm). Use real current arrival time.
  const now = new Date();
  const pktTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(now); // "YYYY-MM-DD"
  const punchDateStr = dateStr.slice(0, 10);
  const driftMs = Math.abs(now.getTime() - punchTime.getTime());
  if (punchDateStr === pktTodayStr && driftMs > 15 * 60 * 1000) {
    console.warn(`[Biometric] Device RTC drift detected (device: ${dateStr}, actual PKT: ${now.toISOString()}). Using current timestamp.`);
    punchTime = now;
  }

  // Look up member by member_number (pin) — including inactive members so they can auto-reactivate
  // Try exact match first
  let { data: member } = await adminClient
    .from('members')
    .select('id, full_name, photo_url, member_number, join_date, tenure_months, monthly_fee, training_fees, amount_paid, active')
    .eq('member_number', pin)
    .maybeSingle();

  // Fallback 1: Try integer equivalence (e.g. pin '1' matches member_number '0001' or '001')
  if (!member && !isNaN(Number(pin))) {
    const numPin = Number(pin).toString();
    const { data: allMembers } = await adminClient
      .from('members')
      .select('id, full_name, photo_url, member_number, join_date, tenure_months, monthly_fee, training_fees, amount_paid, active');

    if (allMembers) {
      member = allMembers.find(
        (m: any) => m.member_number && Number(m.member_number) === Number(pin)
      ) || null;
    }
  }

  if (!member) {
    console.warn(`[Biometric] No member found matching pin/member_number="${pin}"`);
    return { success: false, reason: `No member with member_number="${pin}" found in database` };
  }

  // Avoid broadcasting heavy base64 strings over Supabase Realtime WebSockets
  const safePhotoUrl = member.photo_url && (member.photo_url.startsWith('http') || member.photo_url.length < 2048)
    ? member.photo_url
    : null;

  // Same calendar day in Pakistan (UTC+5), not UTC midnight
  const pktDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(punchTime);
  const dayStart = new Date(`${pktDate}T00:00:00+05:00`).toISOString();
  const dayEnd = new Date(`${pktDate}T23:59:59.999+05:00`).toISOString();

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

  // Fetch member's current fee status with billing cycle & tenure reconciliation
  const feeStatus = await getMemberFeeStatus(adminClient, member);

  if (existing) {
    // ── DUPLICATE SCAN ─────────────────────────────────────────────────────
    // Member already has attendance today — send warning notification
    console.log(`[Biometric] Duplicate scan for ${member.full_name} (already in at ${existing.check_in})`);

    const { error: dupNotifErr } = await adminClient.from('biometric_notifications').insert({
      type: 'duplicate',
      member_id: member.id,
      member_name: member.full_name,
      member_photo_url: safePhotoUrl,
      member_number: member.member_number,
      fee_status: feeStatus.status,
      fee_amount_due: feeStatus.amountDue,
      check_in_time: punchTime.toISOString(),
      existing_check_in: existing.check_in,
    });
    if (dupNotifErr) {
      console.error('[Biometric] Duplicate notification insert failed:', dupNotifErr.message);
    }
  } else {
    // ── NEW CHECK-IN ────────────────────────────────────────────────────────
    console.log(`[Biometric] New check-in for ${member.full_name} at ${punchTime.toISOString()}`);

    const wasInactive = !member.active;
    let lastCheckInBefore: string | null = null;
    let daysInactive = 0;

    if (wasInactive) {
      const { data: prevAtt } = await adminClient
        .from('attendance')
        .select('check_in')
        .eq('member_id', member.id)
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle();

      lastCheckInBefore = prevAtt?.check_in || null;
      const baseDate = lastCheckInBefore ? new Date(lastCheckInBefore) : new Date(member.join_date || punchTime);
      daysInactive = Math.max(0, Math.floor((punchTime.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)));
    }

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
        const { error: raceNotifErr } = await adminClient.from('biometric_notifications').insert({
          type: 'duplicate',
          member_id: member.id,
          member_name: member.full_name,
          member_photo_url: safePhotoUrl,
          member_number: member.member_number,
          fee_status: feeStatus.status,
          fee_amount_due: feeStatus.amountDue,
          check_in_time: punchTime.toISOString(),
          existing_check_in: null,
        });
        if (raceNotifErr) {
          console.error('[Biometric] Duplicate notification insert failed:', raceNotifErr.message);
        }
      } else {
        throw attErr;
      }
      return;
    }

    // Reactivate member if they were inactive, or update last_check_in
    if (wasInactive) {
      console.log(`[Biometric] Inactive member ${member.full_name} reactivated via punch!`);
      const { error: mUpErr } = await adminClient
        .from('members')
        .update({
          active: true,
          inactive_reason: null,
          updated_at: punchTime.toISOString(),
        })
        .eq('id', member.id);

      if (mUpErr) {
        await adminClient
          .from('members')
          .update({
            active: true,
            updated_at: punchTime.toISOString(),
          })
          .eq('id', member.id);
      }

      try {
        await adminClient.from('inactive_member_notifications').insert({
          member_id: member.id,
          member_name: member.full_name,
          member_number: member.member_number,
          member_photo_url: safePhotoUrl,
          check_in_time: punchTime.toISOString(),
          last_check_in_before: lastCheckInBefore,
          days_inactive: daysInactive,
          fee_status: feeStatus.status === 'paid' ? 'paid' : 'unpaid',
          fee_amount_due: feeStatus.amountDue,
          is_cleared: false,
        });
      } catch (e) {
        console.warn('[Biometric] Could not insert inactive_member_notifications alert:', e);
      }
    }

    // Send check-in notification for real-time popup on all clients
    const { error: checkinNotifErr } = await adminClient.from('biometric_notifications').insert({
      type: 'checkin',
      member_id: member.id,
      member_name: member.full_name,
      member_photo_url: safePhotoUrl,
      member_number: member.member_number,
      fee_status: feeStatus.status,
      fee_amount_due: feeStatus.amountDue,
      check_in_time: punchTime.toISOString(),
    });
    if (checkinNotifErr) {
      console.error('[Biometric] Check-in notification insert failed:', checkinNotifErr.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getMemberFeeStatus — Resolve member's current payment status
// ─────────────────────────────────────────────────────────────────────────────
async function getMemberFeeStatus(
  adminClient: ReturnType<typeof getAdminClient>,
  member: any
): Promise<{ status: 'paid' | 'due' | 'overdue'; amountDue: number }> {
  const { data: records } = await adminClient
    .from('fee_records')
    .select('id, paid, amount, amount_paid, discount, period_month, period_end, collected_by, payment_method')
    .eq('member_id', member.id)
    .order('period_month', { ascending: false });

  const now = new Date();
  const currentDay = now.getDate();
  const [jYear, jMonth, jDay] = (member.join_date || '').split('-').map(Number);
  const joinDay = jDay || 1;
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Check if current month fee is not yet due based on member's join billing day
  const feeNotDueYet = currentDay < joinDay;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const activeCycleKey = feeNotDueYet ? prevMonthKey : currentMonthKey;

  const totalFee = (Number(member.monthly_fee) || 0) + (Number(member.training_fees) || 0);

  // Check tenure
  const tenure = Math.max(1, Number(member.tenure_months) || 1);
  const lastTenureDate = new Date(jYear || now.getFullYear(), (jMonth || (now.getMonth() + 1)) - 1 + tenure - 1, 1);
  const lastTenurePeriod = `${lastTenureDate.getFullYear()}-${String(lastTenureDate.getMonth() + 1).padStart(2, '0')}-01`;

  // If active cycle is within registration tenure and member paid registration fee
  if (activeCycleKey <= lastTenurePeriod && Number(member.amount_paid) >= totalFee) {
    return { status: 'paid', amountDue: 0 };
  }

  const activeRecord = (records || []).find((r: any) => r.period_month === activeCycleKey);

  // If active record is marked paid
  if (activeRecord && activeRecord.paid) {
    return { status: 'paid', amountDue: 0 };
  }

  // If active record has partial payment
  if (activeRecord && Number(activeRecord.amount_paid) > 0) {
    const netDue = Math.max(0, Number(activeRecord.amount) - Number(activeRecord.discount || 0) - Number(activeRecord.amount_paid));
    if (netDue <= 0) return { status: 'paid', amountDue: 0 };
    return { status: 'due', amountDue: netDue };
  }

  // If fee for this month isn't due yet and no active record or previous was paid
  if (feeNotDueYet && (!activeRecord || activeRecord.paid)) {
    return { status: 'paid', amountDue: 0 };
  }

  // Check if overdue: only if currentDay > joinDay + 5 (grace period) or period_end < today
  const isOverdue = !feeNotDueYet && (
    (activeRecord?.period_end && new Date(activeRecord.period_end) < now) ||
    currentDay > (joinDay + 5)
  );

  const amountDue = activeRecord
    ? Math.max(0, Number(activeRecord.amount) - Number(activeRecord.discount || 0) - Number(activeRecord.amount_paid || 0))
    : totalFee;

  return {
    status: isOverdue ? 'overdue' : 'due',
    amountDue,
  };
}
