'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, CheckCircle2, Loader2, MessageSquareHeart } from 'lucide-react';
import { toast } from 'sonner';

export default function FeedbackPage() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    if (!form.name.trim() || !form.message.trim()) {
      toast.error('Please fill in your name and message');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        message: form.message.trim(),
        status: 'new',
      };

      const { error } = await supabase.from('enquiries').insert(payload);

      if (error) {
        console.error('Feedback insert error:', error);
        throw error;
      }

      setSubmitted(true);
      toast.success('Feedback submitted successfully!');
    } catch (err: any) {
      console.error('Submission error:', err);
      toast.error(err.message || err.details || 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setForm({ name: '', phone: '', email: '', message: '' });
    setSubmitted(false);
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
          <img src={settings?.logo_url || '/logo.png'} alt={gymName} className="h-16 w-20 rounded-2xl object-cover shadow-elegant bg-primary border border-border" />
          <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">{gymName}</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            We value your feedback and inquiries. Fill out the form below to get in touch with us!
          </p>
        </div>

        <Card className="border-border/60 shadow-xl backdrop-blur-sm bg-card/95">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-primary">
              <MessageSquareHeart className="h-5 w-5" />
              <CardTitle className="text-xl">Client Feedback & Enquiry</CardTitle>
            </div>
            <CardDescription>No login required. We will get back to you as soon as possible.</CardDescription>
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
                    Your feedback/enquiry has been submitted successfully to our team.
                  </p>
                </div>
                <Button variant="outline" onClick={handleReset} className="mt-4">
                  Send Another Response
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="e.g. +92 300 1234567"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
                    placeholder="Share your questions, feedback, or membership enquiries..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                  />
                </div>

                <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
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
