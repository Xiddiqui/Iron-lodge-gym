'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MessageSquare, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppAnnouncementModalProps {
  trigger?: React.ReactNode;
}

export function WhatsAppAnnouncementModal({ trigger }: WhatsAppAnnouncementModalProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all_members' | 'custom'>('all_members');
  const [customPhones, setCustomPhones] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    totalSent: number;
    totalFailed: number;
  } | null>(null);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter an announcement message.');
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      let recipientList: Array<{ phone: string }> = [];

      if (target === 'custom') {
        const rawPhones = customPhones
          .split(/[\n,;]/)
          .map((p) => p.trim())
          .filter(Boolean);

        if (rawPhones.length === 0) {
          toast.error('Please enter at least one phone number for custom recipients.');
          setLoading(false);
          return;
        }

        recipientList = rawPhones.map((phone) => ({ phone }));
      }

      const res = await fetch('/api/announcements/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          target,
          recipients: recipientList,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch WhatsApp messages');
      }

      setLastResult({
        totalSent: data.details?.totalSent || 0,
        totalFailed: data.details?.totalFailed || 0,
      });

      toast.success(
        `Successfully dispatched WhatsApp announcement to ${data.details?.totalSent || 0} recipients!`
      );
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while sending WhatsApp announcement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Send WhatsApp Announcement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-400 text-xl">
            <MessageSquare className="w-6 h-6" />
            WhatsApp Bulk Announcement
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Dispatch official WhatsApp announcement messages to gym members via Twilio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Selection */}
          <div className="space-y-2">
            <Label className="text-slate-200">Audience Target</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTarget('all_members')}
                className={`p-3 rounded-lg border text-left text-sm transition ${
                  target === 'all_members'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-medium'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">All Active Members</div>
                <div className="text-xs opacity-75 mt-0.5">Fetch phone numbers from database</div>
              </button>

              <button
                type="button"
                onClick={() => setTarget('custom')}
                className={`p-3 rounded-lg border text-left text-sm transition ${
                  target === 'custom'
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-medium'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-semibold">Custom Phone Numbers</div>
                <div className="text-xs opacity-75 mt-0.5">Paste list of specific numbers</div>
              </button>
            </div>
          </div>

          {/* Custom Phone Numbers input */}
          {target === 'custom' && (
            <div className="space-y-1.5">
              <Label htmlFor="customPhones" className="text-slate-200">
                Phone Numbers (separated by comma or new line)
              </Label>
              <textarea
                id="customPhones"
                rows={3}
                value={customPhones}
                onChange={(e) => setCustomPhones(e.target.value)}
                placeholder="+923001234567, +14155552671"
                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Message Body */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="message" className="text-slate-200">
                Announcement Message
              </Label>
              <span className="text-xs text-slate-500">
                Use <code className="text-emerald-400">{"{{name}}"}</code> for member's name
              </span>
            </div>
            <textarea
              id="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi {{name}}, please note that Iron Lodge Gym will open at 6:00 AM tomorrow."
              className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Last Result Summary */}
          {lastResult && (
            <div className="p-3 bg-slate-950 rounded-md border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Sent: {lastResult.totalSent}
              </span>
              {lastResult.totalFailed > 0 && (
                <span className="text-rose-400 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4" /> Failed: {lastResult.totalFailed}
                </span>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Dispatching...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Send Announcement
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
