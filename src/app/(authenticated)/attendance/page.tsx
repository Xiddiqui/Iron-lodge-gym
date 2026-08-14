'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/use-session';
import { useRole } from '@/hooks/use-role';
import { fetchStaffAttendanceForDate, formatMinutes, StaffDayAttendance } from '@/lib/staff-attendance';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CalendarCheck, Plus, Search, Loader2, Clock, LogOut,
  UserCheck, Shield, Coffee, ChevronDown, ChevronUp, UserX, AlertCircle, Wifi, Fingerprint, CheckCircle, Banknote, X
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
type FeeStatus = 'paid' | 'partial' | 'due' | 'overdue';
interface MemberFeeInfo {
  status: FeeStatus;
  amountDue?: number;
  amountPaid?: number;
  totalAmount?: number;
  paidPercent?: number;
}

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: userRole } = useRole();

  const [activeTab, setActiveTab] = useState<'member' | 'staff'>('member');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [staffDate, setStaffDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // 1-Day walk-in dialog state
  const [oneDayDialogOpen, setOneDayDialogOpen] = useState(false);
  const [oneDayName, setOneDayName] = useState('');
  const [oneDayAmount, setOneDayAmount] = useState('');
  const [oneDaySubmitting, setOneDaySubmitting] = useState(false);

  // --- Live data state (driven by realtime sockets) ---
  const [attendance, setAttendance] = useState<any[]>([]);
  const [memberFeeStatuses, setMemberFeeStatuses] = useState<Record<string, MemberFeeInfo>>({});
  const [isLoadingMemberAtt, setIsLoadingMemberAtt] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffDayAttendance[]>([]);
  const [isLoadingStaffAtt, setIsLoadingStaffAtt] = useState(false);
  const [staffAttError, setStaffAttError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastBiometricPing, setLastBiometricPing] = useState<string | null>(null);
  // --- Member attendance search & fee status filtering ---
  const [feeFilter, setFeeFilter] = useState<'all' | 'unpaid' | 'paid' | 'overdue' | 'due' | 'partial'>('all');
  const [attSearch, setAttSearch] = useState('');

  const isAdmin = userRole === 'admin';

  // ─────────────────────────────────────────────────────────────────
  // Compute fee status from a fee record
  // ─────────────────────────────────────────────────────────────────
  const computeFeeStatus = (fr: any): MemberFeeInfo => {
    const feeAmount   = Number(fr.amount)      || 0;
    const discount    = Number(fr.discount)    || 0;
    const amountPaid  = Number(fr.amount_paid) || 0;
    const isPaid      = fr.paid === true || fr.status === 'paid';
    const netDue      = Math.max(0, feeAmount - discount - amountPaid);
    const today       = new Date();

    let status: FeeStatus;

    if (isPaid || netDue === 0) {
      status = 'paid';
    } else if (amountPaid > 0 && netDue > 0) {
      // Partial payment made
      status = 'partial';
    } else if (fr.period_end && new Date(fr.period_end) < today) {
      status = 'overdue';
    } else {
      status = 'due';
    }

    const totalForPercent = Math.max(feeAmount - discount, 1);
    const paidPercent = Math.round((amountPaid / totalForPercent) * 100);

    return {
      status,
      amountDue: netDue > 0 ? netDue : undefined,
      amountPaid: amountPaid > 0 ? amountPaid : undefined,
      totalAmount: feeAmount - discount,
      paidPercent: status === 'partial' ? paidPercent : undefined,
    };
  };

  // ─────────────────────────────────────────────────────────────────
  // Fetch member attendance for a date
  // ─────────────────────────────────────────────────────────────────
  const loadMemberAttendance = useCallback(async (forDate: string) => {
    setIsLoadingMemberAtt(true);
    const nextDay = new Date(forDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const { data, error } = await supabase
      .from('attendance')
      .select('*, members(full_name, phone), profiles(full_name)')
      .gte('check_in', `${forDate}T00:00:00`)
      .lt('check_in', nextDay.toISOString().slice(0, 10) + 'T00:00:00')
      .order('check_in', { ascending: false });
    // Note: guest_name and notes columns added in migration 019

    if (!error && data) {
      setAttendance(data ?? []);

      // Track last biometric device activity
      const lastBio = (data ?? []).find((a: any) => a.source === 'biometric');
      if (lastBio) setLastBiometricPing(lastBio.check_in);

      // Fetch latest fee status for each member present
      const memberIds = Array.from(new Set(data.map((a: any) => a.member_id).filter(Boolean)));
      if (memberIds.length > 0) {
        const { data: feeData } = await supabase
          .from('fee_records')
          .select('member_id, paid, amount, discount, amount_paid, period_month, period_end, status')
          .in('member_id', memberIds)
          .order('period_month', { ascending: false });

        if (feeData) {
          const feeMap: Record<string, MemberFeeInfo> = {};

          // Group by member_id, take the most recent record per member
          feeData.forEach((fr: any) => {
            if (!feeMap[fr.member_id]) {
              feeMap[fr.member_id] = computeFeeStatus(fr);
            }
          });

          setMemberFeeStatuses(feeMap);
        }
      } else {
        setMemberFeeStatuses({});
      }
    }
    setIsLoadingMemberAtt(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Fetch active members list
  // ─────────────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('members')
      .select('id, full_name, phone')
      .eq('active', true)
      .order('full_name');
    setMembers(data ?? []);
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Fetch staff attendance for a date
  // ─────────────────────────────────────────────────────────────────
  const loadStaffAttendance = useCallback(async (forDate: string) => {
    if (!isAdmin) return;
    setIsLoadingStaffAtt(true);
    setStaffAttError(null);
    try {
      const result = await fetchStaffAttendanceForDate(forDate);
      setStaffAttendance(result);
    } catch (err: any) {
      setStaffAttError(err.message || 'Failed to load staff attendance');
    } finally {
      setIsLoadingStaffAtt(false);
    }
  }, [isAdmin]);

  // ─────────────────────────────────────────────────────────────────
  // Initial data loads
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadMemberAttendance(date);
  }, [date, loadMemberAttendance]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (isAdmin) {
      loadStaffAttendance(staffDate);
    }
  }, [staffDate, isAdmin, loadStaffAttendance]);

  // ─────────────────────────────────────────────────────────────────
  // REALTIME: Member attendance socket
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('rt-member-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          loadMemberAttendance(date);
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [date, loadMemberAttendance]);

  // ─────────────────────────────────────────────────────────────────
  // REALTIME: Staff attendance socket (admin only)
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('rt-staff-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_attendance' },
        () => {
          loadStaffAttendance(staffDate);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_breaks' },
        () => {
          loadStaffAttendance(staffDate);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, staffDate, loadStaffAttendance]);

  // ─────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────
  const markAttendance = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('attendance').insert({
        member_id: memberId,
        marked_by: currentUser?.id,
      });
      if (error) {
        if (error.code === '23505') throw new Error('Already marked for today');
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Attendance marked');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('attendance')
        .update({ check_out: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Check-out marked');
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─────────────────────────────────────────────────────────────────
  // 1-Day walk-in handler
  // ─────────────────────────────────────────────────────────────────
  const handleOneDaySubmit = async () => {
    const name = oneDayName.trim();
    const amount = Number(oneDayAmount);

    if (!name) {
      toast.error('Please enter visitor name');
      return;
    }

    setOneDaySubmitting(true);
    try {
      // Only use columns that actually exist in the DB schema.
      // guest_name + notes added via migration 019.
      // member_id is nullable after migration 019.
      // Amount is stored in notes for reference.
      const noteText = amount > 0
        ? `1-Day PKR ${amount}`
        : '1-Day Walk-in';

      const { error } = await supabase.from('attendance').insert({
        guest_name: name,
        notes: noteText,
        marked_by: currentUser?.id,
        source: 'manual',
        // member_id intentionally omitted — nullable after migration 019
      });

      if (error) throw error;

      toast.success(`Walk-in attendance marked for ${name}`);
      setOneDayDialogOpen(false);
      setOneDayName('');
      setOneDayAmount('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark attendance');
    } finally {
      setOneDaySubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────
  const filteredMembers = members.filter((m: any) =>
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.phone || '').includes(memberSearch)
  );

  const presentUnpaidCount = useMemo(() => {
    return attendance.filter((a: any) => {
      if (!a.member_id && a.guest_name) return false;
      const status = a.member_id ? memberFeeStatuses[a.member_id]?.status : undefined;
      return status !== 'paid';
    }).length;
  }, [attendance, memberFeeStatuses]);

  const presentPaidCount = useMemo(() => {
    return Math.max(0, attendance.length - presentUnpaidCount);
  }, [attendance.length, presentUnpaidCount]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a: any) => {
      const displayName = a.members?.full_name || a.guest_name || a.notes?.replace(/^1-Day Walk-in: /, '').split(' | ')[0] || 'Walk-in Guest';
      const displayPhone = a.members?.phone || '';

      if (attSearch.trim()) {
        const q = attSearch.toLowerCase();
        const matchName = displayName.toLowerCase().includes(q);
        const matchPhone = displayPhone.toLowerCase().includes(q);
        if (!matchName && !matchPhone) return false;
      }

      const isPaid = (!a.member_id && a.guest_name) || (a.member_id ? memberFeeStatuses[a.member_id]?.status === 'paid' : false);
      const status = a.member_id ? (memberFeeStatuses[a.member_id]?.status || 'due') : (isPaid ? 'paid' : 'due');

      if (feeFilter === 'unpaid') return !isPaid;
      if (feeFilter === 'paid') return isPaid;
      if (feeFilter === 'overdue') return status === 'overdue';
      if (feeFilter === 'due') return status === 'due';
      if (feeFilter === 'partial') return status === 'partial';

      return true;
    });
  }, [attendance, memberFeeStatuses, attSearch, feeFilter]);

  const formatTimeStr = (isoStr: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  // ─────────────────────────────────────────────────────────────────
  // Fee Status Badge Component
  // ─────────────────────────────────────────────────────────────────
  const FeeStatusBadge = ({ memberId, record }: { memberId: string | null; record?: any }) => {
    // Determine fee info: prefer computed map, then inline record data
    let feeInfo: MemberFeeInfo | undefined = memberId ? memberFeeStatuses[memberId] : undefined;

    // Walk-in guests (no member_id, guest_name set) always count as Fee Paid
    if (!memberId && record?.guest_name) {
      feeInfo = { status: 'paid' };
    }

    // If still nothing and no member, show "No Record"
    if (!feeInfo) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted/30 text-muted-foreground border border-border/40">
          No Record
        </span>
      );
    }

    const { status, amountDue, amountPaid, totalAmount, paidPercent } = feeInfo;

    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle className="h-3.5 w-3.5" />
          Fee Paid
        </span>
      );
    }

    if (status === 'partial') {
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Banknote className="h-3.5 w-3.5" />
            Partial {paidPercent !== undefined ? `(${paidPercent}%)` : ''}
          </span>
          {(amountPaid !== undefined || amountDue !== undefined) && (
            <div className="text-[10px] text-muted-foreground px-1">
              {amountPaid !== undefined && <span className="text-blue-400">Paid: PKR {amountPaid.toLocaleString()}</span>}
              {amountPaid !== undefined && amountDue !== undefined && <span className="mx-1">·</span>}
              {amountDue !== undefined && <span>Remaining: PKR {amountDue.toLocaleString()}</span>}
            </div>
          )}
          {/* Progress bar */}
          {paidPercent !== undefined && (
            <div className="w-24 h-1.5 bg-border/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all"
                style={{ width: `${Math.min(paidPercent, 100)}%` }}
              />
            </div>
          )}
        </div>
      );
    }

    if (status === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
          <AlertCircle className="h-3.5 w-3.5" />
          Overdue {amountDue ? `(PKR ${amountDue.toLocaleString()})` : ''}
        </span>
      );
    }

    // due
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Clock className="h-3.5 w-3.5" />
        Fee Due {amountDue ? `(PKR ${amountDue.toLocaleString()})` : ''}
      </span>
    );
  };
  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Attendance</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Wifi className={`h-3 w-3 ${realtimeConnected ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              <p className="text-xs text-muted-foreground">
                {realtimeConnected ? 'Live updates active' : 'Connecting...'}
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'member' | 'staff')}>
          <TabsList className="bg-accent/50 p-1 border border-border/50">
            <TabsTrigger value="member" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Member Attendance
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="staff" className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Staff Attendance
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'member' | 'staff')}>
        {/* ═══ MEMBER ATTENDANCE ═══ */}
        <TabsContent value="member" className="space-y-4">
          {/* Biometric Device Status Card */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${
                lastBiometricPing
                  ? 'bg-violet-500/15 border border-violet-500/30'
                  : 'bg-muted/40 border border-border/40'
              }`}>
                <Fingerprint className={`h-4 w-4 ${
                  lastBiometricPing ? 'text-violet-400' : 'text-muted-foreground'
                }`} />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">ZKTeco K50 Biometric</p>
                <p className="text-xs text-muted-foreground">
                  {lastBiometricPing
                    ? <>Last scan: <span className="font-mono text-violet-400">{new Date(lastBiometricPing).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Karachi' })}</span></>
                    : 'No biometric scans today'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastBiometricPing ? (
                <span className="flex items-center gap-1.5 text-[11px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                  Device Active
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-accent/30 border border-border/40 rounded-full px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                  Awaiting Device
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/60 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] max-w-xs flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search present members..."
                  value={attSearch}
                  onChange={(e) => setAttSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-background/50"
                />
              </div>

              {/* Fee status filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  variant={feeFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFeeFilter('all')}
                  className="h-8 text-xs font-medium px-2.5"
                >
                  All ({attendance.length})
                </Button>

                <Button
                  type="button"
                  variant={feeFilter === 'unpaid' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setFeeFilter('unpaid')}
                  className={`h-8 text-xs font-medium px-2.5 gap-1.5 transition-colors ${
                    feeFilter === 'unpaid'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : presentUnpaidCount > 0
                      ? 'border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20'
                      : 'text-muted-foreground'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  Unpaid ({presentUnpaidCount})
                </Button>

                <Button
                  type="button"
                  variant={feeFilter === 'paid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFeeFilter('paid')}
                  className={`h-8 text-xs font-medium px-2.5 gap-1.5 transition-colors ${
                    feeFilter === 'paid'
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Paid ({presentPaidCount})
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 items-center shrink-0">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-36 h-9 text-xs"
              />
              {/* 1-Day Walk-in Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOneDayDialogOpen(true)}
                className="h-9 gap-1.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 text-xs"
              >
                <Banknote className="h-3.5 w-3.5" />
                1 Day
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="h-9 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> Mark Member
              </Button>
            </div>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-accent/20">
                      <th className="text-left p-4 font-medium text-muted-foreground">Member</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Check In</th>
                      <th className="text-left p-4 font-medium text-muted-foreground">Fee Status</th>
                      <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Source</th>
                      <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Marked By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingMemberAtt ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </td>
                      </tr>
                    ) : attendance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground">
                          No member attendance records for this date
                        </td>
                      </tr>
                    ) : filteredAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground">
                          {feeFilter === 'unpaid' ? (
                            <div className="flex flex-col items-center gap-2">
                              <CheckCircle className="h-8 w-8 text-emerald-500/60" />
                              <p className="font-medium text-foreground">No unpaid members present today!</p>
                              <p className="text-xs text-muted-foreground">All present members have paid their fees.</p>
                            </div>
                          ) : (
                            <p>No matching attendance records found</p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredAttendance.map((a: any) => {
                        const displayName = a.members?.full_name || a.guest_name || a.notes?.replace(/^1-Day Walk-in: /, '').split(' | ')[0] || 'Walk-in Guest';
                        const displayPhone = a.members?.phone || (a.guest_name ? '1-Day Visit' : null);

                        return (
                          <tr key={a.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-full grid place-items-center text-xs font-semibold ${
                                  a.member_id ? 'bg-primary/20 text-primary' : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {displayName.slice(0, 1).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">{displayName}</p>
                                  {displayPhone && <p className="text-xs text-muted-foreground">{displayPhone}</p>}
                                  {!a.member_id && (
                                    <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded px-1.5 py-0.5">
                                      Walk-in
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2 font-mono text-xs">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {new Date(a.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </div>
                            </td>
                            <td className="p-4">
                              <FeeStatusBadge memberId={a.member_id} record={a} />
                            </td>
                            <td className="p-4 hidden md:table-cell">
                              {a.source === 'biometric' ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/25">
                                  <Fingerprint className="h-3 w-3" />
                                  Biometric
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent text-muted-foreground border border-border/50">
                                  ✍️ Manual
                                </span>
                              )}
                            </td>
                            <td className="p-4 hidden sm:table-cell text-muted-foreground">
                              {a.source === 'biometric' ? (
                                <span className="text-violet-400/70 text-xs italic">Fingerprint Device</span>
                              ) : (
                                a.profiles?.full_name || '—'
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ STAFF ATTENDANCE (Admin Only) ═══ */}
        {isAdmin && (
          <TabsContent value="staff" className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/60 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-base">Automatic Staff Attendance &amp; Sessions</h2>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                    <Wifi className="h-2.5 w-2.5" /> Live
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Auto-tracked on login/logout. Updates instantly via WebSocket.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Date:</span>
                <Input
                  type="date"
                  value={staffDate}
                  onChange={(e) => setStaffDate(e.target.value)}
                  className="w-full sm:w-40"
                />
              </div>
            </div>

            {/* Error Banner */}
            {staffAttError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-sm flex items-center gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Staff Attendance Error</p>
                  <p className="text-xs opacity-90">{staffAttError}</p>
                </div>
              </div>
            )}

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                {
                  label: 'Active Now',
                  count: staffAttendance.filter((s) => s.status === 'active').length,
                  color: 'emerald',
                  icon: UserCheck,
                },
                {
                  label: 'On Break',
                  count: staffAttendance.filter((s) => s.status === 'on_break').length,
                  color: 'amber',
                  icon: Coffee,
                },
                {
                  label: 'Logged Out',
                  count: staffAttendance.filter((s) => s.status === 'logged_out').length,
                  color: 'slate',
                  icon: LogOut,
                },
                {
                  label: 'Absent',
                  count: staffAttendance.filter((s) => s.status === 'absent').length,
                  color: 'rose',
                  icon: UserX,
                },
              ].map(({ label, count, color, icon: Icon }) => (
                <Card key={label} className="border-border/60 bg-card/60">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      <p className={`text-2xl font-bold text-${color}-${color === 'slate' ? '400' : '500'}`}>
                        {count}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-full bg-${color}-500/10 grid place-items-center text-${color}-${color === 'slate' ? '400' : '500'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Staff Cards */}
            {isLoadingStaffAtt ? (
              <div className="text-center py-16">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading staff sessions...</p>
              </div>
            ) : staffAttendance.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground">
                  No staff profiles found.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {staffAttendance.map((staff) => {
                  const isExpanded = expandedStaffId === staff.profileId;
                  return (
                    <Card key={staff.profileId} className="border-border/60 transition-all hover:border-border">
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Staff Info */}
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-11 w-11 rounded-full bg-primary/15 grid place-items-center text-sm font-bold text-primary shrink-0">
                              {staff.fullName.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-base truncate">{staff.fullName}</h3>
                                <Badge variant="outline" className="text-[10px] capitalize px-2 py-0">
                                  {staff.role}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{staff.email}</p>
                            </div>
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-accent/20 p-3 rounded-lg border border-border/40">
                            <div>
                              <p className="text-muted-foreground">Status</p>
                              {staff.status === 'active' ? (
                                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-medium text-[11px] mt-0.5">
                                  ● Active Now
                                </Badge>
                              ) : staff.status === 'on_break' ? (
                                <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 font-medium text-[11px] mt-0.5 animate-pulse inline-flex items-center gap-1">
                                  <Coffee className="h-3 w-3" /> On Break
                                </Badge>
                              ) : staff.status === 'logged_out' ? (
                                <Badge variant="secondary" className="text-[11px] mt-0.5">
                                  Logged Out
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-rose-400 border-rose-500/30 text-[11px] mt-0.5">
                                  No Login
                                </Badge>
                              )}
                            </div>
                            <div>
                              <p className="text-muted-foreground">First Login</p>
                              <p className="font-mono font-semibold mt-0.5">{formatTimeStr(staff.firstLogin)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Work Hours</p>
                              <p className="font-mono font-semibold text-primary mt-0.5">
                                {formatMinutes(staff.totalWorkingMinutes)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Break Time</p>
                              <p className="font-mono font-semibold text-amber-500 mt-0.5">
                                {formatMinutes(staff.totalBreakMinutes)}
                              </p>
                            </div>
                          </div>

                          {/* Expand */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedStaffId(isExpanded ? null : staff.profileId)}
                            className="self-end lg:self-center text-xs text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <>Hide Timeline <ChevronUp className="h-4 w-4 ml-1" /></>
                            ) : (
                              <>Sessions ({staff.sessions.length}) <ChevronDown className="h-4 w-4 ml-1" /></>
                            )}
                          </Button>
                        </div>

                        {/* Session Timeline */}
                        {isExpanded && (
                          <div className="mt-5 pt-4 border-t border-border/50 space-y-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              Session &amp; Break Timeline
                            </h4>

                            {/* Explicit Staff Breaks */}
                            {staff.breaks.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                                  <Coffee className="h-3 w-3" /> Recorded Breaks ({staff.breaks.length})
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {staff.breaks.map((b, bIdx) => (
                                    <div key={b.id || bIdx} className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs font-mono">
                                      <div className="flex items-center gap-2">
                                        <Coffee className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                        <span>
                                          {formatTimeStr(b.startAt)} → {b.endAt ? formatTimeStr(b.endAt) : <span className="text-amber-400 animate-pulse font-bold">On Break Now</span>}
                                        </span>
                                      </div>
                                      <span className="font-bold text-amber-500">
                                        {formatMinutes(b.durationMinutes)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {staff.sessions.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">No sessions recorded today.</p>
                            ) : (
                              <div className="relative pl-6 space-y-3 border-l-2 border-primary/20">
                                {staff.sessions.map((session, idx) => (
                                  <div key={session.id} className="relative bg-accent/40 p-3 rounded-lg border border-border/50 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="absolute -left-[31px] top-3.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                                    <div>
                                      <span className="font-semibold mr-2">Session {idx + 1}:</span>
                                      <span className="font-mono text-muted-foreground">
                                        Login: <strong className="text-foreground">{formatTimeStr(session.loginAt)}</strong>
                                      </span>
                                      <span className="mx-2 text-muted-foreground">•</span>
                                      <span className="font-mono text-muted-foreground">
                                        Logout:{' '}
                                        {session.logoutAt ? (
                                          <strong className="text-foreground">{formatTimeStr(session.logoutAt)}</strong>
                                        ) : (
                                          <Badge className="bg-emerald-500/20 text-emerald-500 border-none font-normal text-[10px]">
                                            Active
                                          </Badge>
                                        )}
                                      </span>
                                    </div>
                                    <div className="font-mono text-xs font-semibold text-primary">
                                      {formatMinutes(session.durationMinutes)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-card rounded-lg border border-border/60 text-xs font-mono">
                              <div>
                                <span>First Login: </span>
                                <strong>{formatTimeStr(staff.firstLogin)}</strong>
                                {staff.firstLogout && (
                                  <>
                                    <span className="mx-2">|</span>
                                    <span>1st Logout: </span>
                                    <strong>{formatTimeStr(staff.firstLogout)}</strong>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span>Work: <strong className="text-primary">{formatMinutes(staff.totalWorkingMinutes)}</strong></span>
                                <span>|</span>
                                <span>Total Break: <strong className="text-amber-500">{formatMinutes(staff.totalBreakMinutes)}</strong></span>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* ═══ Mark Member Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Member Attendance</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search member..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredMembers.map((m: any) => {
              const existingRecord = attendance.find((a: any) => a.member_id === m.id);
              return (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                      {m.full_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">{m.phone}</p>
                    </div>
                  </div>
                  {existingRecord ? (
                    <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Already Marked
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => markAttendance.mutate(m.id)}
                      disabled={markAttendance.isPending}
                    >
                      Check In
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ 1-Day Walk-in Dialog ═══ */}
      <Dialog open={oneDayDialogOpen} onOpenChange={(open) => {
        setOneDayDialogOpen(open);
        if (!open) { setOneDayName(''); setOneDayAmount(''); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/15 grid place-items-center">
                <Banknote className="h-4 w-4 text-amber-400" />
              </div>
              1-Day Walk-in Attendance
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Mark attendance for a walk-in visitor with a one-day fee payment.
            </p>

            {/* Name Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="oneday-name">
                Visitor Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="oneday-name"
                  placeholder="Enter visitor name"
                  value={oneDayName}
                  onChange={(e) => setOneDayName(e.target.value)}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleOneDaySubmit()}
                />
              </div>
            </div>

            {/* Amount Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="oneday-amount">
                Amount Paid (PKR)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">₨</span>
                <Input
                  id="oneday-amount"
                  type="number"
                  placeholder="e.g. 200"
                  value={oneDayAmount}
                  onChange={(e) => setOneDayAmount(e.target.value)}
                  className="pl-8"
                  min={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleOneDaySubmit()}
                />
              </div>
              {/* <p className="text-xs text-muted-foreground">Leave blank if no fee charged</p> */}
            </div>

            {/* Info box */}
            {/* <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Attendance will be marked as <strong>Fee Paid</strong> automatically.</span>
            </div> */}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOneDayDialogOpen(false)}
              disabled={oneDaySubmitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleOneDaySubmit}
              disabled={oneDaySubmitting || !oneDayName.trim()}
            >
              {oneDaySubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Marking...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-2" /> Mark Attended</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
