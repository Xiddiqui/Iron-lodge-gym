'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { useCurrentUser } from '@/hooks/use-session';
import { formatCurrency, formatDate, formatMonthYear } from '@/lib/format';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Receipt, Plus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ExpensesPage() {
  const { data: role } = useRole();
  const { data: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'misc', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '', is_reserve: false });

  const monthStart = `${selectedMonth}-01`;
  const [y, m] = selectedMonth.split('-').map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const monthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', monthStart, monthEnd],
    enabled: role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase.from('expenses').select('*').gte('expense_date', monthStart).lt('expense_date', monthEnd).eq('is_reserve', false).order('expense_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new Error('Expense name is required');
      }
      const numAmount = Number(data.amount);
      if (!data.amount || isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Please enter a valid positive expense amount');
      }

      const payload: Record<string, any> = {
        name: trimmedName,
        category: data.category,
        amount: numAmount,
        expense_date: data.expense_date || new Date().toISOString().slice(0, 10),
        is_reserve: data.is_reserve || false,
      };
      if (data.notes && data.notes.trim()) {
        payload.notes = data.notes.trim();
      }
      if (currentUser?.id) {
        payload.logged_by = currentUser.id;
      }
      let { error } = await supabase.from('expenses').insert(payload);

      // Fallback: If logged_by column is not present or triggers schema cache/FK error, retry without it
      if (error && payload.logged_by) {
        delete payload.logged_by;
        const retry = await supabase.from('expenses').insert(payload);
        error = retry.error;
      }

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dash-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dash-trend'] });
      toast.success('Expense added');
      setDialogOpen(false);
      setForm({ name: '', category: 'misc', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '', is_reserve: false });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dash-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dash-trend'] });
      toast.success('Expense deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete expense'),
  });

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { value: val, label: formatMonthYear(d) };
  });
  const getCatLabel = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.label || v;
  const getCatColor = (v: string) => EXPENSE_CATEGORIES.find((c) => c.value === v)?.color || 'bg-gray-500';

  if (role !== 'admin') return null;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Expenses</h1>
          <Badge variant="secondary">{formatCurrency(total)}</Badge>
        </div>
        <div className="flex gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{monthOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => { setForm({ name: '', category: 'misc', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '', is_reserve: false }); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Expense
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No expenses recorded for this month</td></tr>
                ) : expenses.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="p-4 font-medium">{e.name}</td>
                    <td className="p-4"><Badge className={`${getCatColor(e.category)}/20 text-white border-0`}>{getCatLabel(e.category)}</Badge></td>
                    <td className="p-4 font-medium">{formatCurrency(e.amount)}</td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">{formatDate(e.expense_date)}</td>
                    <td className="p-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(e.id)} disabled={deleteMutation.isPending}>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input required placeholder="e.g. Electricity Bill" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" step="any" min="0.01" required placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Optional notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-accent/10">
              <input 
                type="checkbox" 
                id="is-reserve" 
                checked={form.is_reserve} 
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm({
                    ...form,
                    is_reserve: checked,
                    category: checked ? 'reserve' : (form.category === 'reserve' ? 'misc' : form.category)
                  });
                }} 
                className="h-4 w-4 rounded accent-emerald-500" 
              />
              <Label htmlFor="is-reserve" className="text-sm cursor-pointer">
                Deduct from Reserve Account
                <span className="block text-xs text-muted-foreground">This expense will be tracked in the Reserve Account instead of the main dashboard</span>
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

