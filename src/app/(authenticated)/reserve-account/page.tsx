'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { useGymSettings } from '@/hooks/use-gym-settings';
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { 
  Landmark, 
  Wallet, 
  TrendingUp, 
  Receipt, 
  Trash2, 
  Pencil, 
  Check, 
  X, 
  Loader2, 
  Plus, 
  Building2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  PiggyBank,
  History,
  Calendar,
  Layers
} from 'lucide-react';
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

const SOURCE_OPTIONS = [
  'Other Business',
  'Personal Savings',
  'Investment Return',
  'Secondary Venture',
  'Direct Capital',
  'Other',
];

interface DepositRecord {
  id: string;
  title: string;
  amount: number;
  deposit_date: string;
  source: string;
  notes: string | null;
  created_at: string;
}

export default function ReserveAccountPage() {
  const { data: role } = useRole();
  const { data: settings } = useGymSettings();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [isEditingPercent, setIsEditingPercent] = useState(false);
  const [percentInput, setPercentInput] = useState('');

  // Deposit dialog state
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null);
  const [depositForm, setDepositForm] = useState({
    title: '',
    amount: '',
    source: 'Other Business',
    customSource: '',
    deposit_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

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

  // This month's manual reserve deposits
  const { data: monthDeposits = [], isLoading: depositsLoading } = useQuery<DepositRecord[]>({
    queryKey: ['reserve-deposits', monthStart, monthEnd],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reserve_deposits')
        .select('*')
        .gte('deposit_date', monthStart)
        .lt('deposit_date', monthEnd)
        .order('deposit_date', { ascending: false });
      if (error) {
        console.warn('Error loading reserve_deposits:', error.message);
        return [];
      }
      return data ?? [];
    },
  });

  // All-time data for total reserve balance
  const { data: totalBalanceData } = useQuery({
    queryKey: ['reserve-balance', reservePercent],
    enabled: role === 'admin',
    queryFn: async () => {
      const [feesRes, expRes, depRes] = await Promise.all([
        supabase
          .from('fee_records')
          .select('amount, amount_paid, paid, paid_at, period_month')
          .or('paid.eq.true,amount_paid.gt.0'),
        supabase
          .from('expenses')
          .select('amount, expense_date, is_reserve'),
        supabase
          .from('reserve_deposits')
          .select('amount, deposit_date'),
      ]);

      const allFees = feesRes.data ?? [];
      const allExpenses = expRes.data ?? [];
      const allDeposits = depRes.data ?? [];

      // Group fee revenue by month
      const revenueByMonth = new Map<string, number>();
      allFees.forEach((f: any) => {
        const amtPaid = Number(f.amount_paid);
        const actualCollected = (!isNaN(amtPaid) && amtPaid > 0) ? amtPaid : (f.paid ? Number(f.amount) || 0 : 0);
        if (actualCollected <= 0) return;
        const key = f.period_month ? f.period_month.slice(0, 7) : (f.paid_at ? f.paid_at.slice(0, 7) : null);
        if (!key) return;
        revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + actualCollected);
      });

      // Group non-reserve expenses by month, and sum all reserve expenses
      const nonResExpByMonth = new Map<string, number>();
      let totalReserveExpenses = 0;
      allExpenses.forEach((e: any) => {
        if (!e.expense_date) return;
        const key = e.expense_date.slice(0, 7);
        if (e.is_reserve) {
          totalReserveExpenses += Number(e.amount) || 0;
        } else {
          nonResExpByMonth.set(key, (nonResExpByMonth.get(key) || 0) + (Number(e.amount) || 0));
        }
      });

      // Compute total gym contributions across all months
      const allMonthKeys = new Set([...revenueByMonth.keys(), ...nonResExpByMonth.keys()]);
      let totalGymContributions = 0;
      allMonthKeys.forEach((monthKey) => {
        const rev = revenueByMonth.get(monthKey) || 0;
        const exp = nonResExpByMonth.get(monthKey) || 0;
        const netProfit = rev - exp;
        if (netProfit > 0) {
          totalGymContributions += (netProfit * reservePercent) / 100;
        }
      });

      // Total manual deposits (from other business, personal savings, etc.)
      let totalManualDeposits = 0;
      allDeposits.forEach((d: any) => {
        totalManualDeposits += Number(d.amount) || 0;
      });

      return {
        totalBalance: totalGymContributions + totalManualDeposits - totalReserveExpenses,
        totalGymContributions,
        totalManualDeposits,
        totalReserveExpenses,
      };
    },
  });

  // Save/Update Deposit Mutation
  const saveDepositMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      title: string;
      amount: number;
      deposit_date: string;
      source: string;
      notes?: string;
    }) => {
      if (payload.id) {
        const { error } = await supabase
          .from('reserve_deposits')
          .update({
            title: payload.title,
            amount: payload.amount,
            deposit_date: payload.deposit_date,
            source: payload.source,
            notes: payload.notes || null,
          })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reserve_deposits')
          .insert({
            title: payload.title,
            amount: payload.amount,
            deposit_date: payload.deposit_date,
            source: payload.source,
            notes: payload.notes || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] });
      toast.success(editingDepositId ? 'Reserve deposit updated' : 'Reserve amount deposited successfully');
      setDepositDialogOpen(false);
      resetDepositForm();
    },
    onError: (e: any) => {
      if (e.message?.includes('reserve_deposits') || e.code === '42P01' || e.message?.includes('schema cache')) {
        toast.error('Table not created yet. Please run migration 024_reserve_deposits.sql in Supabase SQL editor.');
      } else {
        toast.error(e.message || 'Failed to save reserve deposit');
      }
    },
  });

  // Delete Deposit Mutation
  const deleteDepositMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reserve_deposits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reserve-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['reserve-balance'] });
      toast.success('Reserve deposit removed');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete deposit'),
  });

  // Delete reserve expense
  const deleteExpenseMutation = useMutation({
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
  const thisMonthGymContribution = thisMonthNetProfit > 0 ? (thisMonthNetProfit * reservePercent) / 100 : 0;
  const thisMonthManualDepositsTotal = monthDeposits.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const thisMonthReserveExpTotal = monthReserveExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  const thisMonthNetInflow = thisMonthGymContribution + thisMonthManualDepositsTotal - thisMonthReserveExpTotal;

  const totalBalance = totalBalanceData?.totalBalance ?? 0;

  function resetDepositForm() {
    setEditingDepositId(null);
    setDepositForm({
      title: '',
      amount: '',
      source: 'Other Business',
      customSource: '',
      deposit_date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  }

  function handleOpenAddDeposit() {
    resetDepositForm();
    setDepositDialogOpen(true);
  }

  function handleOpenEditDeposit(deposit: DepositRecord) {
    setEditingDepositId(deposit.id);
    const isStandard = SOURCE_OPTIONS.includes(deposit.source);
    setDepositForm({
      title: deposit.title,
      amount: String(deposit.amount),
      source: isStandard ? deposit.source : 'Other',
      customSource: isStandard ? '' : deposit.source,
      deposit_date: deposit.deposit_date,
      notes: deposit.notes || '',
    });
    setDepositDialogOpen(true);
  }

  function handleSubmitDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(depositForm.amount);
    if (!depositForm.title.trim()) {
      toast.error('Please enter a title/source name');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }
    const finalSource = depositForm.source === 'Other' && depositForm.customSource.trim()
      ? depositForm.customSource.trim()
      : depositForm.source;

    saveDepositMutation.mutate({
      id: editingDepositId ?? undefined,
      title: depositForm.title.trim(),
      amount: amt,
      source: finalSource,
      deposit_date: depositForm.deposit_date,
      notes: depositForm.notes.trim() || undefined,
    });
  }

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

  // Combined chronological ledger for "All Activity"
  const allActivity = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'deposit' | 'expense';
      title: string;
      amount: number;
      date: string;
      sourceOrCategory: string;
      notes: string | null;
      raw: any;
    }> = [];

    monthDeposits.forEach((d) => {
      list.push({
        id: `dep-${d.id}`,
        type: 'deposit',
        title: d.title,
        amount: Number(d.amount),
        date: d.deposit_date,
        sourceOrCategory: d.source || 'Other Business',
        notes: d.notes,
        raw: d,
      });
    });

    monthReserveExpenses.forEach((e: any) => {
      list.push({
        id: `exp-${e.id}`,
        type: 'expense',
        title: e.name,
        amount: Number(e.amount),
        date: e.expense_date,
        sourceOrCategory: e.category || 'reserve',
        notes: e.notes,
        raw: e,
      });
    });

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [monthDeposits, monthReserveExpenses]);

  if (role !== 'admin') return null;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center">
            <Landmark className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Reserve Account</h1>
            <p className="text-xs text-muted-foreground">Manage savings, business earnings & reserve funds</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            onClick={handleOpenAddDeposit}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-sm flex-1 sm:flex-initial"
          >
            <Plus className="h-4 w-4" />
            Add Reserve Amount
          </Button>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40 sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reserve Percentage & Auto Allocation Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 grid place-items-center shrink-0">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Auto Gym Profit Allocation</p>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] py-0">
                      Auto Rule
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    Automatically saves a percentage of the gym's monthly net profit into this reserve
                  </p>
                </div>
              </div>

              {isEditingPercent ? (
                <div className="flex items-center gap-2 shrink-0">
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
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-3xl font-display font-bold text-emerald-400">{reservePercent}%</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleStartEdit}
                    className="h-8 w-8 text-muted-foreground hover:bg-emerald-500/20 hover:text-emerald-400"
                    title="Edit reserve percentage"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reserve Balance */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3 }}>
          <Card className="border-emerald-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 grid place-items-center">
                  <Landmark className="h-5 w-5 text-emerald-400" />
                </div>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                  All-Time
                </Badge>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground font-medium">Total Reserve Balance</p>
                <p className={cn('text-2xl font-display font-bold', totalBalance >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  <AnimatedNumber value={totalBalance} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Gym profit share + Other business deposits - Expenses
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Other Business / Manual Deposits This Month */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
          <Card className="border-purple-500/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 grid place-items-center">
                  <Building2 className="h-5 w-5 text-purple-400" />
                </div>
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px]">
                  {monthDeposits.length} Deposit(s)
                </Badge>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground font-medium">Deposits</p>
                <p className="text-2xl font-display font-bold text-purple-400">
                  <AnimatedNumber value={thisMonthManualDepositsTotal} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Saved this month from external business / funds
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Gym Profit Contribution This Month */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }}>
          <Card className="border-blue-500/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 grid place-items-center">
                  <Wallet className="h-5 w-5 text-blue-400" />
                </div>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px]">
                  {reservePercent}% Cut
                </Badge>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground font-medium">Gym Profit Cut</p>
                <p className="text-2xl font-display font-bold text-blue-400">
                  <AnimatedNumber value={thisMonthGymContribution} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  From {formatCurrency(thisMonthNetProfit > 0 ? thisMonthNetProfit : 0)} gym net profit
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Reserve Expenses This Month */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
          <Card className="border-red-500/20">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-red-500/20 grid place-items-center">
                  <Receipt className="h-5 w-5 text-red-400" />
                </div>
                <Badge variant="secondary" className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px]">
                  {monthReserveExpenses.length} Expense(s)
                </Badge>
              </div>
              <div className="mt-3">
                <p className="text-sm text-muted-foreground font-medium">Reserve Deductions</p>
                <p className="text-2xl font-display font-bold text-red-400">
                  <AnimatedNumber value={thisMonthReserveExpTotal} format={formatCurrency} />
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Deducted directly from reserve fund
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs & Ledger Section */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.3 }}>
        <Card className="border-border/60">
          <Tabs defaultValue="deposits" className="w-full">
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3 border-b border-border/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5 text-emerald-400" />
                    Reserve Activity & Ledger
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Track deposits, gym earnings allocations, and reserve expenses for {formatMonthYear(new Date(`${selectedMonth}-01`))}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <TabsList className="grid grid-cols-3 h-9 bg-muted/60">
                    <TabsTrigger value="deposits" className="text-xs gap-1.5 px-3">
                      <Building2 className="h-3.5 w-3.5 text-purple-400" />
                      Deposits
                      {monthDeposits.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px]">
                          {monthDeposits.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="expenses" className="text-xs gap-1.5 px-3">
                      <Receipt className="h-3.5 w-3.5 text-red-400" />
                      Expenses
                      {monthReserveExpenses.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 text-[10px]">
                          {monthReserveExpenses.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="all" className="text-xs gap-1.5 px-3">
                      <Layers className="h-3.5 w-3.5 text-emerald-400" />
                      All Activity
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </CardHeader>

            {/* TAB 1: Deposits / Inflows */}
            <TabsContent value="deposits" className="m-0 p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground bg-muted/20">
                      <th className="text-left p-4 font-medium">Title & Source</th>
                      <th className="text-left p-4 font-medium">Amount</th>
                      <th className="text-left p-4 font-medium hidden md:table-cell">Notes</th>
                      <th className="text-left p-4 font-medium hidden sm:table-cell">Date</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depositsLoading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </td>
                      </tr>
                    ) : monthDeposits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground">
                          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30 text-purple-400" />
                          <p className="text-sm font-medium">No manual reserve deposits this month</p>
                          <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm mx-auto">
                            Want to save earnings from another business or add savings? Click "+ Add Reserve Amount" above.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleOpenAddDeposit}
                            className="mt-4 gap-1.5 text-xs text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add First Deposit
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      monthDeposits.map((d) => (
                        <tr key={d.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                          <td className="p-4">
                            <div className="font-medium text-foreground">{d.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[10px] py-0 bg-purple-500/10 text-purple-300 border-purple-500/20">
                                {d.source || 'Other Business'}
                              </Badge>
                              <span className="text-xs text-muted-foreground sm:hidden">
                                • {formatDate(d.deposit_date)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-bold text-emerald-400 font-display">
                            +{formatCurrency(d.amount)}
                          </td>
                          <td className="p-4 hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                            {d.notes || '—'}
                          </td>
                          <td className="p-4 hidden sm:table-cell text-muted-foreground text-xs">
                            {formatDate(d.deposit_date)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEditDeposit(d)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title="Edit deposit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteDepositMutation.mutate(d.id)}
                                disabled={deleteDepositMutation.isPending}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                title="Delete deposit"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TAB 2: Expenses / Outflows */}
            <TabsContent value="expenses" className="m-0 p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground bg-muted/20">
                      <th className="text-left p-4 font-medium">Expense Name</th>
                      <th className="text-left p-4 font-medium">Amount</th>
                      <th className="text-left p-4 font-medium hidden md:table-cell">Notes</th>
                      <th className="text-left p-4 font-medium hidden sm:table-cell">Date</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reserveExpLoading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </td>
                      </tr>
                    ) : monthReserveExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground">
                          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30 text-red-400" />
                          <p className="text-sm font-medium">No reserve expenses deducted this month</p>
                          <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm mx-auto">
                            When logging an expense in the Expenses tab, toggle "Deduct from Reserve Account" to record it here.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      monthReserveExpenses.map((e: any) => (
                        <tr key={e.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                          <td className="p-4">
                            <div className="font-medium text-foreground">{e.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[10px] py-0 bg-red-500/10 text-red-400 border-red-500/20 capitalize">
                                {e.category || 'reserve'}
                              </Badge>
                              <span className="text-xs text-muted-foreground sm:hidden">
                                • {formatDate(e.expense_date)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-bold text-red-400 font-display">
                            -{formatCurrency(e.amount)}
                          </td>
                          <td className="p-4 hidden md:table-cell text-xs text-muted-foreground max-w-xs truncate">
                            {e.notes || '—'}
                          </td>
                          <td className="p-4 hidden sm:table-cell text-muted-foreground text-xs">
                            {formatDate(e.expense_date)}
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteExpenseMutation.mutate(e.id)}
                              disabled={deleteExpenseMutation.isPending}
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Delete expense"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TAB 3: Combined All Activity */}
            <TabsContent value="all" className="m-0 p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground bg-muted/20">
                      <th className="text-left p-4 font-medium">Activity</th>
                      <th className="text-left p-4 font-medium">Type</th>
                      <th className="text-left p-4 font-medium">Amount</th>
                      <th className="text-left p-4 font-medium hidden sm:table-cell">Date</th>
                      <th className="text-right p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depositsLoading || reserveExpLoading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </td>
                      </tr>
                    ) : allActivity.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground">
                          <History className="h-10 w-10 mx-auto mb-3 opacity-30 text-emerald-400" />
                          <p className="text-sm font-medium">No reserve activity for this month</p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            Deposits and reserve expenses for {formatMonthYear(new Date(`${selectedMonth}-01`))} will show here.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      allActivity.map((item) => {
                        const isDeposit = item.type === 'deposit';
                        return (
                          <tr key={item.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-2.5">
                                <div className={cn(
                                  "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                                  isDeposit ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                )}>
                                  {isDeposit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                </div>
                                <div>
                                  <div className="font-medium text-foreground">{item.title}</div>
                                  {item.notes && (
                                    <div className="text-xs text-muted-foreground line-clamp-1">{item.notes}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] py-0 capitalize",
                                  isDeposit
                                    ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                                    : "bg-red-500/10 text-red-400 border-red-500/20"
                                )}
                              >
                                {item.sourceOrCategory}
                              </Badge>
                            </td>
                            <td className={cn(
                              "p-4 font-bold font-display",
                              isDeposit ? "text-emerald-400" : "text-red-400"
                            )}>
                              {isDeposit ? `+${formatCurrency(item.amount)}` : `-${formatCurrency(item.amount)}`}
                            </td>
                            <td className="p-4 hidden sm:table-cell text-muted-foreground text-xs">
                              {formatDate(item.date)}
                            </td>
                            <td className="p-4 text-right">
                              {isDeposit ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEditDeposit(item.raw)}
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteDepositMutation.mutate(item.raw.id)}
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteExpenseMutation.mutate(item.raw.id)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>

      {/* Add / Edit Deposit Dialog */}
      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-emerald-400" />
              {editingDepositId ? 'Edit Reserve Deposit' : 'Add Reserve Deposit'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Save earnings from other businesses, personal funds, or direct investments into your reserve account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitDeposit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="deposit-amount" className="text-xs">
                Amount (PKR) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="deposit-amount"
                type="number"
                min="1"
                step="any"
                placeholder="e.g. 50000"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deposit-title" className="text-xs">
                Title / Description <span className="text-destructive">*</span>
              </Label>
              <Input
                id="deposit-title"
                type="text"
                placeholder="e.g. E-Commerce Profits, Real Estate Income, Consulting"
                value={depositForm.title}
                onChange={(e) => setDepositForm({ ...depositForm, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="deposit-source" className="text-xs">Source Category</Label>
                <Select
                  value={depositForm.source}
                  onValueChange={(val) => setDepositForm({ ...depositForm, source: val })}
                >
                  <SelectTrigger id="deposit-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deposit-date" className="text-xs">Deposit Date</Label>
                <Input
                  id="deposit-date"
                  type="date"
                  value={depositForm.deposit_date}
                  onChange={(e) => setDepositForm({ ...depositForm, deposit_date: e.target.value })}
                  required
                />
              </div>
            </div>

            {depositForm.source === 'Other' && (
              <div className="space-y-1.5">
                <Label htmlFor="deposit-custom-source" className="text-xs">Custom Source Name</Label>
                <Input
                  id="deposit-custom-source"
                  type="text"
                  placeholder="Specify source..."
                  value={depositForm.customSource}
                  onChange={(e) => setDepositForm({ ...depositForm, customSource: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="deposit-notes" className="text-xs">Notes (Optional)</Label>
              <Textarea
                id="deposit-notes"
                rows={2}
                placeholder="Any additional details, invoice reference or transaction notes..."
                value={depositForm.notes}
                onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDepositDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveDepositMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
              >
                {saveDepositMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingDepositId ? 'Update Deposit' : 'Deposit Amount'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
