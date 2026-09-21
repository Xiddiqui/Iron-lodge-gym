import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await request.json();
  const { memberId, month, year } = body;

  // If memberId is provided, generate for a specific member
  // Otherwise generate for all active members for the given month/year
  if (memberId) {
    // Get the member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, monthly_fee, training_fees, join_date, tenure_months, amount_paid, active')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (!member.join_date) {
      return NextResponse.json({ message: 'Member has no join date', generated: 0 });
    }

    // Safely parse join_date without timezone offset shifting
    const [jYear, jMonth, jDay] = member.join_date.split('-').map(Number);
    if (!jYear || !jMonth) {
      return NextResponse.json({ error: 'Invalid join date' }, { status: 400 });
    }

    const joinPeriodMonth = `${jYear}-${String(jMonth).padStart(2, '0')}-01`;
    const joinDay = jDay || 1;

    // 1. Delete any invalid fee records strictly before the member's join date month
    await supabase
      .from('fee_records')
      .delete()
      .eq('member_id', member.id)
      .lt('period_month', joinPeriodMonth);

    // 2. Determine cycle boundaries considering tenure package
    const now = new Date();
    const currentDay = now.getDate();
    const latestDueMonth = currentDay >= joinDay
      ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const latestDueMonthKey = `${latestDueMonth.getFullYear()}-${String(latestDueMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const tenure = Math.max(1, Number(member.tenure_months) || 1);
    const lastTenureDate = new Date(jYear, jMonth - 1 + tenure - 1, 1);
    const lastTenurePeriod = `${lastTenureDate.getFullYear()}-${String(lastTenureDate.getMonth() + 1).padStart(2, '0')}-01`;
    const maxGenerationDate = lastTenureDate > latestDueMonth ? lastTenureDate : latestDueMonth;
    const maxAllowedPeriod = lastTenurePeriod > latestDueMonthKey ? lastTenurePeriod : latestDueMonthKey;

    // Delete any future unpaid fee records beyond both tenure package and latest active cycle
    await supabase
      .from('fee_records')
      .delete()
      .eq('member_id', member.id)
      .gt('period_month', maxAllowedPeriod)
      .eq('paid', false);

    // Fetch existing records for this member
    const { data: existingRecords } = await supabase
      .from('fee_records')
      .select('id, period_month, paid, amount, amount_paid')
      .eq('member_id', member.id);

    const existingMap = new Map((existingRecords || []).map((r: any) => [r.period_month, r]));

    const monthlyRate = Number(member.monthly_fee) || 0;
    const trainingFee = Number(member.training_fees) || 0;
    const totalFee = monthlyRate + trainingFee;
    const totalTenureFee = monthlyRate * tenure + trainingFee;
    const memberPaid = Number(member.amount_paid) || 0;
    const paidAtTimestamp = member.join_date ? `${member.join_date}T12:00:00.000Z` : now.toISOString();

    const recordsToInsert = [];
    const idsToMarkPaid: string[] = [];

    let cursor = new Date(jYear, jMonth - 1, 1);
    while (cursor <= maxGenerationDate) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const periodMonth = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const isWithinTenure = periodMonth <= lastTenurePeriod;
      const isTenurePaid = isWithinTenure && (memberPaid >= totalTenureFee || memberPaid >= totalFee) && totalFee > 0;

      const existing = existingMap.get(periodMonth);
      if (!existing) {
        recordsToInsert.push({
          member_id: member.id,
          amount: totalFee,
          period_month: periodMonth,
          period_end: periodEnd,
          paid: isTenurePaid,
          amount_paid: isTenurePaid ? totalFee : 0,
          paid_at: isTenurePaid ? paidAtTimestamp : null,
          payment_method: 'cash',
          discount: 0,
        });
      } else if (isTenurePaid && (!existing.paid || Number(existing.amount_paid || 0) < totalFee)) {
        idsToMarkPaid.push(existing.id);
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (idsToMarkPaid.length > 0) {
      await supabase
        .from('fee_records')
        .update({
          paid: true,
          amount_paid: totalFee,
          paid_at: paidAtTimestamp,
        })
        .in('id', idsToMarkPaid);
    }

    let insertedCount = 0;
    if (recordsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('fee_records')
        .insert(recordsToInsert)
        .select();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      insertedCount = inserted?.length ?? 0;
    }

    return NextResponse.json({
      message: `Generated and reconciled fee records for member`,
      generated: insertedCount + idsToMarkPaid.length,
    });
  }

  // Bulk generation for all active members for a specific month
  if (!month || !year) {
    return NextResponse.json({ error: 'month and year are required for bulk generation' }, { status: 400 });
  }

  const periodMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Get all active members
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, monthly_fee, training_fees, join_date, tenure_months, amount_paid')
    .eq('active', true);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return NextResponse.json({ message: 'No active members found', generated: 0 });
  }

  // Filter members who joined on or before this billing month, and whose billing day has started
  const now = new Date();
  const isCurrentCalendarMonth = periodMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const eligibleMembers = members.filter((m) => {
    if (!m.join_date) return true;
    const [jYear, jMonth, jDay] = m.join_date.split('-').map(Number);
    if (!jYear || !jMonth) return true;
    const joinPeriodMonth = `${jYear}-${String(jMonth).padStart(2, '0')}-01`;
    if (joinPeriodMonth > periodMonth) return false;

    if (isCurrentCalendarMonth && now.getDate() < (jDay || 1)) {
      return false;
    }
    return true;
  });

  if (eligibleMembers.length === 0) {
    return NextResponse.json({ message: 'No eligible members for this month', generated: 0 });
  }

  // Build fee records
  const bulkRecords = eligibleMembers.map((m) => {
    const monthlyRate = Number(m.monthly_fee) || 0;
    const trainingFee = Number(m.training_fees) || 0;
    const totalFee = monthlyRate + trainingFee;
    const tenure = Math.max(1, Number(m.tenure_months) || 1);
    const memberPaid = Number(m.amount_paid) || 0;
    const totalTenureFee = monthlyRate * tenure + trainingFee;

    let isTenurePaid = false;
    if (m.join_date) {
      const [jYear, jMonth] = m.join_date.split('-').map(Number);
      if (jYear && jMonth) {
        const lastTenureDate = new Date(jYear, jMonth - 1 + tenure - 1, 1);
        const lastTenurePeriod = `${lastTenureDate.getFullYear()}-${String(lastTenureDate.getMonth() + 1).padStart(2, '0')}-01`;
        if (periodMonth <= lastTenurePeriod && (memberPaid >= totalTenureFee || memberPaid >= totalFee) && totalFee > 0) {
          isTenurePaid = true;
        }
      }
    }

    return {
      member_id: m.id,
      amount: totalFee,
      period_month: periodMonth,
      period_end: periodEnd,
      paid: isTenurePaid,
      amount_paid: isTenurePaid ? totalFee : 0,
      paid_at: isTenurePaid ? (m.join_date ? `${m.join_date}T12:00:00.000Z` : now.toISOString()) : null,
      discount: 0,
      payment_method: 'cash',
    };
  });

  // Fetch existing records for this month to reconcile tenure payments
  const { data: existingRecords } = await supabase
    .from('fee_records')
    .select('id, member_id, paid, amount_paid')
    .eq('period_month', periodMonth);

  const existingMap = new Map((existingRecords || []).map((r: any) => [r.member_id, r]));
  const recordsToInsert: any[] = [];
  const updatesToMarkPaid: Array<{ id: string; amount_paid: number; paid_at: string | null }> = [];

  for (const rec of bulkRecords) {
    const existing = existingMap.get(rec.member_id);
    if (!existing) {
      recordsToInsert.push(rec);
    } else if (rec.paid && (!existing.paid || Number(existing.amount_paid || 0) < rec.amount)) {
      updatesToMarkPaid.push({
        id: existing.id,
        amount_paid: rec.amount_paid,
        paid_at: rec.paid_at,
      });
    }
  }

  let insertedCount = 0;
  if (recordsToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('fee_records')
      .insert(recordsToInsert)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    insertedCount = inserted?.length ?? 0;
  }

  for (const u of updatesToMarkPaid) {
    await supabase
      .from('fee_records')
      .update({ paid: true, amount_paid: u.amount_paid, paid_at: u.paid_at })
      .eq('id', u.id);
  }

  return NextResponse.json({
    message: `Generated fee records for ${periodMonth}`,
    generated: insertedCount + updatesToMarkPaid.length,
    total_members: eligibleMembers.length,
  });
}
