export function periodKey(value: string | null | undefined): string {
  return String(value || '').slice(0, 10);
}

/** First of the billing month, so 2026-12-15 and 2026-12-01 are the same cycle. */
export function normalizePeriod(value: string | null | undefined): string {
  const match = periodKey(value).match(/^(\d{4})-(\d{2})/);
  if (!match) return '';
  return `${match[1]}-${match[2]}-01`;
}

export function shiftPeriod(period: string, months: number): string {
  const normalized = normalizePeriod(period);
  const [year, month] = normalized.split('-').map(Number);
  const cursor = new Date(year || 1970, (month || 1) - 1 + months, 1);
  return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`;
}

type FeeLike = {
  period_month?: string | null;
  paid?: boolean | string | number | null;
  status?: string | null;
  amount?: number | string | null;
  amount_paid?: number | string | null;
  discount?: number | string | null;
};

/** Same paid check the Fee History badge uses, plus a partial payment. */
export function rowCountsAsPaid(record: FeeLike): boolean {
  const flag = record.paid;
  if (flag === true || flag === 1 || flag === '1' || flag === 'true' || flag === 't' || flag === 'yes') return true;
  if (typeof flag === 'string' && flag.toLowerCase() === 'paid') return true;
  if (String(record.status || '').toLowerCase() === 'paid' && (flag == null || flag === '')) return true;
  if (Number(record.amount_paid || 0) > 0) return true;
  const amount = Number(record.amount || 0);
  const discount = Number(record.discount || 0);
  return amount > 0 && discount >= amount;
}

export function isSettledFee(record: FeeLike): boolean {
  return rowCountsAsPaid(record);
}

function settledPeriods(records: FeeLike[]): Set<string> {
  return new Set(
    records
      .filter((record) => rowCountsAsPaid(record))
      .map((record) => normalizePeriod(record.period_month))
      .filter(Boolean)
  );
}

/** Billing month that is due today, using the member's join day. */
export function latestDuePeriod(joinDate?: string | null, now = new Date()): string {
  const joinDay = Number(String(joinDate || '').slice(8, 10)) || 1;
  const due = now.getDate() >= joinDay
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-01`;
}

/** The cycle after the latest paid month, once at least 3 months are paid. */
export function monthAfterLatestPaid(records: FeeLike[]): string | null {
  const paid = [...settledPeriods(records)].sort();
  if (paid.length < 3) return null;
  return shiftPeriod(paid[paid.length - 1], 1);
}

/**
 * True when this cycle is the unpaid month immediately after 3 paid months
 * (1 Jan – 1 Feb after 1 Oct – 1 Nov, 1 Nov – 1 Dec, 1 Dec – 1 Jan).
 * Older paid months before that run do not cancel it.
 */
export function followsPaidPackage(
  period: string | null | undefined,
  records: FeeLike[]
): boolean {
  const key = normalizePeriod(period);
  if (!key) return false;
  const settled = settledPeriods(records);
  if (settled.has(key)) return false;
  let streak = 0;
  for (let i = 1; i <= 18; i++) {
    if (!settled.has(shiftPeriod(key, -i))) break;
    streak += 1;
  }
  return streak >= 3;
}

/** Fee history hides the unpaid cycle after a 3-month paid run only if it is in the future (not due yet). */
export function shouldHideFromFeeHistory(
  period: string | null | undefined,
  records: FeeLike[],
  dueMonth?: string
): boolean {
  const key = normalizePeriod(period);
  if (!key) return false;
  if (!followsPaidPackage(key, records)) return false;
  if (dueMonth) return key > dueMonth;
  return false;
}

export function extraUnpaidPeriods<T extends FeeLike>(records: T[]): T[] {
  return records.filter((record) => !rowCountsAsPaid(record) && followsPaidPackage(record.period_month, records));
}

/**
 * Records to delete or not create.
 * An unpaid cycle after paid months is only omitted if it is in the future (not due yet).
 */
export function shouldOmitUnpaidCycle(
  period: string | null | undefined,
  records: FeeLike[],
  options: { tenure?: number | null; dueMonth: string }
): boolean {
  const key = normalizePeriod(period);
  if (!key) return false;
  if (records.some((record) => normalizePeriod(record.period_month) === key && rowCountsAsPaid(record))) {
    return false;
  }
  const afterThreePaid = followsPaidPackage(key, records) || monthAfterLatestPaid(records) === key;
  if (!afterThreePaid) return false;
  return key > options.dueMonth;
}

export function getBillingCycleDateRange(
  periodMonth: string | null | undefined,
  joinDate?: string | null
): { startStr: string; endStr: string; formattedRange: string } {
  const norm = normalizePeriod(periodMonth);
  if (!norm) {
    const now = new Date();
    const s = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return { startStr: s, endStr: s, formattedRange: s };
  }
  const [y, m] = norm.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');

  if (joinDate && typeof joinDate === 'string' && joinDate.includes('-')) {
    const cleanJoinDate = joinDate.slice(0, 10);
    const [, , jD] = cleanJoinDate.split('-').map(Number);
    const joinDay = jD || 1;

    const daysInStartMonth = new Date(y, m, 0).getDate();
    const startDay = Math.min(joinDay, daysInStartMonth);

    const nextMonthObj = new Date(y, m, 1);
    const nextY = nextMonthObj.getFullYear();
    const nextM = nextMonthObj.getMonth() + 1;
    const daysInNextMonth = new Date(nextY, nextM, 0).getDate();
    const endDay = Math.min(joinDay, daysInNextMonth);

    const startStr = `${y}-${pad(m)}-${pad(startDay)}`;
    const endStr = `${nextY}-${pad(nextM)}-${pad(endDay)}`;

    const startDate = new Date(y, m - 1, startDay);
    const endDate = new Date(nextY, nextM - 1, endDay);
    const startMonthStr = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonthStr = endDate.toLocaleDateString('en-US', { month: 'short' });
    const formattedRange = y === nextY
      ? `${startDay} ${startMonthStr} – ${endDay} ${endMonthStr} ${y}`
      : `${startDay} ${startMonthStr} ${y} – ${endDay} ${endMonthStr} ${nextY}`;

    return { startStr, endStr, formattedRange };
  }

  const nextMonthObj = new Date(y, m, 1);
  const nextY = nextMonthObj.getFullYear();
  const nextM = nextMonthObj.getMonth() + 1;

  const startStr = `${y}-${pad(m)}-01`;
  const endStr = `${nextY}-${pad(nextM)}-01`;
  const startDate = new Date(y, m - 1, 1);
  const formattedRange = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return { startStr, endStr, formattedRange };
}

export function calculateCycleAttendance(
  attendanceRecords: Array<{ check_in?: string | null }> | null | undefined,
  periodMonth: string | null | undefined,
  joinDate?: string | null
): { count: number; dates: string[]; formattedDates: string[] } {
  if (!attendanceRecords || attendanceRecords.length === 0) {
    return { count: 0, dates: [], formattedDates: [] };
  }

  const { startStr, endStr } = getBillingCycleDateRange(periodMonth, joinDate);
  const uniqueDates = new Set<string>();

  for (const record of attendanceRecords) {
    if (!record?.check_in) continue;
    const d = new Date(record.check_in);
    if (isNaN(d.getTime())) continue;
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (dateStr >= startStr && dateStr < endStr) {
      uniqueDates.add(dateStr);
    }
  }

  const dates = Array.from(uniqueDates).sort();
  const formattedDates = dates.map(dStr => {
    const [y, m, d] = dStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${d} ${dt.toLocaleDateString('en-US', { month: 'short' })}`;
  });

  return {
    count: dates.length,
    dates,
    formattedDates,
  };
}

