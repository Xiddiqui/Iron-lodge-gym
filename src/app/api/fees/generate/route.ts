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
  const month = body.month; // e.g. "2026-08-01"

  if (!month) {
    return NextResponse.json({ error: 'month is required (YYYY-MM-DD format, first day of month)' }, { status: 400 });
  }

  // Calculate period end (last day of the month)
  const monthDate = new Date(month);
  const periodEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  // Get all active members
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, monthly_fee')
    .eq('active', true);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  if (!members || members.length === 0) {
    return NextResponse.json({ message: 'No active members found', generated: 0 });
  }

  // Build fee records, using upsert to skip existing ones
  const records = members.map((m) => ({
    member_id: m.id,
    amount: m.monthly_fee,
    period_month: month,
    period_end: periodEnd,
    paid: false,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('fee_records')
    .upsert(records, { onConflict: 'member_id,period_month', ignoreDuplicates: true })
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Generated fee records for ${month}`,
    generated: inserted?.length ?? 0,
    total_members: members.length,
  });
}
