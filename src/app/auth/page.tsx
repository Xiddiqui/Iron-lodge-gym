'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';

import { recordStaffLogin } from '@/lib/staff-attendance';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>('/logo.png');
  const [gymName, setGymName] = useState<string>('Iron Lodge Gym');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function fetchGymSettings() {
      try {
        const { data } = await supabase
          .from('gym_settings')
          .select('gym_name, logo_url')
          .eq('id', 1)
          .maybeSingle();

        if (data) {
          if (data.gym_name) setGymName(data.gym_name);
          if (data.logo_url) setLogoUrl(data.logo_url);
        }
      } catch (err) {
        console.error('Failed to fetch gym settings:', err);
      }
    }
    fetchGymSettings();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (data.user?.id) {
      await recordStaffLogin(data.user.id);
    }
    toast.success('Signed in successfully');
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #a3e635 0%, transparent 70%)' }} />
      </div>
      <Card className="w-full max-w-md relative z-10 border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-20 w-20 rounded-2xl overflow-hidden shadow-elegant bg-primary flex items-center justify-center p-1.5 border border-border/20">
            {!imageError && logoUrl ? (
              <img
                src={logoUrl}
                alt={gymName}
                className="h-full w-full object-contain rounded-xl"
                onError={() => {
                  if (logoUrl !== '/logo.png') {
                    setLogoUrl('/logo.png');
                  } else {
                    setImageError(true);
                  }
                }}
              />
            ) : (
              <Dumbbell className="h-10 w-10 text-primary-foreground" />
            )}
          </div>
          <div>
            <CardTitle className="text-2xl font-display">{gymName}</CardTitle>
            <CardDescription className="mt-2">Sign in to your account</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
