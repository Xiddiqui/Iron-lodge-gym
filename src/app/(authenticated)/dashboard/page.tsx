'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { formatCurrency, formatDate, formatDateTime, formatTime, formatMonthYear, getTodayLocalDateString } from '@/lib/format';
import { useGymSettings } from '@/hooks/use-gym-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wallet, Receipt, Zap, UserCheck, ArrowUpRight, ArrowDownRight, TrendingUp, Target, History, Landmark, Trash2, Calendar, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PhotoPreviewDialog } from '@/components/ui/photo-preview-dialog';
import { Skeleton } from '@/components/ui/skeleton';

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const motionVal = useMotionValue(0);
  const display = useTransform(motionVal, (v) => format(Math.round(v)));
  useEffect(() => {
    const controls = animate(motionVal, value, { duration: 0.9, ease: 'easeOut' });
    return controls.stop;
  }, [value, motionVal]);
  return <motion.span>{display}</motion.span>;
}

const isToday = (dateStr: string | null) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

function formatWalkinRelativeDate(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isToday(dateStr)) {
    return `Today at ${timeStr}`;
  }
  
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  ) {
    return `Yesterday at ${timeStr}`;
  }
  
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

const isPastNDays = (dateStr: string | null, days: number) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);
  return d >= cutoff;
};

function formatPaymentDateTime(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  const val = formatDateTime(dateStr);
  return val === '—' ? 'N/A' : val;
}

function formatPaymentTime(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  const val = formatTime(dateStr);
  return val === '—' ? 'N/A' : val;
}

const CHART_COLORS = { revenue: '#a3e635', expenses: '#ef4444', profit: '#22c55e' };
const PIE_COLORS = ['#a3e635', '#f97316', '#ef4444'];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: role, isLoading: isRoleLoading } = useRole();
  const { data: settings } = useGymSettings();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [trendMonths, setTrendMonths] = useState(6);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>(() => getTodayLocalDateString());
  const [isWalkinModalOpen, setIsWalkinModalOpen] = useState(false);
  const [deletingWalkinId, setDeletingWalkinId] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ open: boolean; photoUrl: string | null; title?: string; subtitle?: string }>({ open: false, photoUrl: null });

  const openFullPhoto = (photoUrl: string | null, title?: string, subtitle?: string) => {
    if (!photoUrl) return;
    setPhotoPreview({ open: true, photoUrl, title: title || 'Member Photo', subtitle });
  };

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthStart = `${selectedMonth}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Local calendar boundaries for selected month
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const startOfNextMonth = new Date(year, month, 1, 0, 0, 0, 0);

  // Query for recent payment records (Today's payments & modal history)
  const { data: allPaymentRecords = [], isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['dash-recent-payment-records'],
    enabled: role === 'admin',
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_records')
        .select('id, amount, amount_paid, paid, paid_at, payment_method, member_id, period_month, period_end, collected_by, created_at, members(member_number, full_name, phone, photo_url, created_at)')
        .or('paid.eq.true,amount_paid.gt.0')
        .order('paid_at', { ascending: false, nullsFirst: false })
        .limit(300);

      if (error) throw error;
      return (data ?? []).map((r: any) => {
        let effectivePaidAt = r.paid_at;
        // If paid_at is the legacy static 12:00:00 or 00:00:00 placeholder, heal with real created_at
        if (typeof r.paid_at === 'string' && (r.paid_at.includes('T12:00:00') || r.paid_at.includes('T00:00:00'))) {
          effectivePaidAt = r.created_at || r.members?.created_at || r.paid_at;
        }
        return { ...r, paid_at: effectivePaidAt };
      });
    },
  });

  // Query profiles for staff name lookup (collected_by / marked_by attribution)
  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['dash-profiles'],
    enabled: role === 'admin',
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      return data ?? [];
    },
  });

  const staffMap: Record<string, string> = {};
  (staffProfiles as any[]).forEach((p) => { staffMap[p.id] = p.full_name || 'Staff'; });

  // ── Helper: parse walk-in PKR amount from notes string ("1-Day PKR 200")
  const parseWalkinAmount = (notes: string | null): number => {
    if (!notes) return 0;
    const match = notes.match(/PKR\s*([\d.]+)/i);
    return match ? Number(match[1]) || 0 : 0;
  };

  // ── Query: walk-in (1-day) attendance records that have guest_name set
  const { data: walkinRecords = [], isLoading: isWalkinLoading } = useQuery({
    queryKey: ['dash-walkin-records'],
    enabled: role === 'admin',
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('id, guest_name, notes, check_in, source, marked_by')
        .not('guest_name', 'is', null)
        .order('check_in', { ascending: false })
        .limit(500);
      // If the column doesn't exist yet (migration not run), return empty
      if (error?.code === '42703') return [];
      if (error) throw error;
      return (data ?? []).filter((w: any) => w.guest_name && w.guest_name.trim() !== '');
    },
  });

  // ── Walk-in stats for selected month
  const walkinThisMonth = walkinRecords.filter((w: any) => {
    const d = new Date(w.check_in);
    return d >= startOfMonth && d < startOfNextMonth;
  });
  const walkinMonthRevenue = walkinThisMonth.reduce((s: number, w: any) => s + parseWalkinAmount(w.notes), 0);
  const walkinAvgPerHead = walkinThisMonth.length > 0 ? Math.round(walkinMonthRevenue / walkinThisMonth.length) : 0;

  // ── Walk-ins today
  const walkinToday = walkinRecords.filter((w: any) => isToday(w.check_in));
  const walkinTodayRevenue = walkinToday.reduce((s: number, w: any) => s + parseWalkinAmount(w.notes), 0);

  // Delete walk-in attendance record
  const deleteWalkin = async (id: string) => {
    if (!confirm('Are you sure you want to remove this walk-in visitor record?')) return;
    setDeletingWalkinId(id);
    try {
      const res = await fetch(`/api/attendance?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        // Fallback to client SDK delete
        const { error } = await supabase.from('attendance').delete().eq('id', id);
        if (error) throw new Error(data.error || error.message);
      }
      toast.success('Walk-in record removed');
      queryClient.invalidateQueries({ queryKey: ['dash-walkin-records'] });
      queryClient.invalidateQueries({ queryKey: ['dash-recent-payment-records'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove walk-in');
    } finally {
      setDeletingWalkinId(null);
    }
  };

  // Fee records for the month with parallel member fetch and non-blocking background persistence
  const { data: fees = [], isLoading: isFeesLoading } = useQuery({
    queryKey: ['dash-fees', monthStart, monthEnd],
    enabled: role === 'admin',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      // Fetch both existing fee records and active members concurrently
      const [{ data: existingFees, error: feeErr }, { data: activeMembers, error: memErr }] = await Promise.all([
        supabase
          .from('fee_records')
          .select('id, amount, amount_paid, paid, paid_at, member_id, period_month, period_end, collected_by, members(full_name, phone, join_date, tenure_months, amount_paid, monthly_fee, training_fees)')
          .gte('period_month', monthStart)
          .lt('period_month', monthEnd)
          .order('paid', { ascending: false }),
        supabase
          .from('members')
          .select('id, full_name, phone, join_date, tenure_months, monthly_fee, training_fees, amount_paid, active')
          .lte('join_date', monthEnd)
      ]);

      if (feeErr) throw feeErr;

      let feeList = (existingFees ?? []).map((f: any) => {
        const m = f.members;
        if (m && m.join_date) {
          const [jY, jM] = m.join_date.split('-').map(Number);
          if (jY && jM) {
            const tenure = Math.max(1, Number(m.tenure_months) || 1);
            const lastTenureDate = new Date(jY, jM - 1 + tenure - 1, 1);
            const lastTenurePeriod = `${lastTenureDate.getFullYear()}-${String(lastTenureDate.getMonth() + 1).padStart(2, '0')}-01`;

            // If this month is after the registration tenure and not collected manually, it is unpaid
            if (f.period_month > lastTenurePeriod && f.collected_by == null && (f.paid || Number(f.amount_paid) > 0)) {
              return { ...f, paid: false, amount_paid: 0, paid_at: null };
            }
          }
        }
        return f;
      });

      // Auto-heal missing paid_at in background without blocking query return
      const missingPaidAt = feeList.filter((f: any) => (Number(f.amount_paid) || 0) > 0 && !f.paid_at);
      if (missingPaidAt.length > 0) {
        const idsToUpdate = missingPaidAt.map((f: any) => f.id);
        const fallbackIso = `${monthStart}T12:00:00.000Z`;
        supabase.from('fee_records').update({ paid_at: fallbackIso }).in('id', idsToUpdate).then();
        feeList = feeList.map((f: any) => (idsToUpdate.includes(f.id) ? { ...f, paid_at: fallbackIso } : f));
      }

      // Check if any active member lacks a fee record for this month
      if (activeMembers && activeMembers.length > 0) {
        const existingMemberIds = new Set(feeList.map((f: any) => f.member_id));
        const missingMembers = activeMembers.filter((m: any) => !existingMemberIds.has(m.id));

        if (missingMembers.length > 0) {
          const lastDay = new Date(year, month, 0).getDate();
          const periodEndStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

          const newRecords = missingMembers.map((m: any) => {
            const totalFee = (Number(m.monthly_fee) || 0) + (Number(m.training_fees) || 0);
            const paidAmount = Number(m.amount_paid) || 0;
            const isJoinedInThisMonth = m.join_date >= monthStart && m.join_date < monthEnd;
            const actualPaid = isJoinedInThisMonth ? paidAmount : 0;
            const isPaid = isJoinedInThisMonth ? actualPaid >= totalFee && totalFee > 0 : false;

            return {
              member_id: m.id,
              amount: totalFee,
              amount_paid: actualPaid,
              period_month: monthStart,
              period_end: periodEndStr,
              paid: isPaid,
              paid_at: actualPaid > 0 ? (m.join_date ? `${m.join_date}T12:00:00.000Z` : `${monthStart}T12:00:00.000Z`) : null,
              payment_method: 'cash',
              members: { full_name: m.full_name, phone: m.phone }
            };
          });

          // Non-blocking background persistence
          supabase
            .from('fee_records')
            .upsert(newRecords.map(({ members, ...r }) => r), { onConflict: 'member_id,period_month', ignoreDuplicates: true })
            .then();

          feeList = [...feeList, ...newRecords];
        }
      }

      return feeList;
    },
  });

  // Expenses for the month
  const { data: expenses = [], isLoading: isExpensesLoading } = useQuery({
    queryKey: ['dash-expenses', monthStart, monthEnd],
    enabled: role === 'admin',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, category, expense_date, name')
        .eq('is_reserve', false)
        .gte('expense_date', monthStart)
        .lt('expense_date', monthEnd)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Trend data
  const { data: trendData = [], isLoading: isTrendLoading } = useQuery({
    queryKey: ['dash-trend', selectedMonth, trendMonths],
    enabled: role === 'admin',
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      const months: { key: string; label: string; revenue: number; expenses: number; profit: number }[] = [];
      const map = new Map<string, typeof months[0]>();

      for (let i = trendMonths - 1; i >= 0; i--) {
        const d = new Date(year, month - 1 - i, 1);
        const y = d.getFullYear();
        const mStr = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${mStr}`;
        const entry = { key, label: formatMonthYear(d), revenue: 0, expenses: 0, profit: 0 };
        months.push(entry);
        map.set(key, entry);
      }

      const startKey = months[0].key + '-01';
      const endNextMonth = month === 12 ? 1 : month + 1;
      const endNextYear = month === 12 ? year + 1 : year;
      const endKey = `${endNextYear}-${String(endNextMonth).padStart(2, '0')}-01`;

      const [{ data: feeData }, { data: expData }] = await Promise.all([
        supabase
          .from('fee_records')
          .select('amount, amount_paid, paid, paid_at, period_month')
          .gte('period_month', startKey)
          .lt('period_month', endKey),
        supabase
          .from('expenses')
          .select('amount, expense_date')
          .eq('is_reserve', false)
          .gte('expense_date', startKey)
          .lt('expense_date', endKey),
      ]);

      feeData?.forEach((r) => {
        const amtPaid = Number(r.amount_paid);
        const actualCollected = (!isNaN(amtPaid) && amtPaid > 0) ? amtPaid : (r.paid ? Number(r.amount) || 0 : 0);
        if (actualCollected <= 0) return;

        const key = r.period_month ? r.period_month.slice(0, 7) : (r.paid_at ? r.paid_at.slice(0, 7) : null);
        if (!key) return;
        const entry = map.get(key);
        if (entry) entry.revenue += actualCollected;
      });
      expData?.forEach((r) => {
        if (!r.expense_date) return;
        const entry = map.get(r.expense_date.slice(0, 7));
        if (entry) entry.expenses += Number(r.amount);
      });
      months.forEach((m) => (m.profit = m.revenue - m.expenses));
      return months;
    },
  });

  // Active members count
  const { data: activeMembers, isLoading: isActiveLoading } = useQuery({
    queryKey: ['dash-active', selectedMonth],
    enabled: role === 'admin',
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      const endCurrent = new Date(year, month, 0).toISOString().slice(0, 10);
      const endPrev = new Date(year, month - 1, 0).toISOString().slice(0, 10);
      const [{ count: current }, { count: previous }] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('active', true).lte('join_date', endCurrent),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('active', true).lte('join_date', endPrev),
      ]);
      return { current: current ?? 0, previous: previous ?? 0 };
    },
  });

  const totalRevenue = fees.reduce((s: number, f: any) => {
    const paidAmt = Number(f.amount_paid);
    if (!isNaN(paidAmt) && paidAmt > 0) return s + paidAmt;
    return s + (f.paid ? Number(f.amount) || 0 : 0);
  }, 0) + walkinMonthRevenue;

  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const reserve = netProfit > 0 ? (netProfit * (settings?.reserve_percentage || 0) / 100) : 0;
  const fullyPaidCount = fees.filter((f: any) => f.paid || (Number(f.amount_paid) >= Number(f.amount) && Number(f.amount) > 0)).length;
  const partiallyPaidCount = fees.filter((f: any) => !f.paid && Number(f.amount_paid) > 0 && Number(f.amount_paid) < Number(f.amount)).length;
  const unpaidCount = fees.filter((f: any) => !f.paid && (Number(f.amount_paid) || 0) === 0).length;

  // Payments calculations for Today's Card & Modal
  const allWalkinPayments = walkinRecords.map((w: any) => ({
    id: `walkin-${w.id}`,
    _isWalkin: true,
    guest_name: w.guest_name,
    amount: parseWalkinAmount(w.notes),
    amount_paid: parseWalkinAmount(w.notes),
    paid: true,
    paid_at: w.check_in,
    payment_method: 'cash',
    collected_by: w.marked_by || null,
    members: null,
  }));

  const combinedPaymentRecords = [
    ...allPaymentRecords,
    ...allWalkinPayments,
  ].sort((a: any, b: any) => {
    const timeA = a.paid_at ? new Date(a.paid_at).getTime() : 0;
    const timeB = b.paid_at ? new Date(b.paid_at).getTime() : 0;
    return timeB - timeA;
  });

  const todayPayments = combinedPaymentRecords.filter((f: any) => isToday(f.paid_at));

  const todayTotalCollected = todayPayments.reduce((sum: number, f: any) => {
    const amtPaid = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
    return sum + amtPaid;
  }, 0);

  const filteredModalPayments = combinedPaymentRecords.filter((f: any) => {
    if (!f.paid_at) return false;
    const d = new Date(f.paid_at);
    const [y, mo, day] = modalDate.split('-').map(Number);
    return (
      d.getFullYear() === y &&
      d.getMonth() + 1 === mo &&
      d.getDate() === day
    );
  });

  const modalTotalCollected = filteredModalPayments.reduce((sum: number, f: any) => {
    const amtPaid = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
    return sum + amtPaid;
  }, 0);

  const modalFullCount = filteredModalPayments.filter((f: any) => {
    const amtPaid = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
    return f.paid || (amtPaid >= Number(f.amount) && Number(f.amount) > 0);
  }).length;

  const modalPartialCount = filteredModalPayments.length - modalFullCount;

  // Expense breakdown by category
  const expenseByCategory = expenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
  
  const categoryColors: Record<string, string> = { rent: '#64748b', utility: '#3b82f6', salary: '#a855f7', maintenance: '#f97316', equipment: '#06b6d4', misc: '#6b7280' };
  const categories = ["misc", "salary", "rent", "maintenance", "utility"];

  const expenseChartData = categories.map((cat) => ({
    category: cat,
    amount: expenseByCategory[cat] || 0
  }));

  // Month options (safely anchored to day 1 to prevent day-of-month rollover duplicates)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { value: val, label: formatMonthYear(d) };
  });

  const memberGrowth = activeMembers ? ((activeMembers.current - activeMembers.previous) / Math.max(activeMembers.previous, 1)) * 100 : 0;

  // Loading flags for smooth UI coordination
  const isFinancialLoading = isFeesLoading || isExpensesLoading || isWalkinLoading;
  const isPaymentsSummaryLoading = isPaymentsLoading || isWalkinLoading;

  if (isRoleLoading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-44" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (role !== 'admin') return null;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Financial overview and analytics</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Daily Payments Banner */}
      <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20 grid place-items-center shrink-0">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Today's Collections</p>
            {isPaymentsSummaryLoading ? (
              <div className="py-1">
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-3.5 w-28 mt-1.5" />
              </div>
            ) : (
              <>
                <p className="text-3xl font-display font-bold text-primary">
                  <AnimatedNumber value={todayTotalCollected} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {todayPayments.length} {todayPayments.length === 1 ? 'payment' : 'payments'} received today
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Full Payments</p>
            {isPaymentsSummaryLoading ? (
              <Skeleton className="h-6 w-10 ml-auto mt-1" />
            ) : (
              <p className="text-xl font-bold text-emerald-400">
                {todayPayments.filter((f: any) => {
                  const a = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
                  return f.paid || (a >= Number(f.amount) && Number(f.amount) > 0);
                }).length}
              </p>
            )}
          </div>
          <div className="w-px h-10 bg-border/50" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Partial</p>
            {isPaymentsSummaryLoading ? (
              <Skeleton className="h-6 w-10 ml-auto mt-1" />
            ) : (
              <p className="text-xl font-bold text-amber-400">
                {todayPayments.filter((f: any) => {
                  const a = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
                  return !f.paid && a > 0 && a < Number(f.amount);
                }).length}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setModalDate(getTodayLocalDateString()); setIsModalOpen(true); }}
            className="ml-2 border-primary/30 text-primary hover:bg-primary/10 text-xs"
          >
            View Details <ArrowUpRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        {/* decorative glow */}
        <div className="pointer-events-none absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-primary/5 to-transparent" />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Revenue */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-lime-500/20 grid place-items-center"><Wallet className="h-5 w-5 text-lime-400" /></div>
              <ArrowUpRight className="h-4 w-4 text-lime-400" />
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Revenue</p>
              {isFinancialLoading ? (
                <Skeleton className="h-7 w-32 mt-1.5" />
              ) : (
                <p className="text-2xl font-display font-bold"><AnimatedNumber value={totalRevenue} format={formatCurrency} /></p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-red-500/20 grid place-items-center"><Receipt className="h-5 w-5 text-red-400" /></div>
              <ArrowDownRight className="h-4 w-4 text-red-400" />
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Expenses</p>
              {isExpensesLoading ? (
                <Skeleton className="h-7 w-32 mt-1.5" />
              ) : (
                <p className="text-2xl font-display font-bold"><AnimatedNumber value={totalExpenses} format={formatCurrency} /></p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className={`h-10 w-10 rounded-lg grid place-items-center ${netProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <Zap className={`h-5 w-5 ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`} />
              </div>
              {netProfit >= 0 ? <ArrowUpRight className="h-4 w-4 text-green-400" /> : <ArrowDownRight className="h-4 w-4 text-red-400" />}
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Net Profit</p>
              {isFinancialLoading ? (
                <Skeleton className="h-7 w-32 mt-1.5" />
              ) : (
                <p className="text-2xl font-display font-bold"><AnimatedNumber value={netProfit - reserve} format={formatCurrency} /></p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Members */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 grid place-items-center"><UserCheck className="h-5 w-5 text-blue-400" /></div>
              {memberGrowth >= 0 ? <ArrowUpRight className="h-4 w-4 text-blue-400" /> : <ArrowDownRight className="h-4 w-4 text-red-400" />}
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Active Members</p>
              {isActiveLoading ? (
                <Skeleton className="h-7 w-20 mt-1.5" />
              ) : (
                <p className="text-2xl font-display font-bold"><AnimatedNumber value={activeMembers?.current ?? 0} format={(n) => String(n)} /></p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reserve */}
        {(settings?.reserve_percentage ?? 0) > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 grid place-items-center"><Landmark className="h-5 w-5 text-emerald-400" /></div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Reserve (This Month)</p>
                {isFinancialLoading ? (
                  <Skeleton className="h-7 w-28 mt-1.5" />
                ) : (
                  <p className="text-2xl font-display font-bold"><AnimatedNumber value={netProfit > 0 ? (netProfit * (settings?.reserve_percentage || 0) / 100) : 0} format={formatCurrency} /></p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base"><TrendingUp className="inline h-4 w-4 mr-2" />Revenue vs Expenses</CardTitle>
            <div className="flex gap-1">
              {[3, 6, 12, 24].map((n) => (
                <button
                  key={n}
                  onClick={() => setTrendMonths(n)}
                  className={cn('px-2 py-1 rounded text-xs font-medium transition-colors', trendMonths === n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
                >{n}m</button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isTrendLoading ? (
                <div className="h-full w-full flex items-center justify-center p-4">
                  <Skeleton className="h-full w-full rounded-lg" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a3e635" stopOpacity={0.3} /><stop offset="95%" stopColor="#a3e635" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f24" />
                    <XAxis dataKey="label" tick={{ fill: '#8c8c8c', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#8c8c8c', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid #1f1f24', borderRadius: 8, color: '#fafafa' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#a3e635" fill="url(#gRev)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#gExp)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fee Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base"><Target className="inline h-4 w-4 mr-2" />Fee Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {isFeesLoading ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <Skeleton className="h-32 w-32 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Paid', value: fullyPaidCount },
                        { name: 'Partially Paid', value: partiallyPaidCount },
                        { name: 'Unpaid', value: unpaidCount },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {PIE_COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid #1f1f24', borderRadius: 8, color: '#fafafa' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Walk-in Customers Card */}
      <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Left: header */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 grid place-items-center shrink-0">
                <UserCheck className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Walk-in / 1-Day Customers</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsWalkinModalOpen(true)}
                    className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 font-medium"
                  >
                    View All ({walkinThisMonth.length}) <ArrowUpRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Daily pass visitors for {new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            {/* Right: stats */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setIsWalkinModalOpen(true)} title="Click to view all walk-in visitors">
                {isWalkinLoading ? (
                  <Skeleton className="h-7 w-12 mx-auto" />
                ) : (
                  <p className="text-2xl font-display font-bold text-amber-400">{walkinThisMonth.length}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">Total (This Month)</p>
              </div>
              <div className="w-px h-10 bg-border/50 hidden sm:block" />
              <div className="text-center">
                {isWalkinLoading ? (
                  <Skeleton className="h-7 w-20 mx-auto" />
                ) : (
                  <p className="text-2xl font-display font-bold text-primary">{formatCurrency(walkinMonthRevenue)}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">Walk-in Revenue</p>
              </div>
              <div className="w-px h-10 bg-border/50 hidden sm:block" />
              <div className="text-center">
                {isWalkinLoading ? (
                  <Skeleton className="h-7 w-16 mx-auto" />
                ) : (
                  <p className="text-2xl font-display font-bold text-emerald-400">{walkinAvgPerHead > 0 ? formatCurrency(walkinAvgPerHead) : '—'}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">Avg Per Head</p>
              </div>
              <div className="w-px h-10 bg-border/50 hidden sm:block" />
              <div className="text-center">
                {isWalkinLoading ? (
                  <Skeleton className="h-7 w-12 mx-auto" />
                ) : (
                  <p className="text-2xl font-display font-bold text-violet-400">{walkinToday.length}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">Today's Walk-ins</p>
              </div>
            </div>
          </div>
          {/* Today's walk-in list */}
          {walkinToday.length > 0 && (
            <div className="mt-4 pt-3 border-t border-amber-500/15">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Today's Walk-in Visitors</p>
                {walkinThisMonth.length > walkinToday.length && (
                  <button
                    onClick={() => setIsWalkinModalOpen(true)}
                    className="text-xs text-muted-foreground hover:text-amber-400 transition-colors"
                  >
                    + {walkinThisMonth.length - walkinToday.length} more recorded this month →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {walkinToday.map((w: any) => {
                  const amt = parseWalkinAmount(w.notes);
                  return (
                    <div key={w.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/8 border border-amber-500/15 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-amber-500/20 grid place-items-center text-[10px] font-bold text-amber-400">
                          {(w.guest_name || 'G').slice(0, 1).toUpperCase()}
                        </div>
                        <span className="font-medium">{w.guest_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-primary">{amt > 0 ? formatCurrency(amt) : 'Free'}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-red-400 p-0"
                          title="Delete record"
                          disabled={deletingWalkinId === w.id}
                          onClick={() => deleteWalkin(w.id)}
                        >
                          <Trash2 className="h-3 w-3 text-red-400/70 hover:text-red-400" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!isWalkinLoading && walkinThisMonth.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">No walk-in visitors recorded this month. Use the <strong>1 Day</strong> button on the Attendance page to add them.</p>
          )}
        </CardContent>
      </Card>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Payments */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Today's Payments
              {!isPaymentsSummaryLoading && todayPayments.length > 0 && (
                <span className="ml-1 text-xs bg-primary/15 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-medium">
                  {todayPayments.length}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setModalDate(getTodayLocalDateString());
                setIsModalOpen(true);
              }}
              className="text-xs text-primary hover:text-primary hover:bg-primary/10 h-7 px-2 font-medium"
            >
              Full History <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isPaymentsSummaryLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <Skeleton className="h-4 w-16 ml-auto" />
                      <Skeleton className="h-3 w-10 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            ) : todayPayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground px-6">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No payments received today</p>
                <p className="text-xs mt-1 opacity-70">Payments will appear here as they are collected</p>
              </div>
            ) : (
              <>
                {/* Daily total bar */}
                <div className="px-5 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Total Collected Today</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(todayTotalCollected)}</span>
                </div>
                {/* Scrollable list — show ALL today's payments */}
                <div className="max-h-[280px] overflow-y-auto divide-y divide-border/40">
                  {todayPayments.map((f: any) => {
                    const isWalkin = !!f._isWalkin;
                    const memberData = f.members as any;
                    const displayName = isWalkin
                      ? (f.guest_name || 'Walk-in Guest')
                      : (memberData?.full_name ?? 'Unknown Member');
                    const memberNumber = !isWalkin && memberData?.member_number ? `#${memberData.member_number}` : null;
                    const memberPhoto = !isWalkin ? memberData?.photo_url : null;
                    const amtPaid = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
                    const totalAmount = Number(f.amount) || 0;
                    const isFullyPaid = f.paid || (amtPaid >= totalAmount && totalAmount > 0);
                    const isPartial = !isFullyPaid && amtPaid > 0;
                    const receivedBy = f.collected_by ? staffMap[f.collected_by] : null;

                    return (
                      <div key={f.id} className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-3">
                          {/* Member Photo / Avatar */}
                          {memberPhoto ? (
                            <button
                              type="button"
                              onClick={() => openFullPhoto(memberPhoto, displayName, memberNumber || undefined)}
                              className="group relative rounded-full shrink-0 overflow-hidden ring-2 ring-transparent hover:ring-primary/50 transition-all"
                              title="Click to view photo"
                            >
                              <img src={memberPhoto} alt={displayName} className="h-9 w-9 rounded-full object-cover border border-border group-hover:scale-110 transition-transform" />
                            </button>
                          ) : (
                            <div className={`h-9 w-9 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                              isWalkin ? 'bg-amber-500/20 text-amber-400' :
                              isFullyPaid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                            }`}>
                              {displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-medium">{displayName}</p>
                              {memberNumber && (
                                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-mono font-medium">{memberNumber}</span>
                              )}
                              {isWalkin && (
                                <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5 font-medium">1-Day</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <p className="text-xs text-muted-foreground font-mono">{formatPaymentTime(f.paid_at)}</p>
                              {f.payment_method && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono">
                                  {f.payment_method}
                                </span>
                              )}
                              {receivedBy && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" />{receivedBy}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-primary">{amtPaid > 0 ? formatCurrency(amtPaid) : '—'}</p>
                          {isPartial ? (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">of {formatCurrency(totalAmount)}</span>
                              <Badge variant="warning" className="text-[10px] px-1.5 py-0">Partial</Badge>
                            </div>
                          ) : (
                            <Badge variant="success" className="text-[10px] px-1.5 py-0 mt-0.5">Paid</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base"><Receipt className="inline h-4 w-4 mr-2" />Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isExpensesLoading ? (
                <div className="h-full w-full flex items-center justify-center p-4">
                  <Skeleton className="h-full w-full rounded-lg" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f24" />
                    <XAxis dataKey="category" tick={{ fill: '#8c8c8c', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#8c8c8c', fontSize: 12 }} />
                    <Tooltip cursor={false} contentStyle={{ background: '#0c0c0e', border: '1px solid #1f1f24', borderRadius: 8, color: '#fafafa' }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={48} activeBar={false}>
                      {expenseChartData.map((entry, i) => (
                        <Cell key={i} fill={categoryColors[entry.category] || '#6b7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Details Popup Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Payment History Details
            </DialogTitle>
            <DialogDescription>
              Review detailed payment transactions, filter by timeframe, and track partial or full collections.
            </DialogDescription>
          </DialogHeader>

          {/* Date Picker */}
          <div className="flex items-center gap-2 my-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground font-medium shrink-0">
              <Calendar className="h-4 w-4" />
              Select Date
            </label>
            <input
              type="date"
              value={modalDate}
              max={getTodayLocalDateString()}
              onChange={(e) => setModalDate(e.target.value)}
              className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setModalDate(getTodayLocalDateString())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 underline underline-offset-2"
            >
              Today
            </button>
          </div>

          {/* Summary Cards Row inside Modal */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-card border border-border/60 rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-medium">Total Collected</p>
              <p className="text-lg font-bold text-primary mt-0.5">{formatCurrency(modalTotalCollected)}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-medium">Full Payments</p>
              <p className="text-lg font-bold text-green-400 mt-0.5">{modalFullCount}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3">
              <p className="text-[11px] text-muted-foreground uppercase font-medium">Partial Payments</p>
              <p className="text-lg font-bold text-yellow-400 mt-0.5">{modalPartialCount}</p>
            </div>
          </div>

          {/* Payment Records List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[360px] min-h-[200px]">
            {filteredModalPayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No payments found for this period</p>
              </div>
            ) : (
              filteredModalPayments.map((f: any) => {
                const isWalkin = !!f._isWalkin;
                const memberData = f.members as any;
                const displayName = isWalkin
                  ? (f.guest_name || '1-Day Guest')
                  : (memberData?.full_name ?? 'Unknown Member');
                const memberNumber = !isWalkin && memberData?.member_number ? `#${memberData.member_number}` : null;
                const memberPhoto = !isWalkin ? memberData?.photo_url : null;
                const amtPaid = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
                const totalAmount = Number(f.amount) || 0;
                const remaining = Math.max(0, totalAmount - amtPaid);
                const isFullyPaid = f.paid || (amtPaid >= totalAmount && totalAmount > 0);
                const isPartial = !isFullyPaid && amtPaid > 0;
                const receivedBy = f.collected_by ? staffMap[f.collected_by] : null;

                return (
                  <div
                    key={f.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border/50 bg-accent/20 hover:bg-accent/40 transition-colors gap-2"
                  >
                    <div className="flex items-center gap-3">
                      {/* Member Photo / Avatar */}
                      {memberPhoto ? (
                        <button
                          type="button"
                          onClick={() => openFullPhoto(memberPhoto, displayName, memberNumber || undefined)}
                          className="group relative rounded-full shrink-0 overflow-hidden ring-2 ring-transparent hover:ring-primary/50 transition-all"
                          title="Click to view photo"
                        >
                          <img src={memberPhoto} alt={displayName} className="h-10 w-10 rounded-full object-cover border border-border group-hover:scale-110 transition-transform" />
                        </button>
                      ) : (
                        <div className={`h-10 w-10 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                          isWalkin ? 'bg-amber-500/20 text-amber-400' :
                          isFullyPaid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <p className="text-sm font-semibold">{displayName}</p>
                          {memberNumber && (
                            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 font-mono font-medium">{memberNumber}</span>
                          )}
                          {isWalkin ? (
                            <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5 font-medium">1-Day</span>
                          ) : (
                            memberData?.phone && (
                              <span className="text-xs text-muted-foreground">({memberData.phone})</span>
                            )
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatPaymentDateTime(f.paid_at)}</span>
                          {f.payment_method && (
                            <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase font-mono text-muted-foreground">
                              {f.payment_method}
                            </span>
                          )}
                          {receivedBy && (
                            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <User className="h-3 w-3 shrink-0" />
                              {receivedBy}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="sm:text-right flex sm:flex-col justify-between items-end gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">{formatCurrency(amtPaid)}</span>
                        {isPartial ? (
                          <Badge variant="warning" className="text-[10px]">Partial</Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">Paid</Badge>
                        )}
                      </div>
                      {isPartial && (
                        <p className="text-[11px] text-muted-foreground">
                          Total: {formatCurrency(totalAmount)} • <span className="text-red-400">Due: {formatCurrency(remaining)}</span>
                        </p>
                      )}
                      {isFullyPaid && totalAmount > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          {isWalkin ? '1-Day Fee' : `Total Fee: ${formatCurrency(totalAmount)}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>


          <DialogFooter className="mt-4 pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Walk-in Visitors History Modal ── */}
      <Dialog open={isWalkinModalOpen} onOpenChange={setIsWalkinModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 grid place-items-center">
                  <UserCheck className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg">
                    Walk-in Visitors — {new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    All 1-day pass entries for this month ({walkinThisMonth.length} total)
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Quick stats banner */}
          <div className="grid grid-cols-3 gap-2 my-2">
            <div className="bg-card border border-border/60 rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground uppercase font-medium">Month Total</p>
              <p className="text-lg font-bold text-amber-400 mt-0.5">{walkinThisMonth.length}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground uppercase font-medium">Today</p>
              <p className="text-lg font-bold text-violet-400 mt-0.5">{walkinToday.length}</p>
            </div>
            <div className="bg-card border border-border/60 rounded-lg p-3 text-center">
              <p className="text-[11px] text-muted-foreground uppercase font-medium">Total Revenue</p>
              <p className="text-lg font-bold text-primary mt-0.5">{formatCurrency(walkinMonthRevenue)}</p>
            </div>
          </div>

          {/* Records List */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[380px] min-h-[160px]">
            {walkinThisMonth.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-30 text-amber-400" />
                <p className="text-sm font-medium">No walk-in visitors for this month</p>
              </div>
            ) : (
              walkinThisMonth.map((w: any) => {
                const amt = parseWalkinAmount(w.notes);
                const isItemToday = isToday(w.check_in);
                return (
                  <div
                    key={w.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-amber-500/20 grid place-items-center text-xs font-bold text-amber-400 shrink-0">
                        {(w.guest_name || 'G').slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{w.guest_name}</p>
                          <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5 font-medium">
                            1-Day Pass
                          </span>
                          {isItemToday && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 py-0">
                              Today
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Calendar className="h-3 w-3 inline opacity-70" />
                          {formatWalkinRelativeDate(w.check_in)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-primary">
                        {amt > 0 ? formatCurrency(amt) : 'Free'}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        title="Delete this record"
                        disabled={deletingWalkinId === w.id}
                        onClick={() => deleteWalkin(w.id)}
                      >
                        {deletingWalkinId === w.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-red-400/80 hover:text-red-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsWalkinModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-size Member Photo Lightbox */}
      <PhotoPreviewDialog
        open={photoPreview.open}
        onOpenChange={(open) => setPhotoPreview((prev) => ({ ...prev, open }))}
        photoUrl={photoPreview.photoUrl}
        title={photoPreview.title}
        subtitle={photoPreview.subtitle}
      />
    </div>
  );
}
