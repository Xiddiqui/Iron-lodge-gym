import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { calculateMemberFeeStatus } from '@/lib/fee-status';

function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && serviceRoleKey !== 'your_service_role_key') {
    return createClient(
      process.env.SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return null;
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = getAdminClient() || supabase;

    // Admin authentication check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Try executing database sync function if available
    try {
      await adminClient.rpc('sync_inactive_members_60_days');
    } catch {
      // RPC may not be present yet; we will do the programmatic sync below
    }

    // 1. Fetch members using core columns guaranteed to exist
    const { data: members, error: membersErr } = await adminClient
      .from('members')
      .select('id, full_name, phone, cnic, email, member_number, photo_url, join_date, monthly_fee, training_fees, tenure_months, amount_paid, active')
      .order('full_name', { ascending: true });

    if (membersErr) throw membersErr;

    // 2. Fetch latest attendance for each member
    const { data: attendanceRecords } = await adminClient
      .from('attendance')
      .select('member_id, check_in')
      .order('check_in', { ascending: false });

    // Map latest check-in per member
    const latestCheckInMap = new Map<string, string>();
    if (attendanceRecords) {
      for (const att of attendanceRecords) {
        if (att.member_id && !latestCheckInMap.has(att.member_id)) {
          latestCheckInMap.set(att.member_id, att.check_in);
        }
      }
    }

    // 3. Fetch fee records for fee status computation
    const { data: feeRecords } = await adminClient
      .from('fee_records')
      .select('member_id, period_month, paid, amount, amount_paid, discount, period_end');

    const feeRecordsByMember = new Map<string, any[]>();
    if (feeRecords) {
      for (const fr of feeRecords) {
        const existing = feeRecordsByMember.get(fr.member_id) || [];
        existing.push(fr);
        feeRecordsByMember.set(fr.member_id, existing);
      }
    }

    const now = new Date();
    const membersToInactivate: string[] = [];
    const inactiveMemberList: any[] = [];

    for (const m of members || []) {
      const lastCheckIn = latestCheckInMap.get(m.id) || null;
      const baseDate = lastCheckIn ? new Date(lastCheckIn) : new Date(m.join_date || now);
      const diffMs = now.getTime() - baseDate.getTime();
      const daysSince = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      const is60DaysInactive = daysSince >= 60;

      // If active member has 60+ days without attendance, mark for inactivation
      if (m.active && is60DaysInactive) {
        membersToInactivate.push(m.id);
      }

      // If member is 60+ days without attendance, include in inactive list
      if (is60DaysInactive || (!m.active && is60DaysInactive)) {
        const mFees = feeRecordsByMember.get(m.id) || [];
        const feeStatus = calculateMemberFeeStatus(m, mFees);

        inactiveMemberList.push({
          ...m,
          active: false,
          inactive_reason: 'no_attendance_60_days',
          last_check_in: lastCheckIn,
          days_inactive: daysSince,
          has_never_checked_in: !lastCheckIn,
          fee_status: feeStatus.status,
          fee_amount_due: feeStatus.amountDue,
          fee_raw_status: feeStatus.rawStatus,
          total_fee: feeStatus.totalFee,
        });
      }
    }

    // Perform database update for newly identified inactive members (defensive against missing column)
    if (membersToInactivate.length > 0) {
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await adminClient
        .from('members')
        .update({
          active: false,
          inactive_reason: 'no_attendance_60_days',
          updated_at: nowIso,
        })
        .in('id', membersToInactivate);

      if (updateErr) {
        // If inactive_reason column does not exist in DB yet, update without it
        await adminClient
          .from('members')
          .update({
            active: false,
            updated_at: nowIso,
          })
          .in('id', membersToInactivate);
      }
    }

    // Sort by days inactive descending (most inactive first)
    inactiveMemberList.sort((a, b) => b.days_inactive - a.days_inactive);

    // Compute stats
    const totalInactive = inactiveMemberList.length;
    const paidCount = inactiveMemberList.filter((m) => m.fee_status === 'paid').length;
    const unpaidCount = inactiveMemberList.filter((m) => m.fee_status === 'unpaid').length;
    const totalDues = inactiveMemberList.reduce((sum, m) => sum + (m.fee_amount_due || 0), 0);

    return NextResponse.json({
      success: true,
      members: inactiveMemberList,
      stats: {
        totalInactive,
        paidCount,
        unpaidCount,
        totalDues,
        newlyInactivated: membersToInactivate.length,
      },
    });
  } catch (err: any) {
    console.error('[API Inactive Members Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch inactive members' }, { status: 500 });
  }
}

/**
 * POST /api/inactive-members
 * Manually check-in and reactivate an inactive member
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const adminClient = getAdminClient() || supabase;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { member_id } = body;

    if (!member_id) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Fetch member
    const { data: member, error: mErr } = await adminClient
      .from('members')
      .select('id, full_name, phone, cnic, email, member_number, photo_url, join_date, monthly_fee, training_fees, tenure_months, amount_paid, active')
      .eq('id', member_id)
      .single();

    if (mErr || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const punchTime = new Date();

    // 1. Mark attendance
    const { data: attRecord, error: attErr } = await adminClient
      .from('attendance')
      .insert({
        member_id,
        check_in: punchTime.toISOString(),
        marked_by: user.id,
        source: 'manual',
      })
      .select()
      .single();

    if (attErr) {
      if (attErr.code === '23505') {
        return NextResponse.json({ error: 'Attendance already marked for today' }, { status: 400 });
      }
      throw attErr;
    }

    // 2. Fetch fee records to compute fee status
    const { data: feeRecords } = await adminClient
      .from('fee_records')
      .select('period_month, paid, amount, amount_paid, discount, period_end')
      .eq('member_id', member_id);

    const feeStatus = calculateMemberFeeStatus(member, feeRecords || []);

    // Fetch member's latest attendance prior to this check-in to get days inactive
    const { data: prevAtt } = await adminClient
      .from('attendance')
      .select('check_in')
      .eq('member_id', member_id)
      .lt('check_in', punchTime.toISOString())
      .order('check_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastCheckInBefore = prevAtt?.check_in || null;
    const baseDate = lastCheckInBefore ? new Date(lastCheckInBefore) : new Date(member.join_date || punchTime);
    const daysInactive = Math.max(0, Math.floor((punchTime.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)));

    // 3. Reactivate member (defensive against missing inactive_reason column)
    const { error: updateErr } = await adminClient
      .from('members')
      .update({
        active: true,
        inactive_reason: null,
        updated_at: punchTime.toISOString(),
      })
      .eq('id', member_id);

    if (updateErr) {
      await adminClient
        .from('members')
        .update({
          active: true,
          updated_at: punchTime.toISOString(),
        })
        .eq('id', member_id);
    }

    // 4. Create reactivation notification (defensive against table not created yet)
    let notification = null;
    try {
      const { data: notifData } = await adminClient
        .from('inactive_member_notifications')
        .insert({
          member_id: member.id,
          member_name: member.full_name,
          member_number: member.member_number,
          member_photo_url: member.photo_url && member.photo_url.length < 2048 ? member.photo_url : null,
          check_in_time: punchTime.toISOString(),
          last_check_in_before: lastCheckInBefore,
          days_inactive: daysInactive,
          fee_status: feeStatus.status,
          fee_amount_due: feeStatus.amountDue,
          is_cleared: false,
        })
        .select()
        .single();
      notification = notifData;
    } catch (nErr) {
      console.warn('[Inactive Members] Failed to insert notification:', nErr);
    }

    return NextResponse.json({
      success: true,
      message: `Member ${member.full_name} reactivated and attendance marked`,
      attendance: attRecord,
      notification,
    });
  } catch (err: any) {
    console.error('[API Reactivate Member Error]:', err);
    return NextResponse.json({ error: err.message || 'Failed to reactivate member' }, { status: 500 });
  }
}
