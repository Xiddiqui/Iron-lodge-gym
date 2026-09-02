'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, CheckCircle2, Loader2, MessageSquareHeart, IdCard, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeImageSrc } from '@/lib/image-utils';

export default function FeedbackPage() {
  const [form, setForm] = useState({ member_number: '', name: '', phone: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Fetch public gym settings for branding
  const { data: settings } = useQuery({
    queryKey: ['public-gym-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('gym_settings').select('gym_name, logo_url').single();
      return data;
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const inputMemberNum = form.member_number.trim();
    if (!inputMemberNum) {
      toast.error('Please enter your Member Number / ID');
      return;
    }

    if (!form.name.trim() || !form.message.trim()) {
      toast.error('Please fill in your name and message');
      return;
    }

    if (!form.phone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Try server API route first
      let res: Response | null = null;
      try {
        res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_number: inputMemberNum,
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            message: form.message.trim(),
          }),
        });
      } catch (fetchErr) {
        console.warn('API fetch failed, trying client verification fallback', fetchErr);
      }

      if (res) {
        const data = await res.json();

        if (!res.ok) {
          const msg = data.error || 'Failed to submit feedback. Please check your Member ID.';
          setErrorMessage(msg);
          toast.error(msg);
          return;
        }

        setSubmitted(true);
        toast.success('Feedback submitted successfully!');
        return;
      }

      // 2. Client-side fallback if API route is unreachable
      const { data: rpcData, error: rpcError } = await supabase.rpc('verify_member_exists', {
        p_member_number: inputMemberNum,
      });

      let isMember = false;
      let matchedMemberId: string | null = null;
      let matchedMemberNum: string | null = inputMemberNum;

      if (!rpcError && rpcData && rpcData.length > 0 && rpcData[0].exists) {
        isMember = true;
        matchedMemberId = rpcData[0].member_id;
        matchedMemberNum = rpcData[0].member_number || inputMemberNum;
      } else {
        const { data: memberData } = await supabase
          .from('members')
          .select('id, member_number')
          .eq('member_number', inputMemberNum)
          .maybeSingle();

        if (memberData) {
          isMember = true;
          matchedMemberId = memberData.id;
          matchedMemberNum = memberData.member_number;
        }
      }

      if (!isMember) {
        const msg = `No active member found with Member Number / ID "${inputMemberNum}". Only registered members can submit suggestions.`;
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      const payload: Record<string, any> = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        message: form.message.trim(),
        status: 'new',
        member_number: matchedMemberNum,
        member_id: matchedMemberId,
      };

      const { error: insertErr } = await supabase.from('enquiries').insert(payload);
      if (insertErr) {
        delete payload.member_number;
        delete payload.member_id;
        const { error: retryErr } = await supabase.from('enquiries').insert(payload);
        if (retryErr) throw retryErr;
      }

      setSubmitted(true);
      toast.success('Feedback submitted successfully!');
    } catch (err: any) {
      console.error('Submission error:', err);
      const msg = err.message || 'Failed to submit feedback. Please try again.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setForm({ member_number: '', name: '', phone: '', email: '', message: '' });
    setSubmitted(false);
    setErrorMessage(null);
  }

  const gymName = settings?.gym_name ?? 'Iron Lodge Gym';

  return (
    <div className="min-h-screen w-full bg-background flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="w-full max-w-lg space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative h-16 w-20 rounded-2xl shadow-elegant bg-primary border border-border overflow-hidden">
            {/* Always show local logo as base layer */}
            {(!logoLoaded || logoError || !normalizeImageSrc(settings?.logo_url)) && (
              <img src="/logo.png" alt={gymName} className="absolute inset-0 h-full w-full object-cover" />
            )}
            {/* Load remote logo on top; hidden until loaded */}
            {normalizeImageSrc(settings?.logo_url) && !logoError && (
              <img
                src={normalizeImageSrc(settings?.logo_url)!}
                alt={gymName}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setLogoLoaded(true)}
                onError={() => setLogoError(true)}
              />
            )}
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">{gymName}</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            We value member feedback & suggestions. Enter your Member ID below to get in touch with us!
          </p>
        </div>

        <Card className="border-border/60 shadow-xl backdrop-blur-sm bg-card/95">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary">
              <MessageSquareHeart className="h-5 w-5" />
              <CardTitle className="text-xl">Member Feedback & Suggestion</CardTitle>
            </div>
            <CardDescription>
              Member verification required. Only registered members can submit feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="py-8 flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/15 text-primary grid place-items-center">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">Thank You!</h2>
                  <p className="text-sm text-muted-foreground">
                    Your feedback for Member <span className="font-mono font-bold text-foreground">#{form.member_number}</span> has been submitted successfully to our team.
                  </p>
                </div>
                <Button variant="outline" onClick={handleReset} className="mt-4">
                  Send Another Response
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2.5">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Member Match Failed</p>
                      <p className="text-xs opacity-90">{errorMessage}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="member_number" className="flex items-center gap-1.5 font-medium">
                    <IdCard className="h-4 w-4 text-primary" />
                    Member Number / ID *
                  </Label>
                  <Input
                    id="member_number"
                    placeholder="e.g. 101 or your Member ID"
                    value={form.member_number}
                    onChange={(e) => {
                      setForm({ ...form, member_number: e.target.value });
                      if (errorMessage) setErrorMessage(null);
                    }}
                    required
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must match a valid member ID in our database to submit suggestions.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="e.g. +92 300 1234567"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Your Message / Feedback *</Label>
                  <textarea
                    id="message"
                    rows={4}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Share your feedback, suggestions, or gym enquiries..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying Member & Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Submit Feedback
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {gymName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}

