'use client';
export const dynamic = 'force-dynamic';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Search, Loader2, Pencil, Wallet, CalendarDays, Camera, RefreshCw, X, User, Megaphone, Trash2, CheckSquare, Square, AlertTriangle, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/constants';

interface Trainer {
  id: string;
  name: string;
  phone: string | null;
  specialization: string | null;
}

interface Member {
  id: string;
  member_number: string | null;
  full_name: string;
  phone: string | null;
  cnic: string | null;
  email: string | null;
  join_date: string;
  monthly_fee: number;
  training_fees: number;
  trainer_id: string | null;
  amount_paid: number;
  active: boolean;
  notes: string | null;
  photo_url: string | null;
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
  
  const [form, setForm] = useState({
    member_number: '',
    full_name: '',
    phone: '',
    cnic: '',
    email: '',
    join_date: new Date().toISOString().slice(0, 10),
    monthly_fee: '',
    training_fees: '0',
    trainer_id: null as string | null,
    amount_paid: '',
    notes: '',
    photo_url: '' as string | null,
    active: true,
  });

  // Webcam states & refs
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentFeeId, setPaymentFeeId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  // Announcements State
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [selectedAnnounceMemberIds, setSelectedAnnounceMemberIds] = useState<string[]>([]);
  const [announcementSearch, setAnnouncementSearch] = useState('');

  // Delete Member State
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

  // Fetch Members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Member[];
    },
  });

  // Fetch Trainers
  const { data: trainers = [] } = useQuery({
    queryKey: ['trainers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainers').select('*').order('name', { ascending: true });
      if (error) return [];
      return data as Trainer[];
    },
  });

  // Map assigned active clients count per trainer
  const trainerClientCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      if (m.trainer_id && m.active) {
        counts[m.trainer_id] = (counts[m.trainer_id] || 0) + 1;
      }
    });
    return counts;
  }, [members]);

  // Fetch Member Fee Records
  const { data: memberFees = [], isLoading: loadingFees } = useQuery({
    queryKey: ['member_fees', selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember) return [];
      const { data, error } = await supabase.from('fee_records')
        .select('*')
        .eq('member_id', selectedMember.id)
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data as FeeRecord[];
    },
    enabled: !!selectedMember,
  });

  // Camera Management
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 400, facingMode: 'user' } });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
    } catch (err) {
      toast.error('Unable to access camera. Please check permissions.');
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  useEffect(() => {
    if (!dialogOpen) {
      stopCamera();
    }
  }, [dialogOpen]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 300;
    canvas.height = videoRef.current.videoHeight || 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setForm((prev) => ({ ...prev, photo_url: dataUrl }));
      stopCamera();
      toast.success('Photo captured!');
    }
  };

  // Calculations for form summary
  const currentMonthlyFee = Number(form.monthly_fee) || 0;
  const currentTrainingFee = Number(form.training_fees) || 0;
  const totalPayable = currentMonthlyFee + currentTrainingFee;
  const currentAmountPaid = form.amount_paid === '' ? totalPayable : Number(form.amount_paid) || 0;
  const remainingFees = Math.max(0, totalPayable - currentAmountPaid);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = {
        member_number: data.member_number,
        full_name: data.full_name,
        phone: data.phone || null,
        cnic: data.cnic || null,
        email: data.email || null,
        join_date: data.join_date,
        monthly_fee: Number(data.monthly_fee) || 0,
        training_fees: Number(data.training_fees) || 0,
        trainer_id: data.trainer_id || null,
        amount_paid: data.amount_paid === '' ? (Number(data.monthly_fee) || 0) + (Number(data.training_fees) || 0) : Number(data.amount_paid) || 0,
        notes: data.notes || null,
        photo_url: data.photo_url || null,
        active: data.active,
      };

      if (editing) {
        const { error } = await supabase.from('members').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data: newMember, error } = await supabase.from('members').insert(payload).select().single();
        if (error) throw error;

        if (newMember) {
          const totalFee = payload.monthly_fee + payload.training_fees;
          const paidAmount = payload.amount_paid;
          const isPaid = paidAmount >= totalFee && totalFee > 0;
          const joinDateStr = payload.join_date || new Date().toISOString().slice(0, 10);
          const [jYear, jMonth] = joinDateStr.split('-').map(Number);
          const periodMonth = `${jYear}-${String(jMonth).padStart(2, '0')}-01`;
          const lastDay = new Date(jYear, jMonth, 0).getDate();
          const periodEnd = `${jYear}-${String(jMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

          await supabase.from('fee_records').insert({
            member_id: newMember.id,
            amount: totalFee,
            period_month: periodMonth,
            period_end: periodEnd,
            paid: isPaid,
            paid_at: isPaid ? new Date().toISOString() : null,
            payment_method: 'cash',
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['dash-fees'] });
      queryClient.invalidateQueries({ queryKey: ['dash-trend'] });
      queryClient.invalidateQueries({ queryKey: ['dash-active'] });
      toast.success(editing ? 'Member updated' : 'Member added');
      stopCamera();
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member deleted successfully');
      setMemberToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAnnouncements() {
    setAnnouncementMessage('');
    setAnnouncementSearch('');
    // Default to selecting all active members
    setSelectedAnnounceMemberIds(members.filter((m) => m.active).map((m) => m.id));
    setAnnouncementOpen(true);
  }

  const formatPhoneForWA = (phone: string | null) => {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '92' + cleaned.slice(1);
    } else if (!cleaned.startsWith('92') && cleaned.length === 10) {
      cleaned = '92' + cleaned;
    }
    return cleaned;
  };

  const handleSendWhatsApp = () => {
    if (!announcementMessage.trim()) {
      toast.error('Please enter an announcement message');
      return;
    }
    if (selectedAnnounceMemberIds.length === 0) {
      toast.error('Please select at least one member');
      return;
    }

    const selectedMembers = members.filter((m) => selectedAnnounceMemberIds.includes(m.id));
    const validMembers = selectedMembers.filter((m) => !!formatPhoneForWA(m.phone));

    if (validMembers.length === 0) {
      toast.error('None of the selected members have valid phone numbers');
      return;
    }

    const encodedMsg = encodeURIComponent(announcementMessage);
    const firstPhone = formatPhoneForWA(validMembers[0].phone);

    window.open(`https://wa.me/${firstPhone}?text=${encodedMsg}`, '_blank');

    if (validMembers.length > 1) {
      toast.success(`Opening WhatsApp for ${validMembers.length} selected members. Use the queue in popup if popups are blocked.`);
    } else {
      toast.success(`WhatsApp chat opened for ${validMembers[0].full_name}!`);
    }
  };

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
    stopCamera();

    // Auto-generate member number (001, 002, etc.)
    let maxNum = 0;
    members.forEach((m) => {
      if (m.member_number) {
        const num = parseInt(m.member_number, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum > 0 ? maxNum + 1 : members.length + 1;
    const generatedNum = String(nextNum).padStart(3, '0');

    setForm({
      member_number: generatedNum,
      full_name: '',
      phone: '',
      cnic: '',
      email: '',
      join_date: new Date().toISOString().slice(0, 10),
      monthly_fee: '',
      training_fees: '0',
      trainer_id: null,
      amount_paid: '',
      notes: '',
      photo_url: null,
      active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    stopCamera();
    setForm({
      member_number: m.member_number || '',
      full_name: m.full_name,
      phone: m.phone || '',
      cnic: m.cnic || '',
      email: m.email || '',
      join_date: m.join_date,
      monthly_fee: String(m.monthly_fee),
      training_fees: String(m.training_fees || 0),
      trainer_id: m.trainer_id || null,
      amount_paid: String(m.amount_paid ?? (m.monthly_fee + (m.training_fees || 0))),
      notes: m.notes || '',
      photo_url: m.photo_url || null,
      active: m.active,
    });
    setDialogOpen(true);
  }

  const filtered = members.filter((m) => {
    const cleanSearch = search.trim().toLowerCase();
    const matchSearch =
      !cleanSearch ||
      m.full_name.toLowerCase().includes(cleanSearch) ||
      (m.phone || '').toLowerCase().includes(cleanSearch) ||
      (m.member_number || '').toLowerCase().includes(cleanSearch) ||
      (m.cnic || '').toLowerCase().includes(cleanSearch);
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
            onClick={openAnnouncements} 
            className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white font-medium shadow"
          >
            <Megaphone className="h-4 w-4 mr-2" /> Announcements
          </Button>
          <Button onClick={openAdd} className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" /> Add Member
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by CNIC, Member ID, Name, or Phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
                  <th className="text-left p-4 font-medium text-muted-foreground">Member #</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">CNIC</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Trainer</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Total Fee</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Payment Status</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No members found</td></tr>
                ) : filtered.map((m) => {
                  const assignedTrainer = trainers.find((t) => t.id === m.trainer_id);
                  const totalFee = (m.monthly_fee || 0) + (m.training_fees || 0);
                  const paidAmount = m.amount_paid ?? totalFee;
                  const percentage = totalFee > 0 ? Math.min(100, Math.round((paidAmount / totalFee) * 100)) : 100;
                  const isFullyPaid = percentage >= 100;

                  return (
                    <tr 
                      key={m.id} 
                      className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => { setSelectedMember(m); setDetailOpen(true); }}
                    >
                      <td className="p-4 font-mono font-medium text-muted-foreground">
                        {m.member_number || '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {m.photo_url ? (
                            <img src={m.photo_url} alt={m.full_name} className="h-9 w-9 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                              {m.full_name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">{m.full_name}</span>
                        </div>
                      </td>
                      <td className="p-4 hidden sm:table-cell text-muted-foreground">{m.phone || '—'}</td>
                      <td className="p-4 hidden md:table-cell text-muted-foreground font-mono text-xs">{m.cnic || '—'}</td>
                      <td className="p-4 hidden lg:table-cell text-muted-foreground">
                        {assignedTrainer ? (
                          <Badge variant="outline" className="font-normal">{assignedTrainer.name}</Badge>
                        ) : '—'}
                      </td>
                      <td className="p-4 font-medium">{formatCurrency(totalFee)}</td>
                      <td className="p-4">
                        {isFullyPaid ? (
                          <Badge variant="success" className="font-semibold px-2.5 py-0.5">100% Paid</Badge>
                        ) : (
                          <Badge variant="outline" className="border-2 border-red-500 text-red-500 bg-red-500/10 font-bold px-2.5 py-0.5">
                            {percentage}% Paid ({formatCurrency(totalFee - paidAmount)} due)
                          </Badge>
                        )}
                      </td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleActive.mutate({ id: m.id, active: !m.active })}>
                          <Badge variant={m.active ? 'success' : 'destructive'} className="cursor-pointer">{m.active ? 'Active' : 'Inactive'}</Badge>
                        </button>
                      </td>
                      <td className="p-4 text-right flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" title="Edit Member" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete Member" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setMemberToDelete(m)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Member Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) stopCamera(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              {editing ? 'Edit Member' : 'Add Member'}
            </DialogTitle>
          </DialogHeader>

          {/* Top Center Webcam Photo Capture */}
          <div className="flex flex-col items-center justify-center space-y-3 pt-2 pb-4 border-b border-border">
            <div className="relative h-36 w-36 rounded-full overflow-hidden border-4 border-muted bg-accent/40 flex items-center justify-center shadow-inner">
              {isCameraActive ? (
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
              ) : form.photo_url ? (
                <img src={form.photo_url} alt="Client Photo" className="h-full w-full object-cover" />
              ) : (
                <User className="h-16 w-16 text-muted-foreground/50" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {isCameraActive ? (
                <>
                  <Button type="button" size="sm" onClick={capturePhoto} className="bg-green-600 hover:bg-green-700 text-white">
                    <Camera className="h-4 w-4 mr-2" /> Take Photo
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={stopCamera}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" size="sm" variant="secondary" onClick={startCamera}>
                    <Camera className="h-4 w-4 mr-2" /> {form.photo_url ? 'Retake Photo' : 'Open Webcam'}
                  </Button>
                  {form.photo_url && (
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setForm((prev) => ({ ...prev, photo_url: null }))}>
                      Remove
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Member Number (Auto Generated, Read Only) */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Member Number (Auto-Generated)</Label>
                <Input readOnly value={form.member_number} className="bg-muted font-mono font-bold cursor-not-allowed text-primary" />
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. John Doe" />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0300-1234567" />
              </div>

              {/* CNIC */}
              <div className="space-y-2">
                <Label>CNIC</Label>
                <Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="e.g. 42101-XXXXXXX-X" />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="client@example.com" />
              </div>

              {/* Join Date */}
              <div className="space-y-2">
                <Label>Join Date</Label>
                <Input type="date" value={form.join_date} onChange={(e) => setForm({ ...form, join_date: e.target.value })} />
              </div>

              {/* Monthly Fee */}
              <div className="space-y-2">
                <Label>Monthly Fee (PKR) *</Label>
                <Input 
                  type="number" 
                  required 
                  value={form.monthly_fee} 
                  onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })} 
                  placeholder="e.g. 4000" 
                />
              </div>

              {/* Training Fees */}
              <div className="space-y-2">
                <Label>Training Fees (PKR)</Label>
                <Input 
                  type="number" 
                  value={form.training_fees} 
                  onChange={(e) => setForm({ ...form, training_fees: e.target.value })} 
                  placeholder="e.g. 10000" 
                />
              </div>

              {/* Trainer Selection Dropdown */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Assign Trainer</Label>
                <Select 
                  value={form.trainer_id || 'none'} 
                  onValueChange={(val) => setForm({ ...form, trainer_id: val === 'none' ? null : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Trainer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Trainer Assigned</SelectItem>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({trainerClientCounts[t.id] || 0} active clients)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional member details or preferences" />
            </div>

            {/* Payment & Fee Summary Section */}
            <div className="bg-muted/40 p-4 rounded-lg border border-border space-y-3">
              <h4 className="font-semibold text-sm text-foreground flex items-center justify-between">
                <span>Fee Summary & Payment Received</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-background p-3 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Total Payable</div>
                  <div className="text-base font-bold text-primary">{formatCurrency(totalPayable)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Monthly ({formatCurrency(currentMonthlyFee)}) + Training ({formatCurrency(currentTrainingFee)})
                  </div>
                </div>

                <div className="bg-background p-3 rounded border border-border space-y-1">
                  <div className="text-xs text-muted-foreground font-medium">Received Amount (PKR)</div>
                  <Input 
                    type="number" 
                    value={form.amount_paid} 
                    onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} 
                    placeholder={String(totalPayable)}
                    className="h-8 text-sm font-semibold" 
                  />
                </div>

                <div className="bg-background p-3 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Remaining Fees</div>
                  <div className={`text-base font-bold ${remainingFees > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {formatCurrency(remainingFees)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {remainingFees > 0 ? `${Math.round((currentAmountPaid / (totalPayable || 1)) * 100)}% Paid` : '100% Fully Paid'}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); stopCamera(); }}>
                Cancel
              </Button>
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
            <DialogTitle className="text-xl flex items-center gap-3">
              {selectedMember?.photo_url ? (
                <img src={selectedMember.photo_url} alt={selectedMember.full_name} className="h-10 w-10 rounded-full object-cover border border-border" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/20 grid place-items-center text-sm font-semibold text-primary">
                  {selectedMember?.full_name?.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <div>{selectedMember?.full_name}</div>
                <div className="text-xs font-mono font-normal text-muted-foreground">Member #{selectedMember?.member_number || 'N/A'}</div>
              </div>
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
                  <div className="text-muted-foreground mb-1">Member Number</div>
                  <div className="font-mono font-bold">{selectedMember?.member_number || '—'}</div>
                </div>
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
                <div>
                  <div className="text-muted-foreground mb-1">Assigned Trainer</div>
                  <div className="font-medium">
                    {trainers.find(t => t.id === selectedMember?.trainer_id)?.name || 'None'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Monthly Fee</div>
                  <div className="font-medium">{selectedMember ? formatCurrency(selectedMember.monthly_fee) : '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Training Fees</div>
                  <div className="font-medium">{selectedMember ? formatCurrency(selectedMember.training_fees || 0) : '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Amount Paid</div>
                  <div className="font-medium text-green-600">
                    {selectedMember ? formatCurrency(selectedMember.amount_paid ?? ((selectedMember.monthly_fee || 0) + (selectedMember.training_fees || 0))) : '—'}
                  </div>
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

      {/* Announcements Dialog */}
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-green-600" />
              Send Announcement via WhatsApp
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Announcement Message Field */}
            <div className="space-y-2">
              <Label htmlFor="announcement-message" className="font-semibold">Announcement Message *</Label>
              <textarea
                id="announcement-message"
                rows={4}
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                placeholder="Type your message here (e.g. Gym timing updates, special offers, fee reminders)..."
                className="w-full rounded-md border border-input bg-background p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Member Selection Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Select Recipient Members</Label>
                <Badge variant="outline" className="font-mono">
                  {selectedAnnounceMemberIds.length} / {members.length} Selected
                </Badge>
              </div>

              {/* Internal Search & Select All Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter list by name, phone or member #..."
                    value={announcementSearch}
                    onChange={(e) => setAnnouncementSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const filteredList = members.filter((m) => {
                      const q = announcementSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        m.full_name.toLowerCase().includes(q) ||
                        (m.phone || '').includes(q) ||
                        (m.member_number || '').includes(q)
                      );
                    });
                    const filteredIds = filteredList.map((m) => m.id);
                    const isAllFilteredSelected = filteredIds.every((id) => selectedAnnounceMemberIds.includes(id));
                    if (isAllFilteredSelected) {
                      setSelectedAnnounceMemberIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
                    } else {
                      setSelectedAnnounceMemberIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
                    }
                  }}
                  className="h-9 text-xs whitespace-nowrap"
                >
                  {members
                    .filter((m) => {
                      const q = announcementSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        m.full_name.toLowerCase().includes(q) ||
                        (m.phone || '').includes(q) ||
                        (m.member_number || '').includes(q)
                      );
                    })
                    .every((m) => selectedAnnounceMemberIds.includes(m.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {/* Members Checklist Box */}
              <div className="border border-border rounded-md divide-y divide-border/60 max-h-60 overflow-y-auto bg-muted/20">
                {members
                  .filter((m) => {
                    const q = announcementSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      m.full_name.toLowerCase().includes(q) ||
                      (m.phone || '').includes(q) ||
                      (m.member_number || '').includes(q)
                    );
                  })
                  .map((m) => {
                    const isSelected = selectedAnnounceMemberIds.includes(m.id);
                    const formattedPhone = formatPhoneForWA(m.phone);
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedAnnounceMemberIds((prev) =>
                            prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                          );
                        }}
                        className={`flex items-center justify-between p-3 cursor-pointer hover:bg-accent/40 transition-colors ${
                          isSelected ? 'bg-accent/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div click
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary accent-green-600"
                          />
                          {m.photo_url ? (
                            <img src={m.photo_url} alt={m.full_name} className="h-8 w-8 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                              {m.full_name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-sm leading-none">{m.full_name}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              <span>#{m.member_number || 'N/A'}</span>
                              <span>•</span>
                              <span>{m.phone || 'No Phone'}</span>
                            </div>
                          </div>
                        </div>

                        {isSelected && formattedPhone && announcementMessage.trim() && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(
                                `https://wa.me/${formattedPhone}?text=${encodeURIComponent(announcementMessage)}`,
                                '_blank'
                              );
                            }}
                          >
                            <Send className="h-3 w-3 mr-1" /> Open Chat
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => setAnnouncementOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white font-medium gap-2"
              onClick={handleSendWhatsApp}
            >
              <Send className="h-4 w-4" /> Send via WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation Dialog */}
      <Dialog open={!!memberToDelete} onOpenChange={(open) => { if (!open) setMemberToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <AlertTriangle className="h-5 w-5" />
              Delete Member
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground">{memberToDelete?.full_name}</strong> (Member #{memberToDelete?.member_number || 'N/A'})?
            This will permanently remove the member and their associated records.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setMemberToDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => memberToDelete && deleteMutation.mutate(memberToDelete.id)}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
