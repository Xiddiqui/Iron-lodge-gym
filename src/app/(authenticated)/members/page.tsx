'use client';
export const dynamic = 'force-dynamic';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency, formatDate } from '@/lib/format';
import { useRole } from '@/hooks/use-role';
import { useCurrentUser } from '@/hooks/use-session';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Search, Loader2, Pencil, Wallet, CalendarDays, Camera, RefreshCw, X, User, Megaphone, Trash2, CheckSquare, Square, AlertTriangle, Send, CreditCard, Receipt, BookmarkPlus, Bookmark, PhoneCall, CheckCircle2, Play, SkipForward, RotateCcw, Edit3, Save, MessageSquare, Clock, Check, XCircle, AlertCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_METHODS } from '@/lib/constants';

interface MessageTemplate {
  id: string;
  title: string;
  message: string;
}

interface Trainer {
  id: string;
  name: string;
  phone: string | null;
  specialization: string | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
}

interface MemberPendingEdit {
  id: string;
  member_id: string;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  changes: Record<string, any>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Member {
  id: string;
  member_number: string | null;
  full_name: string;
  gender: string | null;
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
  assigned_staff_id: string | null;
  created_by?: string | null;
}

interface FeeRecord {
  id: string;
  member_id: string;
  period_month: string;
  period_end?: string;
  amount: number;
  amount_paid: number;
  discount: number;
  paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  status?: string;
  period_year?: number;
}

// Helper: get current month as YYYY-MM-01
function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// Helper: get all months from join_date to current month
function getMonthsBetween(joinDate: string): string[] {
  const months: string[] = [];
  const join = new Date(joinDate);
  const now = new Date();
  let cursor = new Date(join.getFullYear(), join.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    months.push(`${y}-${String(m).padStart(2, '0')}-01`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

// Helper: format period month for display
function formatPeriodMonth(periodMonth: string): string {
  if (!periodMonth || !periodMonth.includes('-')) return periodMonth || '—';
  const [y, m] = periodMonth.split('-').map(Number);
  if (y && m) {
    const dateObj = new Date(y, m - 1, 1);
    return dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return periodMonth;
}

export default function MembersPage() {
  const queryClient = useQueryClient();
  const { data: userRole } = useRole();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = userRole === 'admin';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

  // Fetch Profiles (for Added By staff names & Pending Approvals)
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) return [];
      return data as Profile[];
    },
  });

  // Fetch Pending Member Edits
  const { data: pendingEdits = [] } = useQuery({
    queryKey: ['member_pending_edits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_pending_edits')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data as MemberPendingEdit[];
    },
  });

  // Map pending edits by member_id
  const pendingEditsByMemberId = useMemo(() => {
    const map: Record<string, MemberPendingEdit> = {};
    pendingEdits.forEach((pe) => {
      map[pe.member_id] = pe;
    });
    return map;
  }, [pendingEdits]);

  // Real-time listener for pending member edit requests
  useEffect(() => {
    const channel = supabase
      .channel('pending-edits-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'member_pending_edits',
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['member_pending_edits'] });
          if (isAdmin) {
            const reqUserId = payload.new?.requested_by;
            const staffName = profiles.find((p) => p.id === reqUserId)?.full_name || 'Staff member';
            toast.info(`🔔 New member edit request from ${staffName}!`, {
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, profiles, queryClient]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  
  const [form, setForm] = useState({
    member_number: '',
    full_name: '',
    gender: 'male',
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

  // Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payModalMember, setPayModalMember] = useState<Member | null>(null);
  const [payDiscount, setPayDiscount] = useState('0');
  const [payAmountReceived, setPayAmountReceived] = useState('');
  const [payMethod, setPayMethod] = useState('cash');

  // Announcements State
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [selectedAnnounceMemberIds, setSelectedAnnounceMemberIds] = useState<string[]>([]);
  const [announcementSearch, setAnnouncementSearch] = useState('');

  // Sender Phone & Saved Templates State
  const [senderPhone, setSenderPhone] = useState('03325158779');
  const [tempSenderPhone, setTempSenderPhone] = useState('03325158779');
  const [isEditingSender, setIsEditingSender] = useState(false);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');

  // Bulk Broadcast Queue State
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkCurrentIndex, setBulkCurrentIndex] = useState(0);
  const [sentMemberIds, setSentMemberIds] = useState<string[]>([]);
  const [sendingBulk, setSendingBulk] = useState(false);


  // Load persistent sender phone & templates on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSender = localStorage.getItem('wa_sender_phone');
      if (storedSender) {
        setSenderPhone(storedSender);
        setTempSenderPhone(storedSender);
      }
      const storedTemplates = localStorage.getItem('wa_announcement_templates');
      if (storedTemplates) {
        try {
          setTemplates(JSON.parse(storedTemplates));
        } catch (e) {
          console.error('Failed to parse templates:', e);
        }
      } else {
        const defaultTemplates: MessageTemplate[] = [
          { id: '1', title: 'Welcome message', message: 'Welcome to Iron Lodge Gym! We are excited to have you on board with us.' },
          { id: '2', title: 'Fee Reminder', message: 'Dear Member, this is a friendly reminder that your monthly gym fee is due. Please clear it at your earliest convenience. Thank you! - Iron Lodge Gym' },
          { id: '3', title: 'Gym Notice', message: 'Attention Members: Please note our updated gym schedule and policies. Have a great workout! - Iron Lodge Gym' },
        ];
        setTemplates(defaultTemplates);
        localStorage.setItem('wa_announcement_templates', JSON.stringify(defaultTemplates));
      }
    }
  }, []);

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

  // Fetch ALL fee records for all members (for current month status + pay modal)
  const { data: allFeeRecords = [] } = useQuery({
    queryKey: ['all_fee_records'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fee_records')
        .select('*')
        .order('period_month', { ascending: false });
      if (error) throw error;
      return data as FeeRecord[];
    },
  });

  // Map: memberId -> current month fee record
  const currentMonthKey = getCurrentMonthKey();
  const memberCurrentFee = useMemo(() => {
    const map: Record<string, FeeRecord | undefined> = {};
    allFeeRecords.forEach(fr => {
      if (fr.period_month === currentMonthKey) {
        map[fr.member_id] = fr;
      }
    });
    return map;
  }, [allFeeRecords, currentMonthKey]);

  // Map: memberId -> all unpaid fee records
  const memberUnpaidFees = useMemo(() => {
    const map: Record<string, FeeRecord[]> = {};
    allFeeRecords.forEach(fr => {
      if (!fr.paid) {
        if (!map[fr.member_id]) map[fr.member_id] = [];
        map[fr.member_id].push(fr);
      }
    });
    // Sort each member's unpaid records oldest first
    Object.values(map).forEach(arr => arr.sort((a, b) => a.period_month.localeCompare(b.period_month)));
    return map;
  }, [allFeeRecords]);

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

  // Fetch Member Fee Records (for detail dialog)
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

  // Auto-generate missing fee records when opening member detail
  const generateMemberFees = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch('/api/fees/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate fee records');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member_fees'] });
      queryClient.invalidateQueries({ queryKey: ['all_fee_records'] });
    },
  });

  // When opening member detail, ensure fee records exist for all months
  useEffect(() => {
    if (selectedMember && detailOpen) {
      generateMemberFees.mutate(selectedMember.id);
    }
  }, [selectedMember?.id, detailOpen]);

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
  const currentAmountPaid = form.amount_paid === '' ? totalPayable : (isNaN(Number(form.amount_paid)) ? 0 : Number(form.amount_paid));
  const remainingFees = Math.max(0, totalPayable - currentAmountPaid);

  const cleanFormMemberNum = (form.member_number || '').trim();
  const dupMemberNumber = cleanFormMemberNum ? members.find((m) => {
    if (editing && m.id === editing.id) return false;
    const mNumClean = (m.member_number || '').trim();
    if (!mNumClean) return false;
    const numA = parseInt(cleanFormMemberNum, 10);
    const numB = parseInt(mNumClean, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA === numB;
    }
    return mNumClean.toLowerCase() === cleanFormMemberNum.toLowerCase();
  }) : null;

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      // Validate duplicate member number, phone or CNIC
      const cleanMemberNum = (data.member_number || '').trim();
      const cleanPhone = (data.phone || '').trim();
      const cleanCnic = (data.cnic || '').trim();
      const phoneDigits = cleanPhone.replace(/\D/g, '');
      const cnicDigits = cleanCnic.replace(/\D/g, '');

      if (!cleanMemberNum) {
        throw new Error('Member number is required.');
      }

      if (cleanMemberNum) {
        const dupMemberNum = members.find((m) => {
          if (editing && m.id === editing.id) return false;
          const mNumClean = (m.member_number || '').trim();
          if (!mNumClean) return false;
          const numA = parseInt(cleanMemberNum, 10);
          const numB = parseInt(mNumClean, 10);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numA === numB;
          }
          return mNumClean.toLowerCase() === cleanMemberNum.toLowerCase();
        });
        if (dupMemberNum) {
          throw new Error(`Member number "${cleanMemberNum}" already exists for member "${dupMemberNum.full_name}". Please enter a unique member number.`);
        }
      }

      if (phoneDigits) {
        const dupPhone = members.find((m) => {
          if (editing && m.id === editing.id) return false;
          const mDigits = (m.phone || '').replace(/\D/g, '');
          return mDigits.length > 0 && mDigits === phoneDigits;
        });
        if (dupPhone) {
          throw new Error(`Phone number already exists for member "${dupPhone.full_name}". Please try with a new number.`);
        }
      }

      if (cnicDigits) {
        const dupCnic = members.find((m) => {
          if (editing && m.id === editing.id) return false;
          const mDigits = (m.cnic || '').replace(/\D/g, '');
          return mDigits.length > 0 && mDigits === cnicDigits;
        });
        if (dupCnic) {
          throw new Error(`CNIC already exists for member "${dupCnic.full_name}". Please try with a new CNIC.`);
        }
      }

      const calcMonthly = Number(data.monthly_fee) || 0;
      const calcTraining = Number(data.training_fees) || 0;
      const totalFee = calcMonthly + calcTraining;
      const rawPaid = data.amount_paid === '' ? totalFee : Number(data.amount_paid);
      const paidAmount = isNaN(rawPaid) ? totalFee : rawPaid;

      const payload: Record<string, any> = {
        member_number: data.member_number,
        full_name: data.full_name,
        gender: data.gender || 'male',
        phone: data.phone || null,
        cnic: data.cnic || null,
        email: data.email || null,
        join_date: data.join_date,
        monthly_fee: calcMonthly,
        training_fees: calcTraining,
        trainer_id: data.trainer_id || null,
        amount_paid: paidAmount,
        notes: data.notes || null,
        photo_url: data.photo_url || null,
        active: data.active,
      };

      if (editing && !isAdmin) {
        // Staff member attempting to edit — submit to pending approvals instead of direct update
        const { error } = await supabase.from('member_pending_edits').insert({
          member_id: editing.id,
          requested_by: currentUser?.id,
          status: 'pending',
          changes: payload,
        });
        if (error) throw error;
        return { isPendingEdit: true };
      }

      if (!editing && currentUser?.id) {
        payload.created_by = currentUser.id;
      }

      let currentPayload: Record<string, any> = { ...payload };
      let newMember: any = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        if (editing) {
          const { data, error } = await supabase.from('members').update(currentPayload).eq('id', editing.id).select().single();
          if (!error) {
            newMember = data;
            break;
          }
          const missingCol = (
            error.message?.match(/Could not find the '([^']+)' column/i)?.[1] ||
            error.message?.match(/column [^\s\.]+\.([^\s]+) does not exist/i)?.[1] ||
            error.details?.match(/column [^\s\.]+\.([^\s]+) does not exist/i)?.[1]
          );
          if (missingCol && missingCol in currentPayload) {
            delete currentPayload[missingCol];
            continue;
          }
          let removed = false;
          for (const col of ['member_number', 'amount_paid', 'training_fees', 'trainer_id', 'gender', 'created_by']) {
            if (col in currentPayload && (error.message?.includes(col) || error.details?.includes(col))) {
              delete currentPayload[col];
              removed = true;
            }
          }
          if (removed) continue;
          throw error;
        } else {
          const { data, error } = await supabase.from('members').insert(currentPayload).select().single();
          if (!error) {
            newMember = data;
            break;
          }
          const missingCol = (
            error.message?.match(/Could not find the '([^']+)' column/i)?.[1] ||
            error.message?.match(/column [^\s\.]+\.([^\s]+) does not exist/i)?.[1] ||
            error.details?.match(/column [^\s\.]+\.([^\s]+) does not exist/i)?.[1]
          );
          if (missingCol && missingCol in currentPayload) {
            delete currentPayload[missingCol];
            continue;
          }
          let removed = false;
          for (const col of ['member_number', 'amount_paid', 'training_fees', 'trainer_id', 'created_by']) {
            if (col in currentPayload && (error.message?.includes(col) || error.details?.includes(col))) {
              delete currentPayload[col];
              removed = true;
            }
          }
          if (removed) continue;
          throw error;
        }
      }

      // Create initial fee record for new member with partial payment support
      if (!editing && newMember) {
        const isPaid = paidAmount >= totalFee && totalFee > 0;
        const joinDateStr = payload.join_date || new Date().toISOString().slice(0, 10);
        const [jYear, jMonth] = joinDateStr.split('-').map(Number);
        const periodMonth = `${jYear}-${String(jMonth).padStart(2, '0')}-01`;
        const lastDay = new Date(jYear, jMonth, 0).getDate();
        const periodEnd = `${jYear}-${String(jMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        await supabase.from('fee_records').insert({
          member_id: newMember.id,
          amount: totalFee,
          amount_paid: paidAmount,
          discount: 0,
          period_month: periodMonth,
          period_end: periodEnd,
          paid: isPaid,
          paid_at: paidAmount > 0 ? new Date().toISOString() : null,
          payment_method: 'cash',
        });
      }

      return { isPendingEdit: false };
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['all_fee_records'] });
      queryClient.invalidateQueries({ queryKey: ['member_pending_edits'] });
      queryClient.invalidateQueries({ queryKey: ['dash-fees'] });
      queryClient.invalidateQueries({ queryKey: ['dash-trend'] });
      queryClient.invalidateQueries({ queryKey: ['dash-active'] });
      if (result?.isPendingEdit) {
        toast.success('Member edit request submitted! Waiting for admin approval.');
      } else {
        toast.success(editing ? 'Member updated' : 'Member added');
      }
      stopCamera();
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const approveEditMutation = useMutation({
    mutationFn: async (pendingEdit: MemberPendingEdit) => {
      const { error: updateError } = await supabase
        .from('members')
        .update(pendingEdit.changes)
        .eq('id', pendingEdit.member_id);
      if (updateError) throw updateError;

      const { error: editError } = await supabase
        .from('member_pending_edits')
        .update({
          status: 'approved',
          reviewed_by: currentUser?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', pendingEdit.id);
      if (editError) throw editError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member_pending_edits'] });
      toast.success('Member details updated successfully!');
    },
    onError: (err: any) => {
      toast.error(`Approval failed: ${err.message}`);
    },
  });

  const rejectEditMutation = useMutation({
    mutationFn: async (pendingEdit: MemberPendingEdit) => {
      const { error } = await supabase
        .from('member_pending_edits')
        .update({
          status: 'rejected',
          reviewed_by: currentUser?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', pendingEdit.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member_pending_edits'] });
      toast.info('Pending edit request rejected.');
    },
    onError: (err: any) => {
      toast.error(`Rejection failed: ${err.message}`);
    },
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

  // Bulk payment mutation
  const bulkPayMutation = useMutation({
    mutationFn: async ({ feeIds, amountPaid, discount, paymentMethod }: { feeIds: string[]; amountPaid: number; discount: number; paymentMethod: string }) => {
      const res = await fetch('/api/fees/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeIds, amountPaid, discount, paymentMethod }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process payment');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all_fee_records'] });
      queryClient.invalidateQueries({ queryKey: ['member_fees'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['dash-fees'] });
      toast.success(`Payment processed! ${data.summary?.remaining > 0 ? `Remaining: ${formatCurrency(data.summary.remaining)}` : 'Fully paid!'}`);
      setPayModalOpen(false);
      setPayModalMember(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function openAnnouncements() {
    setAnnouncementMessage('');
    setAnnouncementSearch('');
    setBulkMode(false);
    setBulkCurrentIndex(0);
    setSentMemberIds([]);
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

  const handleSaveSenderPhone = () => {
    const cleanPhone = tempSenderPhone.trim();
    if (!cleanPhone) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setSenderPhone(cleanPhone);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_sender_phone', cleanPhone);
    }
    setIsEditingSender(false);
    toast.success(`Sender number updated to ${cleanPhone}`);
  };

  const handleSaveTemplate = () => {
    if (!newTemplateTitle.trim()) {
      toast.error('Please enter a template title');
      return;
    }
    if (!announcementMessage.trim()) {
      toast.error('Please enter a message before saving');
      return;
    }
    const newTpl: MessageTemplate = {
      id: Date.now().toString(),
      title: newTemplateTitle.trim(),
      message: announcementMessage.trim(),
    };
    const updated = [newTpl, ...templates];
    setTemplates(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_announcement_templates', JSON.stringify(updated));
    }
    toast.success(`Template "${newTpl.title}" saved successfully!`);
    setNewTemplateTitle('');
    setSaveTemplateDialogOpen(false);
  };

  const handleDeleteTemplate = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_announcement_templates', JSON.stringify(updated));
    }
    toast.success(`Template "${title}" removed`);
  };

  const validSelectedMembers = useMemo(() => {
    return members.filter((m) => selectedAnnounceMemberIds.includes(m.id) && !!formatPhoneForWA(m.phone));
  }, [members, selectedAnnounceMemberIds]);

  const handleSendWhatsApp = async () => {
    if (!announcementMessage.trim()) {
      toast.error('Please enter an announcement message');
      return;
    }
    if (selectedAnnounceMemberIds.length === 0) {
      toast.error('Please select at least one member');
      return;
    }
    if (validSelectedMembers.length === 0) {
      toast.error('None of the selected members have valid phone numbers');
      return;
    }

    setSendingBulk(true);
    try {
      const recipients = validSelectedMembers.map((m) => ({
        phone: m.phone!,
        name: m.full_name,
      }));

      const res = await fetch('/api/announcements/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: announcementMessage,
          recipients,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch WhatsApp announcement');
      }

      setSentMemberIds(validSelectedMembers.map((m) => m.id));
      toast.success(
        `Dispatched bulk WhatsApp announcement to ${data.details?.totalSent || recipients.length} members!`
      );
      setAnnouncementOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Error dispatching WhatsApp announcement');
    } finally {
      setSendingBulk(false);
    }
  };


  const handleBulkSendNext = () => {
    if (bulkCurrentIndex >= validSelectedMembers.length) return;
    const currentMember = validSelectedMembers[bulkCurrentIndex];
    const phone = formatPhoneForWA(currentMember.phone);
    const encodedMsg = encodeURIComponent(announcementMessage);

    window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
    setSentMemberIds((prev) => Array.from(new Set([...prev, currentMember.id])));
    toast.success(`Sent to ${currentMember.full_name} (${bulkCurrentIndex + 1}/${validSelectedMembers.length})`);

    if (bulkCurrentIndex + 1 < validSelectedMembers.length) {
      setBulkCurrentIndex(bulkCurrentIndex + 1);
    } else {
      toast.success('All bulk WhatsApp messages completed!');
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
      queryClient.invalidateQueries({ queryKey: ['all_fee_records'] });
      queryClient.invalidateQueries({ queryKey: ['member_fees'] });
      toast.success('Fees generated successfully');
    },
    onError: (e) => toast.error(e.message),
  });

  function openAdd() {
    setEditing(null);
    stopCamera();

    // Auto-generate member number (1, 2, etc.)
    let maxNum = 0;
    members.forEach((m) => {
      if (m.member_number) {
        const num = parseInt(m.member_number, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum > 0 ? maxNum + 1 : members.length + 1;
    const generatedNum = String(nextNum);

    setForm({
      member_number: generatedNum,
      full_name: '',
      gender: 'male',
      phone: '',
      cnic: '',
      email: '',
      join_date: new Date().toISOString().slice(0, 10),
      monthly_fee: '',
      training_fees: '',
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
      gender: m.gender || 'male',
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

  // Open Payment Modal
  function openPayModal(m: Member) {
    setPayModalMember(m);
    setPayDiscount('0');
    setPayAmountReceived('');
    setPayMethod('cash');
    setPayModalOpen(true);
  }

  // Payment modal calculations
  const payModalUnpaidFees = payModalMember ? (memberUnpaidFees[payModalMember.id] || []) : [];
  const payModalTotalDue = payModalUnpaidFees.reduce((sum, fr) => {
    const remaining = (Number(fr.amount) || 0) - (Number(fr.amount_paid) || 0);
    return sum + Math.max(0, remaining);
  }, 0);
  const payModalDiscountNum = Math.max(0, Number(payDiscount) || 0);
  const payModalReceivedNum = Number(payAmountReceived) || 0;
  const payModalNetRemaining = Math.max(0, payModalTotalDue - payModalDiscountNum - payModalReceivedNum);

  function handlePaySubmit() {
    if (!payModalMember || payModalUnpaidFees.length === 0) return;
    if (payModalReceivedNum <= 0 && payModalDiscountNum <= 0) {
      toast.error('Please enter amount received or discount');
      return;
    }
    bulkPayMutation.mutate({
      feeIds: payModalUnpaidFees.map(f => f.id),
      amountPaid: payModalReceivedNum,
      discount: payModalDiscountNum,
      paymentMethod: payMethod,
    });
  }

  // Staff users only see members assigned to them; admins see all
  const staffFilteredMembers = useMemo(() => {
    if (isAdmin || !currentUser?.id) return members;
    return members.filter((m) => m.assigned_staff_id === currentUser.id);
  }, [members, isAdmin, currentUser?.id]);

  const filtered = staffFilteredMembers.filter((m) => {
    const cleanSearch = search.trim().toLowerCase();
    const matchSearch =
      !cleanSearch ||
      m.full_name.toLowerCase().includes(cleanSearch) ||
      (m.phone || '').toLowerCase().includes(cleanSearch) ||
      (m.member_number || '').toLowerCase().includes(cleanSearch) ||
      (m.cnic || '').toLowerCase().includes(cleanSearch);
    const matchFilter = filter === 'all' ? true : filter === 'active' ? m.active : !m.active;
    const mGender = (m.gender || 'male').toLowerCase();
    const matchGender = genderFilter === 'all' ? true : mGender === genderFilter;
    return matchSearch && matchFilter && matchGender;
  });

  // Helper to get payment status info for a member
  function getMemberPaymentStatus(m: Member) {
    const currentFee = memberCurrentFee[m.id];
    const unpaidFees = memberUnpaidFees[m.id] || [];
    const unpaidMonths = unpaidFees.length;
    const totalFee = (m.monthly_fee || 0) + (m.training_fees || 0);

    if (!currentFee) {
      // No fee record for current month — treated as unpaid
      return {
        status: 'unpaid' as const,
        percentage: 0,
        label: 'Unpaid',
        unpaidMonths: Math.max(1, unpaidMonths),
        totalDue: totalFee * Math.max(1, unpaidMonths),
      };
    }

    const amountPaid = Number(currentFee.amount_paid) || 0;
    const feeAmount = Number(currentFee.amount) || 0;
    const discount = Number(currentFee.discount) || 0;
    const effectiveDue = Math.max(0, feeAmount - discount);
    const percentage = effectiveDue > 0 ? Math.min(100, Math.round((amountPaid / effectiveDue) * 100)) : (feeAmount === 0 ? 100 : 0);

    if (currentFee.paid) {
      return {
        status: 'paid' as const,
        percentage: 100,
        label: '100% Paid',
        unpaidMonths: Math.max(0, unpaidMonths),
        totalDue: 0,
      };
    }

    if (amountPaid > 0 && amountPaid < effectiveDue) {
      return {
        status: 'partial' as const,
        percentage,
        label: `${percentage}% Paid`,
        unpaidMonths,
        totalDue: unpaidFees.reduce((s, f) => s + Math.max(0, (Number(f.amount) || 0) - (Number(f.amount_paid) || 0)), 0),
      };
    }

    return {
      status: 'unpaid' as const,
      percentage: 0,
      label: 'Unpaid',
      unpaidMonths,
      totalDue: unpaidFees.reduce((s, f) => s + Math.max(0, (Number(f.amount) || 0) - (Number(f.amount_paid) || 0)), 0),
    };
  }

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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search CNIC, Member ID, Name..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-9 h-9 text-sm" 
            />
          </div>

          {/* Member Status Filters: All, Active, Inactive, Pending Approvals */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
            <Button
              type="button"
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
              className={`h-7 px-3 text-xs font-semibold rounded-md transition-all ${
                filter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({members.length})
            </Button>
            <Button
              type="button"
              variant={filter === 'active' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('active')}
              className={`h-7 px-3 text-xs font-semibold rounded-md transition-all ${
                filter === 'active' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active ({members.filter((m) => m.active).length})
            </Button>
            <Button
              type="button"
              variant={filter === 'inactive' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('inactive')}
              className={`h-7 px-3 text-xs font-semibold rounded-md transition-all ${
                filter === 'inactive' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Inactive ({members.filter((m) => !m.active).length})
            </Button>
            {isAdmin && (
              <Button
                type="button"
                variant={filter === 'pending' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('pending')}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  filter === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-500/10'
                }`}
              >
                <span>Pending Approvals</span>
                {pendingEdits.length > 0 && (
                  <Badge className="h-5 px-1.5 bg-amber-500 text-white font-extrabold text-[11px] rounded-full">
                    {pendingEdits.length}
                  </Badge>
                )}
              </Button>
            )}
          </div>

          {/* Gender Filter Buttons: All, Male, Female */}
          {isAdmin && filter !== 'pending' ? (
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
              <Button
                type="button"
                variant={genderFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setGenderFilter('all')}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all ${
                  genderFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </Button>
              <Button
                type="button"
                variant={genderFilter === 'male' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setGenderFilter('male')}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all ${
                  genderFilter === 'male' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Male
              </Button>
              <Button
                type="button"
                variant={genderFilter === 'female' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setGenderFilter('female')}
                className={`h-7 px-3 text-xs font-semibold rounded-md transition-all ${
                  genderFilter === 'female' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Female
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {isAdmin && filter === 'pending' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold">Pending Member Approvals</h2>
              <Badge className="bg-amber-500 text-white font-bold">{pendingEdits.length}</Badge>
            </div>
          </div>

          {pendingEdits.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="font-medium text-base">No pending approvals</p>
                <p className="text-xs text-muted-foreground mt-1">All member edit requests submitted by staff members have been reviewed.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingEdits.map((pe) => {
                const targetMember = members.find((m) => m.id === pe.member_id);
                const staffProfile = profiles.find((p) => p.id === pe.requested_by);
                const changes = pe.changes || {};

                // Calculate diffs between targetMember & proposed changes
                const diffs: { field: string; oldVal: string; newVal: string }[] = [];
                if (targetMember) {
                  if (changes.full_name && changes.full_name !== targetMember.full_name) {
                    diffs.push({ field: 'Full Name', oldVal: targetMember.full_name, newVal: changes.full_name });
                  }
                  if (changes.member_number && changes.member_number !== targetMember.member_number) {
                    diffs.push({ field: 'Member #', oldVal: targetMember.member_number || '—', newVal: changes.member_number });
                  }
                  if (changes.phone !== undefined && changes.phone !== targetMember.phone) {
                    diffs.push({ field: 'Phone', oldVal: targetMember.phone || '—', newVal: changes.phone || '—' });
                  }
                  if (changes.cnic !== undefined && changes.cnic !== targetMember.cnic) {
                    diffs.push({ field: 'CNIC', oldVal: targetMember.cnic || '—', newVal: changes.cnic || '—' });
                  }
                  if (changes.gender && changes.gender !== targetMember.gender) {
                    diffs.push({ field: 'Gender', oldVal: targetMember.gender || 'male', newVal: changes.gender });
                  }
                  if (changes.monthly_fee !== undefined && Number(changes.monthly_fee) !== Number(targetMember.monthly_fee)) {
                    diffs.push({ field: 'Monthly Fee', oldVal: formatCurrency(targetMember.monthly_fee), newVal: formatCurrency(Number(changes.monthly_fee)) });
                  }
                  if (changes.training_fees !== undefined && Number(changes.training_fees) !== Number(targetMember.training_fees)) {
                    diffs.push({ field: 'Training Fee', oldVal: formatCurrency(targetMember.training_fees), newVal: formatCurrency(Number(changes.training_fees)) });
                  }
                  if (changes.trainer_id !== undefined && changes.trainer_id !== targetMember.trainer_id) {
                    const oldTr = trainers.find((t) => t.id === targetMember.trainer_id)?.name || 'None';
                    const newTr = trainers.find((t) => t.id === changes.trainer_id)?.name || 'None';
                    diffs.push({ field: 'Trainer', oldVal: oldTr, newVal: newTr });
                  }
                  if (changes.active !== undefined && changes.active !== targetMember.active) {
                    diffs.push({ field: 'Status', oldVal: targetMember.active ? 'Active' : 'Inactive', newVal: changes.active ? 'Active' : 'Inactive' });
                  }
                  if (changes.notes !== undefined && changes.notes !== targetMember.notes) {
                    diffs.push({ field: 'Notes', oldVal: targetMember.notes || '—', newVal: changes.notes || '—' });
                  }
                }

                return (
                  <Card key={pe.id} className="border border-amber-500/40 bg-amber-500/5 shadow-sm overflow-hidden">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                        <div className="flex items-center gap-3">
                          {targetMember?.photo_url ? (
                            <img src={targetMember.photo_url} alt={targetMember.full_name} className="h-10 w-10 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-primary/20 grid place-items-center text-sm font-semibold text-primary">
                              {(targetMember?.full_name || changes.full_name || 'M').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base">{targetMember?.full_name || changes.full_name || 'Member'}</span>
                              <Badge variant="outline" className="font-mono text-xs">#{targetMember?.member_number || changes.member_number || '—'}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span>Edited by: <strong className="text-foreground">{staffProfile?.full_name || 'Staff Member'}</strong></span>
                              <span>•</span>
                              <span>{new Date(pe.created_at).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <Badge className="bg-amber-500 text-white font-bold px-3 py-1">
                          ⏳ Waiting for Approval
                        </Badge>
                      </div>

                      {/* Proposed Changes */}
                      <div className="py-4 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Proposed Changes</h4>
                        {diffs.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Member details update submitted.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {diffs.map((d, idx) => (
                              <div key={idx} className="p-2.5 rounded-lg bg-background border border-border text-xs">
                                <span className="font-semibold text-muted-foreground block mb-1">{d.field}</span>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="line-through text-muted-foreground">{d.oldVal}</span>
                                  <span>→</span>
                                  <span className="font-bold text-green-600 dark:text-green-400">{d.newVal}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
                        {isAdmin ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/50 text-destructive hover:bg-destructive/10"
                              disabled={rejectEditMutation.isPending}
                              onClick={() => rejectEditMutation.mutate(pe)}
                            >
                              <XCircle className="h-4 w-4 mr-1.5" /> Reject Request
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm"
                              disabled={approveEditMutation.isPending}
                              onClick={() => approveEditMutation.mutate(pe)}
                            >
                              <Check className="h-4 w-4 mr-1.5" /> Approve & Update Member
                            </Button>
                          </>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400 italic">Only admins can approve or reject edit requests.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
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
                    {isAdmin && (
                      <th className="text-left p-4 font-medium text-muted-foreground hidden lg:table-cell">Added By</th>
                    )}
                    <th className="text-left p-4 font-medium text-muted-foreground">Total Fee</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Payment Status</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-muted-foreground">No members found</td></tr>
                  ) : filtered.map((m) => {
                    const assignedTrainer = trainers.find((t) => t.id === m.trainer_id);
                    const totalFee = (m.monthly_fee || 0) + (m.training_fees || 0);
                    const payStatus = getMemberPaymentStatus(m);
                    const pendingEditReq = pendingEditsByMemberId[m.id];

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
                            <div className="flex flex-col">
                              <span className="font-medium">{m.full_name}</span>
                              {pendingEditReq && (
                                <Badge variant="outline" className="w-fit border-amber-500 text-amber-600 bg-amber-500/10 font-bold text-[10px] px-1.5 py-0 mt-0.5 animate-pulse">
                                  ⏳ Waiting for Approval
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden sm:table-cell text-muted-foreground">{m.phone || '—'}</td>
                        <td className="p-4 hidden md:table-cell text-muted-foreground font-mono text-xs">{m.cnic || '—'}</td>
                        <td className="p-4 hidden lg:table-cell text-muted-foreground">
                          {assignedTrainer ? (
                            <Badge variant="outline" className="font-normal">{assignedTrainer.name}</Badge>
                          ) : '—'}
                        </td>
                        {isAdmin && (
                          <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs font-medium">
                            {(() => {
                              if (!m.created_by) return '—';
                              const staff = profiles.find((p) => p.id === m.created_by);
                              return staff ? (
                                <span className="inline-flex items-center gap-1 bg-accent/60 text-foreground px-2 py-0.5 rounded border border-border/60">
                                  <User className="h-3 w-3 text-primary" />
                                  {staff.full_name}
                                </span>
                              ) : '—';
                            })()}
                          </td>
                        )}
                        <td className="p-4 font-medium">{formatCurrency(totalFee)}</td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {payStatus.status === 'paid' ? (
                              <Badge variant="success" className="font-semibold px-2.5 py-0.5">✅ Paid</Badge>
                            ) : payStatus.status === 'partial' ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="border-2 border-amber-500 text-amber-600 bg-amber-500/10 font-bold px-2.5 py-0.5">
                                  ⚠️ {payStatus.percentage}% Paid
                                </Badge>
                                <Button size="sm" variant="default" className="h-7 text-xs px-2 bg-primary hover:bg-primary/90" onClick={() => openPayModal(m)}>
                                  <Wallet className="h-3 w-3 mr-1" /> Pay
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive" className="font-bold px-2.5 py-0.5">
                                  ❌ Unpaid
                                  {payStatus.unpaidMonths > 1 && (
                                    <span className="ml-1 text-[10px] opacity-80">({payStatus.unpaidMonths} mo)</span>
                                  )}
                                </Badge>
                                <Button size="sm" variant="default" className="h-7 text-xs px-2 bg-primary hover:bg-primary/90" onClick={() => openPayModal(m)}>
                                  <Wallet className="h-3 w-3 mr-1" /> Pay
                                </Button>
                              </div>
                            )}
                          </div>
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
      )}

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
              {/* Member Number (Editable) */}
              <div className="space-y-2">
                <Label>Member Number *</Label>
                <Input
                  required
                  value={form.member_number}
                  onChange={(e) => setForm({ ...form, member_number: e.target.value })}
                  placeholder="e.g. 1"
                  className={`font-mono font-bold text-primary ${
                    dupMemberNumber ? 'border-destructive focus-visible:ring-destructive' : ''
                  }`}
                />
                {dupMemberNumber && (
                  <p className="text-xs font-medium text-destructive">
                    Member number &quot;{cleanFormMemberNum}&quot; already exists ({dupMemberNumber.full_name}).
                  </p>
                )}
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. John Doe" />
              </div>

              {/* Gender Selection */}
              <div className="space-y-2">
                <Label>Gender *</Label>
                <Select value={form.gender} onValueChange={(val) => setForm({ ...form, gender: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
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
              <Button type="submit" disabled={saveMutation.isPending || !!dupMemberNumber}>
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
              <TabsTrigger value="fees">Fee History</TabsTrigger>
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
                  <div className="text-muted-foreground mb-1">Gender</div>
                  <div className="font-medium capitalize">{selectedMember?.gender || 'male'}</div>
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
              {/* Fee History Summary */}
              {selectedMember && (
                <div className="mb-4 p-3 rounded-lg bg-muted/40 border border-border">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-primary" />
                      <span className="font-semibold">Fee History</span>
                    </div>
                    {(() => {
                      const unpaid = memberFees.filter(f => !f.paid);
                      const totalUnpaid = unpaid.reduce((s, f) => s + Math.max(0, (Number(f.amount) || 0) - (Number(f.amount_paid) || 0)), 0);
                      return unpaid.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive" className="text-xs">
                            {unpaid.length} unpaid month{unpaid.length > 1 ? 's' : ''} — {formatCurrency(totalUnpaid)} due
                          </Badge>
                          <Button size="sm" className="h-7 text-xs" onClick={() => { setDetailOpen(false); openPayModal(selectedMember); }}>
                            <Wallet className="h-3 w-3 mr-1" /> Collect
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="success" className="text-xs">All paid ✓</Badge>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground">Period</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Paid</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Discount</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Paid At</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingFees || generateMemberFees.isPending ? (
                      <tr><td colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                    ) : memberFees.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No fee records found</td></tr>
                    ) : memberFees.map(fee => {
                      const isPaid = fee.paid ?? (fee.status === 'paid');
                      const feeAmount = Number(fee.amount) || 0;
                      const feePaid = Number(fee.amount_paid) || 0;
                      const feeDiscount = Number(fee.discount) || 0;
                      const effectiveDue = Math.max(0, feeAmount - feeDiscount);
                      const remaining = Math.max(0, effectiveDue - feePaid);
                      const pctPaid = effectiveDue > 0 ? Math.min(100, Math.round((feePaid / effectiveDue) * 100)) : (feeAmount === 0 ? 100 : 0);
                      const isPartial = feePaid > 0 && !isPaid;

                      return (
                        <tr key={fee.id} className="border-b border-border/50 last:border-0">
                          <td className="p-3 font-medium">{formatPeriodMonth(fee.period_month)}</td>
                          <td className="p-3">{formatCurrency(feeAmount)}</td>
                          <td className="p-3">
                            <span className={isPaid ? 'text-green-600 font-semibold' : isPartial ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                              {formatCurrency(feePaid)}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {feeDiscount > 0 ? formatCurrency(feeDiscount) : '—'}
                          </td>
                          <td className="p-3">
                            {isPaid ? (
                              <Badge variant="success" className="text-xs">PAID</Badge>
                            ) : isPartial ? (
                              <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10 text-xs font-bold">
                                {pctPaid}% ({formatCurrency(remaining)} due)
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">UNPAID</Badge>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground text-xs">{fee.paid_at ? formatDate(fee.paid_at) : '—'}</td>
                          <td className="p-3 text-muted-foreground text-xs capitalize">{fee.payment_method || '—'}</td>
                        </tr>
                      );
                    })}
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

      {/* Payment Collection Modal */}
      <Dialog open={payModalOpen} onOpenChange={(open) => { setPayModalOpen(open); if (!open) setPayModalMember(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Collect Payment
            </DialogTitle>
          </DialogHeader>

          {payModalMember && (
            <div className="space-y-5 pt-2">
              {/* Member Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                {payModalMember.photo_url ? (
                  <img src={payModalMember.photo_url} alt={payModalMember.full_name} className="h-10 w-10 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/20 grid place-items-center text-sm font-semibold text-primary">
                    {payModalMember.full_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold">{payModalMember.full_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">#{payModalMember.member_number || 'N/A'}</div>
                </div>
              </div>

              {/* Unpaid Months Breakdown */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Unpaid Months Breakdown
                </Label>
                <div className="rounded-md border border-border max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left p-2 font-medium text-muted-foreground">Month</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Fee</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Already Paid</th>
                        <th className="text-right p-2 font-medium text-muted-foreground">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payModalUnpaidFees.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">No unpaid fees</td></tr>
                      ) : payModalUnpaidFees.map(fr => {
                        const amt = Number(fr.amount) || 0;
                        const paid = Number(fr.amount_paid) || 0;
                        const rem = Math.max(0, amt - paid);
                        return (
                          <tr key={fr.id} className="border-b border-border/50 last:border-0">
                            <td className="p-2 font-medium">{formatPeriodMonth(fr.period_month)}</td>
                            <td className="p-2 text-right">{formatCurrency(amt)}</td>
                            <td className="p-2 text-right text-green-600">{paid > 0 ? formatCurrency(paid) : '—'}</td>
                            <td className="p-2 text-right font-semibold text-red-500">{formatCurrency(rem)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Due */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-red-600">Total Due</span>
                  <span className="text-xl font-bold text-red-600">{formatCurrency(payModalTotalDue)}</span>
                </div>
                <div className="text-xs text-red-500/70 mt-1">
                  {payModalUnpaidFees.length} unpaid month{payModalUnpaidFees.length !== 1 ? 's' : ''}
                  {payModalUnpaidFees.length > 0 && ` × ${formatCurrency((payModalMember.monthly_fee || 0) + (payModalMember.training_fees || 0))}/mo`}
                </div>
              </div>

              {/* Discount Field */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Discount (PKR)</Label>
                <Input 
                  type="number" 
                  value={payDiscount} 
                  onChange={(e) => setPayDiscount(e.target.value)} 
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Amount Received Field */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Amount Received (PKR)</Label>
                <Input 
                  type="number" 
                  value={payAmountReceived} 
                  onChange={(e) => setPayAmountReceived(e.target.value)} 
                  placeholder={String(Math.max(0, payModalTotalDue - payModalDiscountNum))}
                  min="0"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(pm => (
                      <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Calculation Summary */}
              <div className="bg-muted/40 border border-border rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Due</span>
                  <span className="font-medium">{formatCurrency(payModalTotalDue)}</span>
                </div>
                {payModalDiscountNum > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-medium text-green-600">- {formatCurrency(payModalDiscountNum)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Received</span>
                  <span className="font-medium text-green-600">- {formatCurrency(payModalReceivedNum)}</span>
                </div>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="font-semibold text-sm">Remaining Balance</span>
                    <span className={`text-lg font-bold ${payModalNetRemaining > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {payModalNetRemaining > 0 ? formatCurrency(payModalNetRemaining) : 'PKR 0 ✓'}
                    </span>
                  </div>
                  {payModalNetRemaining > 0 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      ⚠️ This amount will remain as partial payment. The member will still show as partially paid.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" onClick={() => { setPayModalOpen(false); setPayModalMember(null); }}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={handlePaySubmit}
              disabled={bulkPayMutation.isPending || payModalUnpaidFees.length === 0}
              className="bg-primary"
            >
              {bulkPayMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Wallet className="h-4 w-4 mr-2" />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Announcements Dialog */}
      <Dialog open={announcementOpen} onOpenChange={setAnnouncementOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-green-600" />
                Send Announcement via WhatsApp
              </DialogTitle>

              {/* Sender Phone Bar */}
              {/* <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border border-border text-xs">
                <PhoneCall className="h-3.5 w-3.5 text-green-600" />
                <span className="text-muted-foreground font-medium">Sender:</span>
                {isEditingSender ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={tempSenderPhone}
                      onChange={(e) => setTempSenderPhone(e.target.value)}
                      className="h-6 w-32 text-xs font-mono px-1 py-0"
                    />
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSaveSenderPhone}>
                      <Save className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-semibold text-foreground">{senderPhone}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => { setTempSenderPhone(senderPhone); setIsEditingSender(true); }}
                      title="Edit sender phone number"
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div> */}
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Announcement Message Field & Save for Later */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="announcement-message" className="font-semibold text-sm">
                  Announcement Message *
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!announcementMessage.trim()) {
                      toast.error('Please write a message before saving it as a template');
                      return;
                    }
                    setSaveTemplateDialogOpen(true);
                  }}
                  className="h-7 text-xs gap-1 text-primary hover:text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save Message for Later
                </Button>
              </div>

              <textarea
                id="announcement-message"
                rows={4}
                value={announcementMessage}
                onChange={(e) => setAnnouncementMessage(e.target.value)}
                placeholder="Type your message here (e.g. Gym timing updates, special offers, fee reminders)..."
                className="w-full rounded-md border border-input bg-background p-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              {/* Saved Message Templates Buttons */}
              {templates.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Bookmark className="h-3 w-3 text-primary" /> Saved Message Templates:
                  </span>
                  <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-1">
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => {
                          setAnnouncementMessage(tpl.message);
                          toast.success(`Loaded "${tpl.title}" into message field`);
                        }}
                        className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer shadow-sm hover:shadow"
                        title={tpl.message}
                      >
                        <MessageSquare className="h-3 w-3 text-primary" />
                        <span>{tpl.title}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteTemplate(tpl.id, tpl.title, e)}
                          className="ml-1 text-muted-foreground hover:text-red-500 opacity-60 group-hover:opacity-100 transition-opacity p-0.5"
                          title="Delete template"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Broadcast Queue Section */}
            {bulkMode && validSelectedMembers.length > 0 ? (
              <div className="border border-green-500/40 bg-green-50/30 dark:bg-green-950/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600 text-white font-mono text-xs">
                      Bulk WhatsApp Queue
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">
                      Member {bulkCurrentIndex + 1} of {validSelectedMembers.length}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBulkMode(false)}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Exit Bulk Queue
                  </Button>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-green-600 h-2 transition-all duration-300 rounded-full"
                    style={{
                      width: `${Math.round(((bulkCurrentIndex + (sentMemberIds.includes(validSelectedMembers[bulkCurrentIndex]?.id) ? 1 : 0)) / validSelectedMembers.length) * 100)}%`,
                    }}
                  />
                </div>

                {/* Current Recipient Details Card */}
                {validSelectedMembers[bulkCurrentIndex] && (
                  <div className="flex items-center justify-between p-3 bg-background border border-border rounded-md shadow-sm">
                    <div className="flex items-center gap-3">
                      {validSelectedMembers[bulkCurrentIndex].photo_url ? (
                        <img
                          src={validSelectedMembers[bulkCurrentIndex].photo_url!}
                          alt={validSelectedMembers[bulkCurrentIndex].full_name}
                          className="h-10 w-10 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-green-600/20 grid place-items-center font-bold text-green-700 dark:text-green-400">
                          {validSelectedMembers[bulkCurrentIndex].full_name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-2">
                          {validSelectedMembers[bulkCurrentIndex].full_name}
                          {sentMemberIds.includes(validSelectedMembers[bulkCurrentIndex].id) && (
                            <Badge variant="outline" className="text-[10px] text-green-600 border-green-600 bg-green-50 dark:bg-green-950/40">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Sent
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          #{validSelectedMembers[bulkCurrentIndex].member_number || 'N/A'} • {validSelectedMembers[bulkCurrentIndex].phone}
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white font-medium gap-1.5"
                      onClick={handleBulkSendNext}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send & Next ({bulkCurrentIndex + 1}/{validSelectedMembers.length})
                    </Button>
                  </div>
                )}

                {/* Queue Control Buttons */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={bulkCurrentIndex === 0}
                      onClick={() => setBulkCurrentIndex((prev) => Math.max(0, prev - 1))}
                      className="h-7 text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={bulkCurrentIndex >= validSelectedMembers.length - 1}
                      onClick={() => setBulkCurrentIndex((prev) => Math.min(validSelectedMembers.length - 1, prev + 1))}
                      className="h-7 text-xs"
                    >
                      <SkipForward className="h-3 w-3 mr-1" /> Skip
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSentMemberIds([]);
                      setBulkCurrentIndex(0);
                      toast.info('Bulk broadcast progress reset');
                    }}
                    className="h-7 text-xs text-muted-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset Progress
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Member Selection Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Select Recipient Members</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {selectedAnnounceMemberIds.length} / {members.length} Selected
                  </Badge>
                  {validSelectedMembers.length > 1 && !bulkMode && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBulkMode(true);
                        setBulkCurrentIndex(0);
                      }}
                      className="h-6 text-[11px] text-green-600 border-green-600/40 hover:bg-green-50 dark:hover:bg-green-950/40 px-2"
                    >
                      Start Bulk Queue
                    </Button>
                  )}
                </div>
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
                    const isSent = sentMemberIds.includes(m.id);
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
                            <div className="font-medium text-sm leading-none flex items-center gap-2">
                              {m.full_name}
                              {isSent && (
                                <Badge variant="outline" className="text-[10px] text-green-600 border-green-600 bg-green-50 py-0 px-1">
                                  ✓ Sent
                                </Badge>
                              )}
                            </div>
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
                              setSentMemberIds((prev) => Array.from(new Set([...prev, m.id])));
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
            <Button type="button" variant="outline" onClick={() => setAnnouncementOpen(false)} disabled={sendingBulk}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sendingBulk}
              className="bg-green-600 hover:bg-green-700 text-white font-medium gap-2"
              onClick={handleSendWhatsApp}
            >
              {sendingBulk ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Dispatching ({validSelectedMembers.length})...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Send Bulk Announcement ({validSelectedMembers.length})
                </>
              )}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Save Template Title Dialog */}
      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <BookmarkPlus className="h-5 w-5 text-primary" />
              Save Announcement Template
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="template-title" className="font-medium text-sm">
              Template Title *
            </Label>
            <Input
              id="template-title"
              placeholder="e.g. Welcome message, Fee Reminder, Eid Wish..."
              value={newTemplateTitle}
              onChange={(e) => setNewTemplateTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTemplate();
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Saving this will add a quick button under the announcement box so you can reload this text anytime.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSaveTemplateDialogOpen(false);
                setNewTemplateTitle('');
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveTemplate} className="bg-primary text-primary-foreground font-medium">
              <Save className="h-4 w-4 mr-1.5" /> Save Template
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
