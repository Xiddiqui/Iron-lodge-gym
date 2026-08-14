'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Lock, Play, LogOut, Clock, ShieldAlert, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCurrentUser } from '@/hooks/use-session';
import { recordStaffLogout } from '@/lib/staff-attendance';
import { supabase } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface StaffBreakOverlayProps {
  isOpen: boolean;
  elapsedSeconds: number;
  onEndBreak: () => Promise<void>;
  loading?: boolean;
}

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function StaffBreakOverlay({
  isOpen,
  elapsedSeconds,
  onEndBreak,
  loading = false,
}: StaffBreakOverlayProps) {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMsg('Please enter your password');
      return;
    }

    const email = user?.email;
    if (!email) {
      toast.error('User email not found. Please log in again.');
      return;
    }

    setVerifying(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      });

      if (error) {
        setErrorMsg('Incorrect password. Dashboard remains locked.');
        toast.error('Incorrect password! Cannot unlock dashboard.');
        setVerifying(false);
        return;
      }

      // Password verified successfully!
      await onEndBreak();
      setPassword('');
      toast.success('Welcome back! Break ended and dashboard unlocked.');
    } catch (err: any) {
      console.error('Error verifying password for break unlock:', err);
      setErrorMsg('Verification failed. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleSignOutFromBreak = async () => {
    if (user?.id) {
      await recordStaffLogout(user.id);
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success('Signed out');
    router.replace('/auth');
  };

  const userName = user?.user_metadata?.full_name ?? user?.email ?? 'Staff Member';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(24px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-4 sm:p-6 overflow-hidden select-none"
        >
          {/* Glowing background ambient lights */}
          <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-25" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)' }} />
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(163,230,53,0.3) 0%, transparent 70%)' }} />

          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="relative w-full max-w-md bg-card/90 border border-amber-500/30 shadow-2xl rounded-3xl p-6 sm:p-8 backdrop-blur-2xl text-center space-y-5 overflow-hidden"
          >
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-medium tracking-wide">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <Coffee className="h-3.5 w-3.5" />
              <span>STAFF BREAK LOCKED</span>
            </div>

            {/* Lock Icon */}
            <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-primary/20 animate-pulse blur-lg" />
              <div className="relative h-16 w-16 rounded-2xl bg-card border border-border/80 shadow-inner flex items-center justify-center">
                <Lock className="h-8 w-8 text-amber-500" />
              </div>
            </div>

            {/* Title & Info */}
            <div>
              <h2 className="text-2xl font-display font-bold tracking-tight text-foreground">
                Dashboard Locked
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Currently on break • <span className="font-semibold text-foreground">{userName}</span>
              </p>
            </div>

            {/* Live Break Timer */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-500 font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>BREAK TIME ELAPSED</span>
              </div>
              <div className="font-mono text-4xl sm:text-5xl font-extrabold text-amber-500 tracking-wider">
                {formatDuration(elapsedSeconds)}
              </div>
            </div>

            {/* Password Unlock Form */}
            <form onSubmit={handleUnlock} className="space-y-3 pt-1 text-left">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5 text-amber-500" /> Enter Password to Unlock
                  </span>
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your account password..."
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    required
                    className="pr-10 h-11 bg-background/60 border-border/60 focus:border-amber-500 focus:ring-amber-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-xs text-rose-500 font-medium mt-1">{errorMsg}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={verifying || loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                    Verifying Password...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-slate-950" />
                    Verify Password & Resume Work
                  </>
                )}
              </Button>
            </form>

            {/* Sign Out Action */}
            <div className="pt-1 border-t border-border/40">
              <Button
                variant="ghost"
                onClick={handleSignOutFromBreak}
                disabled={loading || verifying}
                className="w-full h-9 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 text-xs font-medium transition-colors"
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Sign Out Entirely
              </Button>
            </div>

            {/* Footer notice */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/60">
              <ShieldAlert className="h-3 w-3" />
              <span>Password verification prevents unauthorized portal modification</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
