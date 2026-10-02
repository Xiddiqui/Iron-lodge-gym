import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { feeIds, advanceRecords, amountPaid, discount, paymentMethod, paidAt, paid_at, membership, feeAmountOverrides } = body;

  if (membership?.memberId) {
    const tenureMonths = Math.max(1, Number(membership.tenureMonths) || 1);
    const trainingFees = Math.max(0, Number(membership.trainingFees) || 0);

    // Keep already-collected months collected if the plan length changes.
    await supabase
      .from('fee_records')
      .update({ collected_by: user.id })
      .eq('member_id', membership.memberId)
      .eq('paid', true)
      .is('collected_by', null);

    const { error: memberErr } = await supabase
      .from('members')
      .update({
        tenure_months: tenureMonths,
        training_fees: trainingFees,
      })
      .eq('id', membership.memberId);

    if (memberErr) {
      return NextResponse.json({ error: `Failed to update membership plan: ${memberErr.message}` }, { status: 500 });
    }
  }

  if (Array.isArray(feeAmountOverrides)) {
    for (const override of feeAmountOverrides) {
      if (!override?.id || String(override.id).startsWith('v_')) continue;
      const nextAmount = Number(override.amount);
      if (!Number.isFinite(nextAmount) || nextAmount < 0) continue;
      const { error: amountErr } = await supabase
        .from('fee_records')
        .update({ amount: nextAmount })
        .eq('id', override.id);
      if (amountErr) {
        return NextResponse.json({ error: `Failed to update fee amount: ${amountErr.message}` }, { status: 500 });
      }
    }
  }

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

  // Process advance records if provided
  let allFeeIds: string[] = Array.isArray(feeIds) ? [...feeIds] : [];

  if (Array.isArray(advanceRecords) && advanceRecords.length > 0) {
    for (const adv of advanceRecords) {
      if (!adv.member_id || !adv.period_month) continue;

      // Check if fee record already exists for this member & period_month
      const { data: existing } = await supabase
        .from('fee_records')
        .select('id')
        .eq('member_id', adv.member_id)
        .eq('period_month', adv.period_month)
        .maybeSingle();

      if (existing) {
        if (adv.amount != null && Number.isFinite(Number(adv.amount))) {
          await supabase
            .from('fee_records')
            .update({ amount: Number(adv.amount) })
            .eq('id', existing.id);
        }
        if (!allFeeIds.includes(existing.id)) {
          allFeeIds.push(existing.id);
        }
      } else {
        // Calculate period_end if not supplied
        let periodEnd = adv.period_end;
        if (!periodEnd) {
          const [y, m] = adv.period_month.split('-').map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          periodEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        }

        const { data: created, error: createErr } = await supabase
          .from('fee_records')
          .insert({
            member_id: adv.member_id,
            period_month: adv.period_month,
            period_end: periodEnd,
            amount: Number(adv.amount) || 0,
            paid: false,
            amount_paid: 0,
            discount: 0,
          })
          .select('id')
          .single();

        if (createErr) {
          return NextResponse.json({ error: `Failed to create advance fee record: ${createErr.message}` }, { status: 500 });
        }
        if (created && !allFeeIds.includes(created.id)) {
          allFeeIds.push(created.id);
        }
      }
    }
  }

  if (allFeeIds.length === 0 && !legacyFeeId) {
    return NextResponse.json({ error: 'feeIds, feeId, or advanceRecords is required' }, { status: 400 });
  }

  const validMethods = ['cash', 'online', 'card', 'other'];
  if (paymentMethod && !validMethods.includes(paymentMethod)) {
    return NextResponse.json({ error: `paymentMethod must be one of: ${validMethods.join(', ')}` }, { status: 400 });
  }

  const method = paymentMethod || 'cash';

  // Legacy single fee collection (backward compat)
  if (legacyFeeId && allFeeIds.length === 0) {
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
  if (allFeeIds.length === 0) {
    return NextResponse.json({ error: 'No fee records to process' }, { status: 400 });
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
    .in('id', allFeeIds)
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

  // If extra payment remains, automatically create and pay subsequent advance cycle(s)
  if (remainingPayment > 0 && feeRecords.length > 0) {
    const memberId = feeRecords[0].member_id;
    const { data: memberData } = await supabase
      .from('members')
      .select('id, monthly_fee, training_fees')
      .eq('id', memberId)
      .single();

    const monthlyRate = (Number(memberData?.monthly_fee) || 0) + (Number(memberData?.training_fees) || 0);
    const standardAmount = monthlyRate > 0 ? monthlyRate : (Number(feeRecords[feeRecords.length - 1]?.amount) || 0);

    let cursorPeriodMonth = feeRecords[feeRecords.length - 1].period_month;
    let safeguard = 0;

    while (remainingPayment > 0 && safeguard < 24) {
      safeguard++;
      const [lastY, lastM] = cursorPeriodMonth.split('-').map(Number);
      const nextDate = new Date(lastY, lastM, 1);
      const nY = nextDate.getFullYear();
      const nM = nextDate.getMonth() + 1;
      const nextPeriodMonth = `${nY}-${String(nM).padStart(2, '0')}-01`;
      const lastDay = new Date(nY, nM, 0).getDate();
      const nextPeriodEnd = `${nY}-${String(nM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const cycleAmount = standardAmount > 0 ? standardAmount : remainingPayment;
      const paymentForAdv = Math.min(remainingPayment, cycleAmount);
      remainingPayment -= paymentForAdv;
      const isAdvPaid = paymentForAdv >= cycleAmount && cycleAmount > 0;

      const { data: existingAdv } = await supabase
        .from('fee_records')
        .select('id, amount, amount_paid')
        .eq('member_id', memberId)
        .eq('period_month', nextPeriodMonth)
        .maybeSingle();

      if (existingAdv) {
        const currentPaid = Number(existingAdv.amount_paid) || 0;
        const newPaid = currentPaid + paymentForAdv;
        const targetAmount = Number(existingAdv.amount) || cycleAmount;
        const { data: updatedAdv } = await supabase
          .from('fee_records')
          .update({
            paid: newPaid >= targetAmount,
            amount_paid: newPaid,
            paid_at: paymentTimestamp,
            payment_method: method,
            collected_by: user.id,
          })
          .eq('id', existingAdv.id)
          .select()
          .single();
        if (updatedAdv) results.push(updatedAdv);
      } else {
        const { data: createdAdv } = await supabase
          .from('fee_records')
          .insert({
            member_id: memberId,
            period_month: nextPeriodMonth,
            period_end: nextPeriodEnd,
            amount: cycleAmount,
            paid: isAdvPaid,
            amount_paid: paymentForAdv,
            discount: 0,
            paid_at: paymentTimestamp,
            payment_method: method,
            collected_by: user.id,
          })
          .select()
          .single();
        if (createdAdv) results.push(createdAdv);
      }
      cursorPeriodMonth = nextPeriodMonth;
    }
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
