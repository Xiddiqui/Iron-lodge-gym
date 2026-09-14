/**
 * Fee status helper to determine if a member is currently Paid or Unpaid
 * and calculate the remaining amount due if unpaid.
 */

export interface FeeStatusResult {
  status: 'paid' | 'unpaid';
  rawStatus: 'paid' | 'due' | 'overdue' | 'partial';
  amountDue: number;
  totalFee: number;
}

export function calculateMemberFeeStatus(
  member: {
    id?: string;
    join_date?: string | null;
    monthly_fee?: number | string | null;
    training_fees?: number | string | null;
    tenure_months?: number | string | null;
    amount_paid?: number | string | null;
  },
  feeRecords: Array<{
    period_month: string;
    paid?: boolean;
    amount?: number | string;
    amount_paid?: number | string;
    discount?: number | string;
    period_end?: string | null;
  }> = []
): FeeStatusResult {
  const now = new Date();
  const currentDay = now.getDate();

  const monthlyFee = Number(member.monthly_fee) || 0;
  const trainingFee = Number(member.training_fees) || 0;
  const totalFee = monthlyFee + trainingFee;

  // If gym charges no fees for this member
  if (totalFee <= 0) {
    return { status: 'paid', rawStatus: 'paid', amountDue: 0, totalFee: 0 };
  }

  // Parse join date
  const [jYear, jMonth, jDay] = (member.join_date || '').split('-').map(Number);
  const joinDay = jDay || 1;

  // Determine active billing cycle key
  const feeNotDueYet = currentDay < joinDay;
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const activeCycleKey = feeNotDueYet ? prevMonthKey : currentMonthKey;

  // Check tenure coverage
  const tenure = Math.max(1, Number(member.tenure_months) || 1);
  const lastTenureDate = new Date(
    jYear || now.getFullYear(),
    (jMonth || now.getMonth() + 1) - 1 + tenure - 1,
    1
  );
  const lastTenurePeriod = `${lastTenureDate.getFullYear()}-${String(lastTenureDate.getMonth() + 1).padStart(2, '0')}-01`;

  // If within registration tenure and member paid registration fee
  if (activeCycleKey <= lastTenurePeriod && Number(member.amount_paid) >= totalFee) {
    return { status: 'paid', rawStatus: 'paid', amountDue: 0, totalFee };
  }

  const activeRecord = (feeRecords || []).find((r) => r.period_month === activeCycleKey);

  // If active cycle record is paid
  if (activeRecord && activeRecord.paid) {
    return { status: 'paid', rawStatus: 'paid', amountDue: 0, totalFee };
  }

  // If active record has partial payment
  if (activeRecord && Number(activeRecord.amount_paid) > 0) {
    const netDue = Math.max(
      0,
      Number(activeRecord.amount || totalFee) -
        Number(activeRecord.discount || 0) -
        Number(activeRecord.amount_paid || 0)
    );
    if (netDue <= 0) {
      return { status: 'paid', rawStatus: 'paid', amountDue: 0, totalFee };
    }
    return { status: 'unpaid', rawStatus: 'partial', amountDue: netDue, totalFee };
  }

  // If fee for current month is not due yet and previous record was paid / no due
  if (feeNotDueYet && (!activeRecord || activeRecord.paid)) {
    return { status: 'paid', rawStatus: 'paid', amountDue: 0, totalFee };
  }

  // Overdue vs Due
  const isOverdue =
    !feeNotDueYet &&
    ((activeRecord?.period_end && new Date(activeRecord.period_end) < now) ||
      currentDay > joinDay + 5);

  const amountDue = activeRecord
    ? Math.max(
        0,
        Number(activeRecord.amount || totalFee) -
          Number(activeRecord.discount || 0) -
          Number(activeRecord.amount_paid || 0)
      )
    : totalFee;

  return {
    status: 'unpaid',
    rawStatus: isOverdue ? 'overdue' : 'due',
    amountDue,
    totalFee,
  };
}
