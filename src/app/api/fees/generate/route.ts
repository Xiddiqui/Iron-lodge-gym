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
      .select('id, monthly_fee, training_fees, join_date, amount_paid, active')
      .eq('id', memberId)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Generate fee records from join_date to current month
    const joinDate = new Date(member.join_date);
    const now = new Date();
    const records = [];

    let cursor = new Date(joinDate.getFullYear(), joinDate.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    while (cursor <= endMonth) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      const periodMonth = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const totalFee = (Number(member.monthly_fee) || 0) + (Number(member.training_fees) || 0);

      records.push({
        member_id: member.id,
        amount: totalFee,
        period_month: periodMonth,
        period_end: periodEnd,
        paid: false,
        amount_paid: 0,
        discount: 0,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    if (records.length === 0) {
      return NextResponse.json({ message: 'No records to generate', generated: 0 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('fee_records')
      .upsert(records, { onConflict: 'member_id,period_month', ignoreDuplicates: true })
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Generated fee records for member`,
      generated: inserted?.length ?? 0,
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
    .select('id, monthly_fee, training_fees')
    .eq('active', true);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return NextResponse.json({ message: 'No active members found', generated: 0 });
  }

  // Build fee records
  const bulkRecords = members.map((m) => {
    const totalFee = (Number(m.monthly_fee) || 0) + (Number(m.training_fees) || 0);
    return {
      member_id: m.id,
      amount: totalFee,
      period_month: periodMonth,
      period_end: periodEnd,
      paid: false,
      amount_paid: 0,
      discount: 0,
    };
  });

  const { data: inserted, error: insertError } = await supabase
    .from('fee_records')
    .upsert(bulkRecords, { onConflict: 'member_id,period_month', ignoreDuplicates: true })
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Generated fee records for ${periodMonth}`,
    generated: inserted?.length ?? 0,
    total_members: members.length,
  });
}
