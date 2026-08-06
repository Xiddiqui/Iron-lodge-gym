'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format';
import { useGymSettings } from '@/hooks/use-gym-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wallet, Receipt, Zap, UserCheck, ArrowUpRight, ArrowDownRight, TrendingUp, Target, History, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const motionVal = useMotionValue(0);
  const display = useTransform(motionVal, (v) => format(Math.round(v)));
  useEffect(() => {
    const controls = animate(motionVal, value, { duration: 1.1, ease: 'easeOut' });
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
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPaymentTime(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const CHART_COLORS = { revenue: '#a3e635', expenses: '#ef4444', profit: '#22c55e' };
const PIE_COLORS = ['#a3e635', '#f97316', '#ef4444'];

export default function DashboardPage() {
  const { data: role } = useRole();
  const { data: settings } = useGymSettings();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [trendMonths, setTrendMonths] = useState(6);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState<'today' | '7days' | '30days'>('today');

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthStart = `${selectedMonth}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Query for recent payment records (Today's payments & modal history)
  const { data: allPaymentRecords = [] } = useQuery({
    queryKey: ['dash-recent-payment-records'],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_records')
        .select('id, amount, amount_paid, paid, paid_at, payment_method, member_id, period_month, period_end, members(full_name, phone)')
        .or('paid.eq.true,amount_paid.gt.0')
        .order('paid_at', { ascending: false, nullsFirst: false })
        .limit(300);

      if (error) throw error;
      return data ?? [];
    },
  });

  // Fee records for the month with auto-sync for missing member records
  const { data: fees = [] } = useQuery({
    queryKey: ['dash-fees', monthStart, monthEnd],
    enabled: role === 'admin',
    queryFn: async () => {
      // 1. Get existing fee records for selected month
      const { data: existingFees, error } = await supabase
        .from('fee_records')
        .select('id, amount, amount_paid, paid, paid_at, member_id, period_month, period_end, members(full_name, phone)')
        .gte('period_month', monthStart)
        .lt('period_month', monthEnd)
        .order('paid', { ascending: false });

      if (error) throw error;
      let feeList = existingFees ?? [];

      // Auto-heal missing paid_at for records with amount_paid > 0
      const missingPaidAt = feeList.filter((f: any) => (Number(f.amount_paid) || 0) > 0 && !f.paid_at);
      if (missingPaidAt.length > 0) {
        const idsToUpdate = missingPaidAt.map((f: any) => f.id);
        const nowIso = new Date().toISOString();
        await supabase.from('fee_records').update({ paid_at: nowIso }).in('id', idsToUpdate);
        feeList = feeList.map((f: any) => (idsToUpdate.includes(f.id) ? { ...f, paid_at: nowIso } : f));
      }

      // 2. Fetch members joined on or before monthEnd to check if any active member lacks a fee_record for this month
      const { data: activeMembers } = await supabase
        .from('members')
        .select('*')
        .lte('join_date', monthEnd);

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
              paid_at: actualPaid > 0 ? (m.created_at || new Date().toISOString()) : null,
              payment_method: 'cash',
            };
          });

          const { data: insertedRecords } = await supabase
            .from('fee_records')
            .upsert(newRecords, { onConflict: 'member_id,period_month', ignoreDuplicates: true })
            .select('id, amount, amount_paid, paid, paid_at, member_id, period_month, period_end, members(full_name, phone)');

          if (insertedRecords && insertedRecords.length > 0) {
            feeList = [...feeList, ...insertedRecords];
          }
        }
      }

      return feeList;
    },
  });

  // Expenses for the month
  const { data: expenses = [] } = useQuery({
    queryKey: ['dash-expenses', monthStart, monthEnd],
    enabled: role === 'admin',
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
  const { data: trendData = [] } = useQuery({
    queryKey: ['dash-trend', selectedMonth, trendMonths],
    enabled: role === 'admin',
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

        const key = r.paid_at ? r.paid_at.slice(0, 7) : r.period_month ? r.period_month.slice(0, 7) : null;
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
  const { data: activeMembers } = useQuery({
    queryKey: ['dash-active', selectedMonth],
    enabled: role === 'admin',
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
  }, 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const reserve = netProfit > 0 ? (netProfit * (settings?.reserve_percentage || 0) / 100) : 0
  const fullyPaidCount = fees.filter((f: any) => f.paid || (Number(f.amount_paid) >= Number(f.amount) && Number(f.amount) > 0)).length;
  const partiallyPaidCount = fees.filter((f: any) => !f.paid && Number(f.amount_paid) > 0 && Number(f.amount_paid) < Number(f.amount)).length;
  const unpaidCount = fees.filter((f: any) => !f.paid && (Number(f.amount_paid) || 0) === 0).length;

  // Payments calculations for Today's Card & Modal
  const todayPayments = allPaymentRecords.filter((f: any) => isToday(f.paid_at));
  const todayTotalCollected = todayPayments.reduce((sum: number, f: any) => {
    const amtPaid = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
    return sum + amtPaid;
  }, 0);

  const filteredModalPayments = allPaymentRecords.filter((f: any) => {
    if (modalFilter === 'today') return isToday(f.paid_at);
    if (modalFilter === '7days') return isPastNDays(f.paid_at, 7);
    if (modalFilter === '30days') return isPastNDays(f.paid_at, 30);
    return true;
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

  // Month options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return { value: d.toISOString().slice(0, 7), label: formatMonthYear(d) };
  });

  const memberGrowth = activeMembers ? ((activeMembers.current - activeMembers.previous) / Math.max(activeMembers.previous, 1)) * 100 : 0;

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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-lime-500/20 grid place-items-center"><Wallet className="h-5 w-5 text-lime-400" /></div>
              <ArrowUpRight className="h-4 w-4 text-lime-400" />
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="text-2xl font-display font-bold"><AnimatedNumber value={totalRevenue} format={formatCurrency} /></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-red-500/20 grid place-items-center"><Receipt className="h-5 w-5 text-red-400" /></div>
              <ArrowDownRight className="h-4 w-4 text-red-400" />
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="text-2xl font-display font-bold"><AnimatedNumber value={totalExpenses} format={formatCurrency} /></p>
            </div>
          </CardContent>
        </Card>
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
              <p className="text-2xl font-display font-bold"><AnimatedNumber value={netProfit - reserve} format={formatCurrency} /></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 grid place-items-center"><UserCheck className="h-5 w-5 text-blue-400" /></div>
              {memberGrowth >= 0 ? <ArrowUpRight className="h-4 w-4 text-blue-400" /> : <ArrowDownRight className="h-4 w-4 text-red-400" />}
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-2xl font-display font-bold"><AnimatedNumber value={activeMembers?.current ?? 0} format={(n) => String(n)} /></p>
            </div>
          </CardContent>
        </Card>
        {(settings?.reserve_percentage ?? 0) > 0 && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 grid place-items-center"><Landmark className="h-5 w-5 text-emerald-400" /></div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Reserve (This Month)</p>
                <p className="text-2xl font-display font-bold"><AnimatedNumber value={netProfit > 0 ? (netProfit * (settings?.reserve_percentage || 0) / 100) : 0} format={formatCurrency} /></p>
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Payments */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Today's Payments
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setModalFilter('today');
                setIsModalOpen(true);
              }}
              className="text-xs text-primary hover:text-primary hover:bg-primary/10 h-7 px-2 font-medium"
            >
              View All <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayPayments.slice(0, 5).map((f: any) => {
                const amtPaid = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
                const totalAmount = Number(f.amount) || 0;
                const isFullyPaid = f.paid || (amtPaid >= totalAmount && totalAmount > 0);
                const isPartial = !isFullyPaid && amtPaid > 0;

                return (
                  <div key={f.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{(f.members as any)?.full_name ?? 'Unknown Member'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{formatPaymentTime(f.paid_at)}</p>
                        {f.payment_method && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground uppercase font-mono">
                            {f.payment_method}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">{formatCurrency(amtPaid)}</p>
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

              {todayPayments.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40 text-muted-foreground" />
                  <p className="text-sm">No payments received today</p>
                </div>
              )}
            </div>

            {todayPayments.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <span>Today's Total ({todayPayments.length} {todayPayments.length === 1 ? 'payment' : 'payments'}):</span>
                <span className="font-bold text-primary text-sm">{formatCurrency(todayTotalCollected)}</span>
              </div>
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
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f24" />
                  <XAxis dataKey="category" tick={{ fill: '#8c8c8c', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8c8c8c', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid #1f1f24', borderRadius: 8, color: '#fafafa' }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {expenseChartData.map((entry, i) => (
                      <Cell width={70} key={i} fill={categoryColors[entry.category] || '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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

          {/* Filter Buttons */}
          <div className="flex items-center gap-2 my-3 p-1 bg-muted/50 rounded-lg border border-border/50">
            <button
              type="button"
              onClick={() => setModalFilter('today')}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer',
                modalFilter === 'today'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Today ({todayPayments.length})
            </button>
            <button
              type="button"
              onClick={() => setModalFilter('7days')}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer',
                modalFilter === '7days'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Past 7 Days ({allPaymentRecords.filter((f: any) => isPastNDays(f.paid_at, 7)).length})
            </button>
            <button
              type="button"
              onClick={() => setModalFilter('30days')}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer',
                modalFilter === '30days'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Past 30 Days ({allPaymentRecords.filter((f: any) => isPastNDays(f.paid_at, 30)).length})
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
                const amtPaid = Number(f.amount_paid) > 0 ? Number(f.amount_paid) : (f.paid ? Number(f.amount) || 0 : 0);
                const totalAmount = Number(f.amount) || 0;
                const remaining = Math.max(0, totalAmount - amtPaid);
                const isFullyPaid = f.paid || (amtPaid >= totalAmount && totalAmount > 0);
                const isPartial = !isFullyPaid && amtPaid > 0;

                return (
                  <div
                    key={f.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border/50 bg-accent/20 hover:bg-accent/40 transition-colors gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{(f.members as any)?.full_name ?? 'Unknown Member'}</p>
                        {(f.members as any)?.phone && (
                          <span className="text-xs text-muted-foreground">({(f.members as any)?.phone})</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatPaymentDateTime(f.paid_at)}</span>
                        {f.payment_method && (
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase font-mono text-muted-foreground">
                            {f.payment_method}
                          </span>
                        )}
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
                        <p className="text-[11px] text-muted-foreground">Total Fee: {formatCurrency(totalAmount)}</p>
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
    </div>
  );
}

