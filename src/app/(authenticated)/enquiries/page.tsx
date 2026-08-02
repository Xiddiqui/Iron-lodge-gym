'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format';
import { ENQUIRY_STATUSES } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Loader2, Pencil, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function EnquiriesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: role, isLoading: roleLoading } = useRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '', status: 'new', notes: '' });

  // Admin guard redirect
  useEffect(() => {
    if (!roleLoading && role && role !== 'admin') {
      router.replace('/members');
    }
  }, [role, roleLoading, router]);

  const { data: enquiries = [], isLoading } = useQuery({
    queryKey: ['enquiries'],
    queryFn: async () => {
      const { data, error } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: role === 'admin',
  });

  // Mark all unread enquiries as read on visit
  useEffect(() => {
    if (enquiries.length > 0 && enquiries.some((e: any) => !e.is_read)) {
      supabase
        .from('enquiries')
        .update({ is_read: true })
        .eq('is_read', false)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['enquiries-unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['enquiries'] });
        });
    }
  }, [enquiries, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editing) {
        const { error } = await supabase.from('enquiries').update(data).eq('id', editing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      toast.success('Enquiry updated');
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openEdit(e: any) {
    setEditing(e);
    setForm({
      name: e.name || '',
      phone: e.phone || '',
      email: e.email || '',
      message: e.message || '',
      status: e.status || 'new',
      notes: e.notes || '',
    });
    setDialogOpen(true);
  }

  const getStatusStyle = (status: string) => ENQUIRY_STATUSES.find((s) => s.value === status);

  if (roleLoading || (role && role !== 'admin')) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Client Enquiries & Feedback</h1>
          <Badge variant="secondary">{enquiries.length}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Contact Info</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Message</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                ) : enquiries.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No enquiries or feedback received yet</td></tr>
                ) : enquiries.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="p-4 font-medium">
                      <div>{e.name}</div>
                      <div className="text-xs text-muted-foreground lg:hidden mt-0.5 truncate max-w-[200px]">{e.message || 'No message'}</div>
                    </td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">
                      <div className="space-y-0.5 text-xs">
                        {e.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" />{e.phone}</div>}
                        {e.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" />{e.email}</div>}
                        {!e.phone && !e.email && '—'}
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground max-w-xs truncate">{e.message || '—'}</td>
                    <td className="p-4"><Badge className={getStatusStyle(e.status)?.color}>{getStatusStyle(e.status)?.label}</Badge></td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">{formatDate(e.created_at)}</td>
                    <td className="p-4 text-right"><Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Enquiry / Feedback</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENQUIRY_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Message / Feedback</Label><Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            <div className="space-y-2"><Label>Admin Notes</Label><Input placeholder="Internal follow-up notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter><Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Save Changes</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
