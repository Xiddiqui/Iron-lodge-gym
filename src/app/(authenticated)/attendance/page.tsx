'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useCurrentUser } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarCheck, Plus, Search, Loader2, Clock, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance', date],
    queryFn: async () => {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const { data, error } = await supabase
        .from('attendance')
        .select('*, members(full_name, phone), profiles(full_name)')
        .gte('check_in', `${date}T00:00:00`)
        .lt('check_in', nextDay.toISOString().slice(0, 10) + 'T00:00:00')
        .order('check_in', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members-active'],
    queryFn: async () => {
      const { data } = await supabase.from('members').select('id, full_name, phone').eq('active', true).order('full_name');
      return data ?? [];
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance marked');
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
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
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Check-out marked');
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredMembers = members.filter((m: any) =>
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) || (m.phone || '').includes(memberSearch)
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Attendance</h1>
          <Badge variant="secondary">{attendance.length} today</Badge>
        </div>
        <div className="flex gap-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Mark</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-muted-foreground">Member</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Check In</th>
                  <th className="text-left p-4 font-medium text-muted-foreground">Check Out</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Marked By</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : attendance.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No attendance records</td></tr>
                ) : attendance.map((a: any) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center text-xs font-semibold text-primary">
                          {(a.members?.full_name || '?').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{a.members?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{a.members?.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {new Date(a.check_in).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-4">
                      {a.check_out ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(a.check_out).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-500"
                          onClick={() => checkOutMutation.mutate(a.id)}
                          disabled={checkOutMutation.isPending}
                        >
                          <LogOut className="h-3.5 w-3.5 mr-1" />
                          Check Out
                        </Button>
                      )}
                    </td>
                    <td className="p-4 hidden sm:table-cell text-muted-foreground">{a.profiles?.full_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search member..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="pl-10" />
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
                    existingRecord.check_out ? (
                      <Badge variant="secondary" className="text-xs">Checked out</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-amber-500 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-500"
                        onClick={() => checkOutMutation.mutate(existingRecord.id)}
                        disabled={checkOutMutation.isPending}
                      >
                        <LogOut className="h-3.5 w-3.5 mr-1" />
                        Check Out
                      </Button>
                    )
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
