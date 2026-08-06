'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { useGymSettings } from '@/hooks/use-gym-settings';
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Landmark, Wallet, TrendingUp, Receipt, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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

export default function ReserveAccountPage() {
  const { data: role } = useRole();
  const { data: settings } = useGymSettings();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [isEditingPercent, setIsEditingPercent] = useState(false);
  const [percentInput, setPercentInput] = useState('');

  const reservePercent = Number(settings?.reserve_percentage) || 0;

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthStart = `${selectedMonth}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // Month selector options
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return { value: d.toISOString().slice(0, 7), label: formatMonthYear(d) };
  });

  // Save reserve percentage mutation
  const updatePercentMutation = useMutation({
    mutationFn: async (newPercent: number) => {
      const { error } = await supabase
        .from('gym_settings')
        .update({ reserve_percentage: newPercent })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-settings'] });
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] });
      toast.success('Reserve percentage updated');
      setIsEditingPercent(false);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update percentage'),
  });

  // This month's fee revenue
  const { data: monthFees = [] } = useQuery({
    queryKey: ['reserve-month-fees', monthStart, monthEnd],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_records')
        .select('amount, amount_paid, paid, paid_at, period_month')
        .or('paid.eq.true,amount_paid.gt.0')
        .gte('period_month', monthStart)
        .lt('period_month', monthEnd);
      if (error) throw error;
      return data ?? [];
    },
  });

  // This month's non-reserve expenses
  const { data: monthNonReserveExpenses = [] } = useQuery({
    queryKey: ['reserve-month-nonres-expenses', monthStart, monthEnd],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', monthStart)
        .lt('expense_date', monthEnd)
        .eq('is_reserve', false);
      if (error) throw error;
      return data ?? [];
    },
  });

  // This month's reserve expenses (for table & total)
  const { data: monthReserveExpenses = [], isLoading: reserveExpLoading } = useQuery({
    queryKey: ['reserve-expenses', monthStart, monthEnd],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', monthStart)
        .lt('expense_date', monthEnd)
        .eq('is_reserve', true)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // All-time data for total reserve balance
  const { data: totalBalanceData } = useQuery({
    queryKey: ['reserve-balance', reservePercent],
    enabled: role === 'admin',
    queryFn: async () => {
      const [{ data: allFees }, { data: allExpenses }] = await Promise.all([
        supabase
          .from('fee_records')
          .select('amount, amount_paid, paid, paid_at, period_month')
          .or('paid.eq.true,amount_paid.gt.0'),
        supabase
          .from('expenses')
          .select('amount, expense_date, is_reserve'),
      ]);

      // Group fee revenue by month
      const revenueByMonth = new Map<string, number>();
      (allFees ?? []).forEach((f: any) => {
        const amtPaid = Number(f.amount_paid);
        const actualCollected = (!isNaN(amtPaid) && amtPaid > 0) ? amtPaid : (f.paid ? Number(f.amount) || 0 : 0);
        if (actualCollected <= 0) return;
        const key = f.paid_at ? f.paid_at.slice(0, 7) : f.period_month ? f.period_month.slice(0, 7) : null;
        if (!key) return;
        revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + actualCollected);
      });

      // Group non-reserve expenses by month, and sum all reserve expenses
      const nonResExpByMonth = new Map<string, number>();
      let totalReserveExpenses = 0;
      (allExpenses ?? []).forEach((e: any) => {
        if (!e.expense_date) return;
        const key = e.expense_date.slice(0, 7);
        if (e.is_reserve) {
          totalReserveExpenses += Number(e.amount) || 0;
        } else {
          nonResExpByMonth.set(key, (nonResExpByMonth.get(key) || 0) + (Number(e.amount) || 0));
        }
      });

      // Compute total contributions across all months
      const allMonthKeys = new Set([...revenueByMonth.keys(), ...nonResExpByMonth.keys()]);
      let totalContributions = 0;
      allMonthKeys.forEach((monthKey) => {
        const rev = revenueByMonth.get(monthKey) || 0;
        const exp = nonResExpByMonth.get(monthKey) || 0;
        const netProfit = rev - exp;
        if (netProfit > 0) {
          totalContributions += (netProfit * reservePercent) / 100;
        }
      });

      return {
        totalBalance: totalContributions - totalReserveExpenses,
        totalContributions,
        totalReserveExpenses,
      };
    },
  });

  // Delete reserve expense
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Reserve expense deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete expense'),
  });

  // Calculate this month's values
  const thisMonthRevenue = monthFees.reduce((s: number, f: any) => {
    const amtPaid = Number(f.amount_paid);
    if (!isNaN(amtPaid) && amtPaid > 0) return s + amtPaid;
    return s + (f.paid ? Number(f.amount) || 0 : 0);
  }, 0);
  const thisMonthNonResExpenses = monthNonReserveExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const thisMonthNetProfit = thisMonthRevenue - thisMonthNonResExpenses;
  const thisMonthContribution = thisMonthNetProfit > 0 ? (thisMonthNetProfit * reservePercent) / 100 : 0;
  const thisMonthReserveExpTotal = monthReserveExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

  const totalBalance = totalBalanceData?.totalBalance ?? 0;

  function handleStartEdit() {
    setPercentInput(String(reservePercent));
    setIsEditingPercent(true);
  }

  function handleSavePercent() {
    const val = Number(percentInput);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error('Percentage must be between 0 and 100');
      return;
    }
    updatePercentMutation.mutate(val);
  }

  if (role !== 'admin') return null;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-emerald-400" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Reserve Account</h1>
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

      {/* Reserve Percentage Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 grid place-items-center">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reserve Percentage</p>
                  <p className="text-xs text-muted-foreground/70">Automatically deducted from monthly net profit</p>
                </div>
              </div>
              {isEditingPercent ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={percentInput}
                    onChange={(e) => setPercentInput(e.target.value)}
                    className="w-24 h-9 text-right"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePercent();
                      if (e.key === 'Escape') setIsEditingPercent(false);
                    }}
                  />
                  <span className="text-lg font-bold text-emerald-400">%</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSavePercent}
                    disabled={updatePercentMutation.isPending}
                    className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/20"
                  >
                    {updatePercentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditingPercent(false)}
                    className="h-8 w-8 text-muted-foreground hover:bg-accent"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-display font-bold text-emerald-400">{reservePercent}%</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleStartEdit}
                    className="h-8 w-8 text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-400"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 grid place-items-center">
                  <Landmark className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Total Reserve Balance</p>
                <p className={cn('text-2xl font-display font-bold', totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  <AnimatedNumber value={totalBalance} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">All-time accumulated balance</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 grid place-items-center">
                  <Wallet className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">This Month's Contribution</p>
                <p className="text-2xl font-display font-bold text-blue-400">
                  <AnimatedNumber value={thisMonthContribution} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {reservePercent}% of {formatCurrency(thisMonthNetProfit > 0 ? thisMonthNetProfit : 0)} net profit
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-red-500/20 grid place-items-center">
                  <Receipt className="h-5 w-5 text-red-400" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">Reserve Expenses (This Month)</p>
                <p className="text-2xl font-display font-bold text-red-400">
                  <AnimatedNumber value={thisMonthReserveExpTotal} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">{monthReserveExpenses.length} expense(s)</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Reserve Expenses Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-400" />
              Reserve Expenses
              <Badge variant="secondary" className="ml-2">{formatCurrency(thisMonthReserveExpTotal)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reserveExpLoading ? (
                    <tr><td colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                  ) : monthReserveExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-muted-foreground">
                        <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No reserve expenses this month</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          Add an expense and check "Deduct from Reserve Account" to see it here
                        </p>
                      </td>
                    </tr>
                  ) : monthReserveExpenses.map((e: any) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="p-4 font-medium">{e.name}</td>
                      <td className="p-4 font-medium text-red-400">{formatCurrency(e.amount)}</td>
                      <td className="p-4 hidden sm:table-cell text-muted-foreground">{formatDate(e.expense_date)}</td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(e.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
