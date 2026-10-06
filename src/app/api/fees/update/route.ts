import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Only an admin can update a recorded payment' }, { status: 403 });
  }

  const body = await request.json();
  const feeId = String(body.feeId || '');
  const nextAmount = Number(body.amount);
  const nextPaid = Number(body.amountPaid);
  const nextDiscount = Number(body.discount ?? 0);

  if (!feeId || feeId.startsWith('v_')) {
    return NextResponse.json({ error: 'A saved fee record is required' }, { status: 400 });
  }
  if (!Number.isFinite(nextAmount) || nextAmount < 0) {
    return NextResponse.json({ error: 'Fee amount must be zero or more' }, { status: 400 });
  }
  if (!Number.isFinite(nextPaid) || nextPaid < 0) {
    return NextResponse.json({ error: 'Amount received must be zero or more' }, { status: 400 });
  }
  if (!Number.isFinite(nextDiscount) || nextDiscount < 0) {
    return NextResponse.json({ error: 'Discount must be zero or more' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('fee_records')
    .select('id, paid_at, payment_method')
    .eq('id', feeId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
  }

  const covered = nextPaid + nextDiscount;
  const hasPayment = nextPaid > 0 || nextDiscount > 0;
  const isPaid = nextAmount <= 0 ? hasPayment : covered >= nextAmount;

  const { data, error } = await supabase
    .from('fee_records')
    .update({
      amount: nextAmount,
      amount_paid: nextPaid,
      discount: nextDiscount,
      paid: isPaid,
      paid_at: hasPayment ? (existing.paid_at || new Date().toISOString()) : null,
      payment_method: hasPayment ? (existing.payment_method || 'cash') : null,
    })
    .eq('id', feeId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const remaining = Math.max(0, nextAmount - nextDiscount - nextPaid);
  return NextResponse.json({
    message: 'Payment updated',
    record: data,
    remaining,
  });
}
