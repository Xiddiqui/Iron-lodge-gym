import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { feeIds, amountPaid, discount, paymentMethod, paidAt, paid_at } = body;

  const rawPaidAt = paidAt || paid_at;
  let paymentTimestamp: string;
  if (rawPaidAt) {
    if (typeof rawPaidAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawPaidAt)) {
      const now = new Date();
      const todayUtc = now.toISOString().slice(0, 10);
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (rawPaidAt === todayUtc || rawPaidAt === todayLocal) {
        paymentTimestamp = now.toISOString();
      } else {
        const [y, m, d] = rawPaidAt.split('-').map(Number);
        const combined = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
        paymentTimestamp = !isNaN(combined.getTime()) ? combined.toISOString() : now.toISOString();
      }
    } else {
      const parsed = new Date(rawPaidAt);
      paymentTimestamp = !isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
    }
  } else {
    paymentTimestamp = new Date().toISOString();
  }

  // Support legacy single feeId for backward compatibility
  const legacyFeeId = body.feeId;

  if (!feeIds && !legacyFeeId) {
    return NextResponse.json({ error: 'feeIds (array) or feeId (string) is required' }, { status: 400 });
  }

  const validMethods = ['cash', 'online', 'card', 'other'];
  if (paymentMethod && !validMethods.includes(paymentMethod)) {
    return NextResponse.json({ error: `paymentMethod must be one of: ${validMethods.join(', ')}` }, { status: 400 });
  }

  const method = paymentMethod || 'cash';

  // Legacy single fee collection (backward compat)
  if (legacyFeeId && !feeIds) {
    const { data: feeRecord, error: fetchErr } = await supabase
      .from('fee_records')
      .select('*')
      .eq('id', legacyFeeId)
      .single();

    if (fetchErr || !feeRecord) {
      return NextResponse.json({ error: 'Fee record not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('fee_records')
      .update({
        paid: true,
        amount_paid: feeRecord.amount,
        discount: 0,
        paid_at: paymentTimestamp,
        payment_method: method,
        collected_by: user.id,
      })
      .eq('id', legacyFeeId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Fee collected', record: data });
  }

  // Bulk payment: distribute amount across multiple fee records (oldest first)
  if (!Array.isArray(feeIds) || feeIds.length === 0) {
    return NextResponse.json({ error: 'feeIds must be a non-empty array' }, { status: 400 });
  }

  const totalPaid = Number(amountPaid) || 0;
  const totalDiscount = Number(discount) || 0;

  if (totalPaid < 0) {
    return NextResponse.json({ error: 'amountPaid cannot be negative' }, { status: 400 });
  }

  // Fetch all the fee records
  const { data: feeRecords, error: fetchError } = await supabase
    .from('fee_records')
    .select('*')
    .in('id', feeIds)
    .order('period_month', { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!feeRecords || feeRecords.length === 0) {
    return NextResponse.json({ error: 'No matching fee records found' }, { status: 404 });
  }

  // Calculate total due
  const totalDue = feeRecords.reduce((sum: number, r: any) => {
    const alreadyPaid = Number(r.amount_paid) || 0;
    return sum + (Number(r.amount) - alreadyPaid);
  }, 0);

  // Apply discount proportionally, then distribute payment oldest-first
  const effectivePayment = totalPaid;
  const discountPerRecord = feeRecords.length > 0 ? totalDiscount / feeRecords.length : 0;
  
  let remainingPayment = effectivePayment;
  const updates: Array<{ id: string; amount_paid: number; discount: number; paid: boolean; paid_at: string | null; payment_method: string; collected_by: string }> = [];

  for (const record of feeRecords) {
    const recordAmount = Number(record.amount) || 0;
    const alreadyPaid = Number(record.amount_paid) || 0;
    const recordDiscount = Math.min(discountPerRecord, recordAmount - alreadyPaid);
    const remainingForRecord = Math.max(0, recordAmount - alreadyPaid - recordDiscount);
    
    const paymentForRecord = Math.min(remainingPayment, remainingForRecord);
    remainingPayment -= paymentForRecord;

    const newAmountPaid = alreadyPaid + paymentForRecord;
    const isFullyPaid = (newAmountPaid + recordDiscount) >= recordAmount;

    updates.push({
      id: record.id,
      amount_paid: newAmountPaid,
      discount: (Number(record.discount) || 0) + recordDiscount,
      paid: isFullyPaid,
      paid_at: newAmountPaid > 0 ? paymentTimestamp : null,
      payment_method: method,
      collected_by: user.id,
    });
  }

  // Apply updates
  const results = [];
  for (const update of updates) {
    const { id, ...updateData } = update;
    const { data, error } = await supabase
      .from('fee_records')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: `Failed to update record ${id}: ${error.message}` }, { status: 500 });
    }
    results.push(data);
  }

  const totalActuallyPaid = effectivePayment;
  const netRemaining = Math.max(0, totalDue - totalDiscount - totalActuallyPaid);

  return NextResponse.json({
    message: 'Payment processed',
    records: results,
    summary: {
      totalDue,
      discount: totalDiscount,
      amountPaid: totalActuallyPaid,
      remaining: netRemaining,
      recordsUpdated: results.length,
    },
  });
}
