'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wallet, Receipt, Zap, UserCheck, ArrowUpRight, ArrowDownRight, TrendingUp, Target, History } from 'lucide-react';
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

const CHART_COLORS = { revenue: '#a3e635', expenses: '#ef4444', profit: '#22c55e' };
const PIE_COLORS = ['#a3e635', '#ef4444'];

export default function DashboardPage() {
  const { data: role } = useRole();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [trendMonths, setTrendMonths] = useState(6);

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthStart = `${selectedMonth}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Fee records for the month with auto-sync for missing member records
  const { data: fees = [] } = useQuery({
    queryKey: ['dash-fees', monthStart, monthEnd],
    enabled: role === 'admin',
    queryFn: async () => {
      // 1. Get existing fee records for selected month
      const { data: existingFees, error } = await supabase
        .from('fee_records')
        .select('id, amount, paid, paid_at, member_id, period_month, period_end, members(full_name, phone)')
        .gte('period_month', monthStart)
        .lt('period_month', monthEnd)
        .order('paid', { ascending: false });

      if (error) throw error;
      let feeList = existingFees ?? [];

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
            const paidAmount = m.amount_paid ?? totalFee;
            const isJoinedInThisMonth = m.join_date >= monthStart && m.join_date < monthEnd;
            const isPaid = isJoinedInThisMonth ? paidAmount >= totalFee && totalFee > 0 : false;

            return {
              member_id: m.id,
              amount: totalFee,
              period_month: monthStart,
              period_end: periodEndStr,
              paid: isPaid,
              paid_at: isPaid ? (m.created_at || new Date().toISOString()) : null,
              payment_method: 'cash',
            };
          });

          const { data: insertedRecords } = await supabase
            .from('fee_records')
            .upsert(newRecords, { onConflict: 'member_id,period_month', ignoreDuplicates: true })
            .select('id, amount, paid, paid_at, member_id, period_month, period_end, members(full_name, phone)');

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
        supabase.from('fee_records').select('amount, paid, paid_at, period_month').eq('paid', true).gte('period_month', startKey).lt('period_month', endKey),
        supabase.from('expenses').select('amount, expense_date').gte('expense_date', startKey).lt('expense_date', endKey),
      ]);

      feeData?.forEach((r) => {
        const key = r.paid_at ? r.paid_at.slice(0, 7) : r.period_month ? r.period_month.slice(0, 7) : null;
        if (!key) return;
        const entry = map.get(key);
        if (entry) entry.revenue += Number(r.amount);
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

  const totalRevenue = fees.filter((f: any) => f.paid).reduce((s: number, f: any) => s + Number(f.amount), 0);
  const totalExpenses = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const paidCount = fees.filter((f: any) => f.paid).length;
  const unpaidCount = fees.filter((f: any) => !f.paid).length;

  // Expense breakdown by category
  const expenseByCategory = expenses.reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {});
  const expenseChartData = Object.entries(expenseByCategory).map(([cat, amt]) => ({ category: cat, amount: amt }));
  const categoryColors: Record<string, string> = { rent: '#64748b', utility: '#3b82f6', salary: '#a855f7', maintenance: '#f97316', equipment: '#06b6d4', misc: '#6b7280' };

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-2xl font-display font-bold"><AnimatedNumber value={netProfit} format={formatCurrency} /></p>
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
                  <Pie data={[{ name: 'Paid', value: paidCount }, { name: 'Unpaid', value: unpaidCount }]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
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
        {/* Recent Payments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base"><History className="inline h-4 w-4 mr-2" />Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fees.filter((f: any) => f.paid).slice(0, 5).map((f: any) => (
                <div key={f.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{(f.members as any)?.full_name ?? 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(f.paid_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{formatCurrency(f.amount)}</p>
                    <Badge variant="success" className="text-[10px]">Paid</Badge>
                  </div>
                </div>
              ))}
              {fees.filter((f: any) => f.paid).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No payments yet</p>
              )}
            </div>
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
                      <Cell key={i} fill={categoryColors[entry.category] || '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
