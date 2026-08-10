'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
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
  UserCheck, Shield, Coffee, ChevronDown, ChevronUp, UserX, AlertCircle, Wifi, Fingerprint, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

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

  // --- Live data state (driven by realtime sockets) ---
  const [attendance, setAttendance] = useState<any[]>([]);
  const [memberFeeStatuses, setMemberFeeStatuses] = useState<Record<string, { status: 'paid' | 'due' | 'overdue'; amountDue?: number }>>({});
  const [isLoadingMemberAtt, setIsLoadingMemberAtt] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffDayAttendance[]>([]);
  const [isLoadingStaffAtt, setIsLoadingStaffAtt] = useState(false);
  const [staffAttError, setStaffAttError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastBiometricPing, setLastBiometricPing] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

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
          const today = new Date();
          const feeMap: Record<string, { status: 'paid' | 'due' | 'overdue'; amountDue?: number }> = {};

          feeData.forEach((fr: any) => {
            if (!feeMap[fr.member_id]) {
              const isPaid = fr.paid ?? (fr.status === 'paid');
              const feeAmount = Number(fr.amount) || 0;
              const discount = Number(fr.discount) || 0;
              const amountPaid = Number(fr.amount_paid) || 0;
              const effectiveDue = Math.max(0, feeAmount - discount - amountPaid);

              let status: 'paid' | 'due' | 'overdue' = 'due';
              if (isPaid || effectiveDue === 0) {
                status = 'paid';
              } else if (fr.period_end && new Date(fr.period_end) < today) {
                status = 'overdue';
              } else {
                status = 'due';
              }

              feeMap[fr.member_id] = {
                status,
                amountDue: effectiveDue > 0 ? effectiveDue : feeAmount,
              };
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
          // Reload member attendance whenever any row changes
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
      // Realtime will auto-reload
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
      // Realtime will auto-reload
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────
  const filteredMembers = members.filter((m: any) =>
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.phone || '').includes(memberSearch)
  );

  const formatTimeStr = (isoStr: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
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

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/60 shadow-sm">
            <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
              {attendance.length} Present Today
            </Badge>
            <div className="flex gap-3 w-full sm:w-auto">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full sm:w-40"
              />
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Mark Member
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
                    ) : (
                      attendance.map((a: any) => (
                        <tr key={a.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                                {(a.members?.full_name || '?').slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">{a.members?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{a.members?.phone}</p>
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
                            {(() => {
                              const feeInfo = memberFeeStatuses[a.member_id];
                              const rawStatus = a.fee_status || feeInfo?.status || 'due';
                              const amountDue = a.fee_amount_due ?? feeInfo?.amountDue;

                              if (rawStatus === 'paid') {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Fee Paid
                                  </span>
                                );
                              }
                              if (rawStatus === 'overdue') {
                                return (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Overdue {amountDue ? `(PKR ${amountDue.toLocaleString()})` : ''}
                                  </span>
                                );
                              }
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  <Clock className="h-3.5 w-3.5" />
                                  Fee Due {amountDue ? `(PKR ${amountDue.toLocaleString()})` : ''}
                                </span>
                              );
                            })()}
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
                      ))
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
                  <h2 className="font-semibold text-base">Automatic Staff Attendance & Sessions</h2>
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
                              Session & Break Timeline
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

      {/* Mark Member Dialog */}
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
    </div>
  );
}
