'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { useRole } from '@/hooks/use-role';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/format';
import { ENQUIRY_STATUSES } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare, Loader2, Mail, Phone, Eye, User, CalendarDays, MessageCircle } from 'lucide-react';

export default function EnquiriesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: role, isLoading: roleLoading } = useRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);

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
    if (enquiries.length > 0 && enquiries.some((e: any) => e.is_read === false)) {
      (async () => {
        const { error } = await supabase
          .from('enquiries')
          .update({ is_read: true })
          .eq('is_read', false);
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['enquiries-unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['enquiries'] });
        }
      })();
    }
  }, [enquiries, queryClient]);

  function openView(e: any) {
    setViewing(e);
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
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
                ) : enquiries.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No enquiries or feedback received yet</td></tr>
                ) : enquiries.map((e: any) => (
                  <tr key={e.id} onClick={() => openView(e)} className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Read-only detail popup */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Enquiry Details
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-5 pt-2">
              {/* Name */}
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{viewing.name}</p>
                </div>
              </div>

              {/* Contact */}
              {(viewing.phone || viewing.email) && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Contact Info</p>
                    {viewing.phone && <p className="text-sm">{viewing.phone}</p>}
                    {viewing.email && <p className="text-sm text-muted-foreground">{viewing.email}</p>}
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="flex items-start gap-3">
                <MessageCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Message / Feedback</p>
                  <div className="rounded-lg bg-accent/40 border border-border/50 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {viewing.message || 'No message provided'}
                  </div>
                </div>
              </div>

              {/* Status & Date */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusStyle(viewing.status)?.color}>{getStatusStyle(viewing.status)?.label}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(viewing.created_at)}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
