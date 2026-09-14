'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { normalizeImageSrc } from '@/lib/image-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PhotoPreviewDialog } from '@/components/ui/photo-preview-dialog';
import { toast } from 'sonner';
import {
  UserX, Search, RefreshCw, Calendar, Clock, DollarSign,
  CheckCircle, AlertTriangle, Bell, Trash2, Check, ExternalLink,
  ShieldAlert, Phone, UserCheck, Eye, Loader2, ArrowRight
} from 'lucide-react';

interface InactiveMember {
  id: string;
  full_name: string;
  phone: string | null;
  cnic: string | null;
  email: string | null;
  member_number: string | null;
  photo_url: string | null;
  join_date: string;
  monthly_fee: number;
  last_check_in: string | null;
  days_inactive: number;
  has_never_checked_in: boolean;
  fee_status: 'paid' | 'unpaid';
  fee_amount_due: number;
  fee_raw_status: string;
}

interface ReactivationNotification {
  id: string;
  member_id: string;
  member_name: string;
  member_number: string | null;
  member_photo_url: string | null;
  check_in_time: string;
  last_check_in_before: string | null;
  days_inactive: number | null;
  fee_status: 'paid' | 'unpaid';
  fee_amount_due: number | null;
  is_cleared: boolean;
  cleared_at: string | null;
  created_at: string;
}

export default function InactiveMembersPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: role, isLoading: roleLoading } = useRole();

  const [activeTab, setActiveTab] = useState<'inactive' | 'reactivated'>('inactive');
  const [search, setSearch] = useState('');
  const [feeFilter, setFeeFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Photo preview modal state
  const [photoPreview, setPhotoPreview] = useState<{
    open: boolean;
    photoUrl: string | null;
    title?: string;
  }>({ open: false, photoUrl: null });

  // Admin access guard
  useEffect(() => {
    if (!roleLoading && role && role !== 'admin') {
      router.replace('/members');
    }
  }, [role, roleLoading, router]);

  // 1. Fetch Inactive Members (60+ days)
  const {
    data: inactiveData,
    isLoading: isLoadingMembers,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ['inactive-members-list'],
    queryFn: async () => {
      const res = await fetch('/api/inactive-members');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch inactive members');
      }
      return res.json() as Promise<{
        members: InactiveMember[];
        stats: {
          totalInactive: number;
          paidCount: number;
          unpaidCount: number;
          totalDues: number;
          newlyInactivated: number;
        };
      }>;
    },
    enabled: role === 'admin',
    staleTime: 60 * 1000,
  });

  // 2. Fetch Reactivated Check-in Notifications
  const {
    data: notifData,
    isLoading: isLoadingNotifs,
    refetch: refetchNotifs,
  } = useQuery({
    queryKey: ['inactive-notifications-list'],
    queryFn: async () => {
      const res = await fetch('/api/inactive-members/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json() as Promise<{
        notifications: ReactivationNotification[];
        unclearedCount: number;
      }>;
    },
    enabled: role === 'admin',
    staleTime: 30 * 1000,
  });

  // Supabase Realtime listeners for real-time alerts & table changes
  useEffect(() => {
    if (role !== 'admin') return;

    const channel = supabase
      .channel('inactive-members-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inactive_member_notifications' },
        () => {
          refetchNotifs();
          queryClient.invalidateQueries({ queryKey: ['inactive-reactivations-badge'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => {
          refetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, queryClient, refetchNotifs, refetchMembers]);

  // Run manual 60-day sync scan
  const handleScanSync = async () => {
    setIsScanning(true);
    try {
      const result = await refetchMembers();
      const newlyCount = result.data?.stats?.newlyInactivated || 0;
      if (newlyCount > 0) {
        toast.success(`60-Day Scan complete: ${newlyCount} member(s) set to inactive`);
      } else {
        toast.info('60-Day Scan complete: All member statuses are up to date');
      }
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  // Manual check-in and reactivate action
  const handleReactivate = async (member: InactiveMember) => {
    setProcessingId(member.id);
    try {
      const res = await fetch('/api/inactive-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check in member');

      toast.success(`${member.full_name} checked in & reactivated to Active!`);
      refetchMembers();
      refetchNotifs();
      queryClient.invalidateQueries({ queryKey: ['inactive-reactivations-badge'] });
      queryClient.invalidateQueries({ queryKey: ['dash-active'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    } catch (err: any) {
      toast.error(err.message || 'Check-in failed');
    } finally {
      setProcessingId(null);
    }
  };

  // Clear all notifications
  const handleClearAllNotifications = async () => {
    try {
      const res = await fetch('/api/inactive-members/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
      if (!res.ok) throw new Error('Failed to clear notifications');

      toast.success('All reactivation notifications cleared');
      refetchNotifs();
      queryClient.invalidateQueries({ queryKey: ['inactive-reactivations-badge'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear notifications');
    }
  };

  // Dismiss single notification
  const handleDismissNotification = async (id: string) => {
    try {
      const res = await fetch('/api/inactive-members/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to dismiss notification');

      toast.success('Notification dismissed');
      refetchNotifs();
      queryClient.invalidateQueries({ queryKey: ['inactive-reactivations-badge'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to dismiss notification');
    }
  };

  // Filter members
  const members = inactiveData?.members || [];
  const stats = inactiveData?.stats || {
    totalInactive: 0,
    paidCount: 0,
    unpaidCount: 0,
    totalDues: 0,
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        !search ||
        m.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (m.member_number && m.member_number.includes(search)) ||
        (m.phone && m.phone.includes(search)) ||
        (m.cnic && m.cnic.includes(search));

      const matchesFee =
        feeFilter === 'all' ||
        (feeFilter === 'paid' && m.fee_status === 'paid') ||
        (feeFilter === 'unpaid' && m.fee_status === 'unpaid');

      return matchesSearch && matchesFee;
    });
  }, [members, search, feeFilter]);

  const notifications = notifData?.notifications || [];
  const unclearedCount = notifData?.unclearedCount || 0;

  if (roleLoading || (role && role !== 'admin')) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500 border border-red-500/20">
              <UserX className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
                Inactive Members (60-Day Rule)
              </h1>
              <p className="text-sm text-muted-foreground">
                Members inactive due to no attendance for 60 consecutive days & reactivation check-in alerts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanSync}
            disabled={isScanning}
            className="flex items-center gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Scan 60-Day Inactivity</span>
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="inactive" className="flex items-center gap-2 text-sm font-medium">
            <UserX className="h-4 w-4" />
            <span>Inactive Members</span>
            <Badge variant="secondary" className="ml-1 text-[11px] px-1.5 py-0 h-4">
              {stats.totalInactive}
            </Badge>
          </TabsTrigger>

          <TabsTrigger value="reactivated" className="flex items-center gap-2 text-sm font-medium relative">
            <Bell className="h-4 w-4" />
            <span>Reactivated Alerts</span>
            {unclearedCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white shadow-sm animate-pulse">
                {unclearedCount > 99 ? '99+' : unclearedCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: INACTIVE MEMBERS (60+ DAYS) ── */}
        <TabsContent value="inactive" className="space-y-6 m-0">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/60 backdrop-blur-sm border-border/60">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Inactive (60d+)
                  </p>
                  <p className="text-2xl font-bold font-display mt-1 text-red-500">
                    {stats.totalInactive}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
                  <UserX className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 backdrop-blur-sm border-border/60">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Unpaid Inactive
                  </p>
                  <p className="text-2xl font-bold font-display mt-1 text-amber-500">
                    {stats.unpaidCount}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 backdrop-blur-sm border-border/60">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Paid Inactive
                  </p>
                  <p className="text-2xl font-bold font-display mt-1 text-emerald-500">
                    {stats.paidCount}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 backdrop-blur-sm border-border/60">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Outstanding Dues
                  </p>
                  <p className="text-2xl font-bold font-display mt-1 text-foreground">
                    PKR {stats.totalDues.toLocaleString()}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search member name, #, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card/60 h-10"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              <Button
                variant={feeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeeFilter('all')}
                className="text-xs h-9"
              >
                All ({members.length})
              </Button>
              <Button
                variant={feeFilter === 'unpaid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeeFilter('unpaid')}
                className="text-xs h-9"
              >
                Unpaid ({members.filter((m) => m.fee_status === 'unpaid').length})
              </Button>
              <Button
                variant={feeFilter === 'paid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFeeFilter('paid')}
                className="text-xs h-9"
              >
                Paid ({members.filter((m) => m.fee_status === 'paid').length})
              </Button>
            </div>
          </div>

          {/* Members Table */}
          <Card className="border-border/60 overflow-hidden bg-card/60 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 text-left">Member</th>
                    <th className="py-3 px-4 text-left">Contact & CNIC</th>
                    <th className="py-3 px-4 text-left">Last Check-In Details</th>
                    <th className="py-3 px-4 text-left">Inactivity</th>
                    <th className="py-3 px-4 text-left">Fee Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {isLoadingMembers ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-xs">Scanning 60-day attendance records...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle className="h-8 w-8 text-emerald-500/80" />
                          <p className="font-medium text-foreground">No 60-Day Inactive Members Found</p>
                          <p className="text-xs text-muted-foreground max-w-sm">
                            {search || feeFilter !== 'all'
                              ? 'No inactive members match your search or filter criteria.'
                              : 'All active members have logged attendance within the past 60 days.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const photo = normalizeImageSrc(m.photo_url);
                      return (
                        <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                          {/* Member Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                onClick={() => photo && setPhotoPreview({ open: true, photoUrl: photo, title: m.full_name })}
                                className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
                              >
                                {photo ? (
                                  <img src={photo} alt={m.full_name} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="font-semibold text-xs text-muted-foreground">
                                    {m.full_name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground tracking-tight flex items-center gap-2">
                                  <span>{m.full_name}</span>
                                  {m.member_number && (
                                    <span className="text-[11px] font-mono font-normal px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                      #{m.member_number}
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Joined {m.join_date ? new Date(m.join_date).toLocaleDateString() : 'N/A'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="py-3 px-4 text-xs">
                            <div className="space-y-0.5">
                              {m.phone ? (
                                <p className="flex items-center gap-1.5 text-foreground font-mono">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  <span>{m.phone}</span>
                                </p>
                              ) : (
                                <p className="text-muted-foreground italic">No phone</p>
                              )}
                              {m.cnic && (
                                <p className="text-muted-foreground text-[11px] font-mono">
                                  CNIC: {m.cnic}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Last Check-in Details */}
                          <td className="py-3 px-4">
                            {m.last_check_in ? (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-primary" />
                                  <span>{new Date(m.last_check_in).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                  <span className="text-muted-foreground font-normal">
                                    {new Date(m.last_check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </p>
                                <p className="text-[11px] text-red-400 font-medium flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{m.days_inactive} days without attendance</span>
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <Badge variant="outline" className="text-[11px] text-amber-500 border-amber-500/30">
                                  Never Checked In
                                </Badge>
                                <p className="text-[11px] text-muted-foreground">
                                  Joined {m.days_inactive} days ago
                                </p>
                              </div>
                            )}
                          </td>

                          {/* Inactivity Badge */}
                          <td className="py-3 px-4">
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/20 font-medium text-xs">
                              Inactive ({m.days_inactive}d)
                            </Badge>
                          </td>

                          {/* Fee Status */}
                          <td className="py-3 px-4">
                            {m.fee_status === 'paid' ? (
                              <div className="space-y-0.5">
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                                  Paid
                                </Badge>
                                <p className="text-[11px] text-muted-foreground">No dues</p>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                                  Unpaid
                                </Badge>
                                <p className="text-[11px] font-semibold text-amber-500">
                                  PKR {m.fee_amount_due?.toLocaleString()} due
                                </p>
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleReactivate(m)}
                              disabled={processingId === m.id}
                              className="bg-gradient-primary text-xs h-8 shadow-sm hover:opacity-95"
                            >
                              {processingId === m.id ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                  <span>Reactivating...</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                                  <span>Check In & Reactivate</span>
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── TAB 2: REACTIVATED CHECK-INS (NOTIFICATIONS) ── */}
        <TabsContent value="reactivated" className="space-y-6 m-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card/60 backdrop-blur-sm border border-border/60">
            <div>
              <h2 className="text-lg font-bold font-display tracking-tight flex items-center gap-2">
                <span>Reactivated Member Check-in Alerts</span>
                {unclearedCount > 0 && (
                  <Badge className="bg-amber-600 text-white text-xs">
                    {unclearedCount} New
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Notifications for inactive members who checked in. Attendance was recorded and accounts were auto-restored to Active.
              </p>
            </div>

            {notifications.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAllNotifications}
                className="text-xs h-8 flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear All Notifications</span>
              </Button>
            )}
          </div>

          {isLoadingNotifs ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs">Loading reactivation notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
              <CardContent className="py-16 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground">No Reactivation Alerts</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                  When any inactive member logs attendance (via biometric scan or manual check-in), a notification alert will be registered here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {notifications.map((notif) => {
                const photo = normalizeImageSrc(notif.member_photo_url);
                return (
                  <Card
                    key={notif.id}
                    className={`border transition-all ${
                      !notif.is_cleared
                        ? 'border-amber-500/40 bg-amber-500/5 shadow-sm'
                        : 'border-border/60 bg-card/60'
                    }`}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Left: Member info & check-in details */}
                        <div className="flex items-start gap-3.5">
                          <div
                            onClick={() => photo && setPhotoPreview({ open: true, photoUrl: photo, title: notif.member_name })}
                            className="h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0 border border-border cursor-pointer hover:ring-2 hover:ring-primary/40"
                          >
                            {photo ? (
                              <img src={photo} alt={notif.member_name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-semibold text-sm text-muted-foreground">
                                {notif.member_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-base text-foreground tracking-tight">
                                {notif.member_name}
                              </p>
                              {notif.member_number && (
                                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                  #{notif.member_number}
                                </span>
                              )}
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px] font-medium flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                <span>Status: Active (Reactivated)</span>
                              </Badge>
                            </div>

                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              <span>Checked in at {new Date(notif.check_in_time).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}</span>
                            </p>

                            {notif.days_inactive && (
                              <p className="text-xs text-muted-foreground">
                                Previously inactive for <span className="font-semibold text-red-400">{notif.days_inactive} days</span>
                                {notif.last_check_in_before && (
                                  <span> (Last check-in before reactivation: {new Date(notif.last_check_in_before).toLocaleDateString()})</span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right: Paid / Unpaid Status and Dismiss */}
                        <div className="flex items-center gap-4 self-end sm:self-center">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground uppercase font-medium">Payment Status</p>
                            {notif.fee_status === 'paid' ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs mt-1">
                                Paid
                              </Badge>
                            ) : (
                              <div className="mt-1 space-y-0.5">
                                <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                                  Unpaid
                                </Badge>
                                {Number(notif.fee_amount_due) > 0 && (
                                  <p className="text-xs font-bold text-amber-500">
                                    PKR {Number(notif.fee_amount_due).toLocaleString()} Due
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {!notif.is_cleared && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDismissNotification(notif.id)}
                              className="text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
                              title="Dismiss alert"
                            >
                              <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                              <span>Dismiss</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Photo Preview Modal */}
      <PhotoPreviewDialog
        open={photoPreview.open}
        onOpenChange={(open) => setPhotoPreview((prev) => ({ ...prev, open }))}
        photoUrl={photoPreview.photoUrl}
        title={photoPreview.title}
      />
    </div>
  );
}
