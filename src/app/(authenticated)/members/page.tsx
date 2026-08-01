'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Search, Loader2, Pencil, Wallet, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/constants';

interface Member {
  id: string;
  full_name: string;
  phone: string | null;
  cnic: string | null;
  email: string | null;
  address: string | null;
  join_date: string;
  monthly_fee: number;
  active: boolean;
  notes: string | null;
  created_at: string;
}

interface FeeRecord {
  id: string;
  member_id: string;
  period_month: number;
  period_year: number;
  amount: number;
  status: 'paid' | 'unpaid';
  paid_at: string | null;
  payment_method: string | null;
}

export default function MembersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState({ full_name: '', phone: '', cnic: '', email: '', address: '', join_date: new Date().toISOString().slice(0, 10), monthly_fee: '', notes: '', active: true });

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentFeeId, setPaymentFeeId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Member[];
    },
  });

  const { data: memberFees = [], isLoading: loadingFees } = useQuery({
    queryKey: ['member_fees', selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember) return [];
      const { data, error } = await supabase.from('fee_records')
        .select('*')
        .eq('member_id', selectedMember.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data as FeeRecord[];
    },
    enabled: !!selectedMember,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = { ...data, monthly_fee: Number(data.monthly_fee) || 0 };
      if (editing) {
        const { error } = await supabase.from('members').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('members').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success(editing ? 'Member updated' : 'Member added');
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('members').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member status updated');
    },
  });

  const generateFeesMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const res = await fetch('/api/fees/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: now.getMonth() + 1, year: now.getFullYear() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate fees');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] });
      toast.success('Fees generated successfully');
    },
    onError: (e) => toast.error(e.message),
  });

  const collectFeeMutation = useMutation({
    mutationFn: async ({ feeId, method }: { feeId: string, method: string }) => {
      const res = await fetch('/api/fees/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeId, paymentMethod: method }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to collect fee');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member_fees'] });
      toast.success('Fee collected successfully');
      setPaymentFeeId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openAdd() {
    setEditing(null);
    setForm({ full_name: '', phone: '', cnic: '', email: '', address: '', join_date: new Date().toISOString().slice(0, 10), monthly_fee: '', notes: '', active: true });
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({ full_name: m.full_name, phone: m.phone || '', cnic: m.cnic || '', email: m.email || '', address: m.address || '', join_date: m.join_date, monthly_fee: String(m.monthly_fee), notes: m.notes || '', active: m.active });
    setDialogOpen(true);
  }

  const filtered = members.filter((m) => {
    const matchSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) || (m.phone || '').includes(search);
    const matchFilter = filter === 'all' ? true : filter === 'active' ? m.active : !m.active;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Members</h1>
          <Badge variant="secondary">{members.length}</Badge>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none"
            onClick={() => generateFeesMutation.mutate()} 
            disabled={generateFeesMutation.isPending}
          >
            {generateFeesMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
            Generate Fees
          </Button>
          <Button onClick={openAdd} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" /> Add Member
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Join Date</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Monthly Fee</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No members found</td></tr>
                ) : filtered.map((m) => (
                  <tr 
                    key={m.id} 
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => { setSelectedMember(m); setDetailOpen(true); }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">{m.full_name.slice(0, 1).toUpperCase()}</div>
                        <span className="font-medium">{m.full_name}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">{m.phone || '—'}</td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">{formatDate(m.join_date)}</td>
                    <td className="p-4 font-medium">{formatCurrency(m.monthly_fee)}</td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleActive.mutate({ id: m.id, active: !m.active })}>
                        <Badge variant={m.active ? 'success' : 'destructive'} className="cursor-pointer">{m.active ? 'Active' : 'Inactive'}</Badge>
                      </button>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Member Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Member' : 'Add Member'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CNIC</Label>
                <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Join Date</Label>
                <Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Fee *</Label>
                <Input type="number" required value={form.monthly_fee} onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? 'Update' : 'Add'} Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Member Details Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                {selectedMember?.full_name?.slice(0, 1).toUpperCase()}
              </div>
              {selectedMember?.full_name}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="info" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info" className="space-y-6 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Phone</div>
                  <div className="font-medium">{selectedMember?.phone || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">CNIC</div>
                  <div className="font-medium">{selectedMember?.cnic || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Email</div>
                  <div className="font-medium">{selectedMember?.email || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Join Date</div>
                  <div className="font-medium">{selectedMember ? formatDate(selectedMember.join_date) : '—'}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground mb-1">Address</div>
                  <div className="font-medium">{selectedMember?.address || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Monthly Fee</div>
                  <div className="font-medium">{selectedMember ? formatCurrency(selectedMember.monthly_fee) : '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Status</div>
                  <div>
                    <Badge variant={selectedMember?.active ? 'success' : 'destructive'}>
                      {selectedMember?.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground mb-1">Notes</div>
                  <div className="font-medium">{selectedMember?.notes || '—'}</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fees" className="pt-4">
              <div className="rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Paid At</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingFees ? (
                      <tr><td colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    ) : memberFees.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No fee records found</td></tr>
                    ) : memberFees.map(fee => (
                      <tr key={fee.id} className="border-b border-border/50 last:border-0">
                        <td className="p-3">{fee.period_month}/{fee.period_year}</td>
                        <td className="p-3">{formatCurrency(fee.amount)}</td>
                        <td className="p-3">
                          <Badge variant={fee.status === 'paid' ? 'success' : 'destructive'}>
                            {fee.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{fee.paid_at ? formatDate(fee.paid_at) : '—'}</td>
                        <td className="p-3 text-right">
                          {fee.status === 'unpaid' ? (
                            paymentFeeId === fee.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                  <SelectTrigger className="w-[100px] h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAYMENT_METHODS.map(pm => (
                                      <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button 
                                  size="sm" 
                                  className="h-8" 
                                  onClick={() => collectFeeMutation.mutate({ feeId: fee.id, method: paymentMethod })} 
                                  disabled={collectFeeMutation.isPending}
                                >
                                  {collectFeeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8" 
                                  onClick={() => setPaymentFeeId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setPaymentFeeId(fee.id)}>
                                Collect
                              </Button>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs capitalize">{fee.payment_method || '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="attendance" className="pt-4">
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mb-4 opacity-20" />
                <p>Attendance history coming soon.</p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
