'use client';

/**
 * BiometricAlertsProvider
 *
 * Wraps the authenticated layout and subscribes to Supabase Realtime
 * on the `biometric_notifications` table. On each INSERT, it renders
 * a premium popup notification in the top-right corner:
 *
 *   ✅ Check-In Alert  — shows member name, time, fee status
 *   ⚠️ Duplicate Alert — warns staff that member already checked in today
 *
 * Popups auto-dismiss: check-in after 6s, duplicate after 10s.
 * Multiple popups stack gracefully with framer-motion.
 *
 * 🔊 Voice Notifications:
 *   - Check-in:  plays chime → speaks "[Name] has checked in. Fee status: [status]"
 *   - Duplicate:  plays warning tone → speaks "Warning! [Name] is already checked in today"
 *   - Overdue:    extra emphasis → "Attention! [Name] has overdue fee of [amount] rupees"
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, AlertTriangle, X, CheckCircle, DollarSign, Clock, Volume2, VolumeX } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type BiometricNotification = {
  id: string;
  type: 'checkin' | 'duplicate';
  member_id: string | null;
  member_name: string;
  member_photo_url: string | null;
  member_number: string | null;
  fee_status: 'paid' | 'due' | 'overdue' | null;
  fee_amount_due: number | null;
  check_in_time: string | null;
  existing_check_in: string | null;
  created_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Audio helpers — notification chime & warning tone via AudioContext
// ─────────────────────────────────────────────────────────────────────────────
let _audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

/** Pleasant two-tone chime for check-ins */
function playCheckinChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // First note — E5
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.value = 659.25; // E5
  gain1.gain.setValueAtTime(0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.3);

  // Second note — G5 (bright, happy)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = 783.99; // G5
  gain2.gain.setValueAtTime(0.3, now + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(now + 0.15);
  osc2.stop(now + 0.5);
}

/** Warning double-beep for duplicates / overdue */
function playWarningTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  for (let i = 0; i < 2; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 440; // A4
    const start = now + i * 0.2;
    gain.gain.setValueAtTime(0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.12);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice notification via Web Speech API
// ─────────────────────────────────────────────────────────────────────────────
function speakNotification(notification: BiometricNotification) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Cancel any ongoing speech to avoid overlap
  window.speechSynthesis.cancel();

  let message = '';

  if (notification.type === 'checkin') {
    message = `${notification.member_name} has checked in.`;

    // Add fee status info
    if (notification.fee_status === 'overdue') {
      message += ` Attention! Fee is overdue.`;
      if (notification.fee_amount_due && notification.fee_amount_due > 0) {
        message += ` Amount due: ${notification.fee_amount_due} rupees.`;
      }
    } else if (notification.fee_status === 'due') {
      message += ` Fee is due.`;
      if (notification.fee_amount_due && notification.fee_amount_due > 0) {
        message += ` Amount: ${notification.fee_amount_due} rupees.`;
      }
    } else if (notification.fee_status === 'paid') {
      message += ` Fee is paid.`;
    }
  } else {
    // Duplicate
    message = `Warning! ${notification.member_name} is already checked in today.`;
  }

  // Small delay to let the chime/tone play first
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Try to find a good English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('samantha')
    ) || voices.find(
      (v) => v.lang.startsWith('en-') && !v.name.toLowerCase().includes('compact')
    ) || voices.find(
      (v) => v.lang.startsWith('en')
    );
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, 600);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  });
}

function getMemberInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Fee Status Badge
// ─────────────────────────────────────────────────────────────────────────────
function FeeStatusBadge({
  status,
  amountDue,
}: {
  status: 'paid' | 'due' | 'overdue' | null;
  amountDue: number | null;
}) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <CheckCircle className="h-3 w-3" />
        Fee Paid
      </span>
    );
  }
  if (status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
        <DollarSign className="h-3 w-3" />
        Overdue {amountDue ? `PKR ${amountDue.toLocaleString()}` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
      <DollarSign className="h-3 w-3" />
      Fee Due {amountDue ? `PKR ${amountDue.toLocaleString()}` : ''}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress Bar — shrinks to 0 over `durationMs` then triggers onComplete
// ─────────────────────────────────────────────────────────────────────────────
function AutoDismissBar({
  durationMs,
  color,
}: {
  durationMs: number;
  color: string;
}) {
  return (
    <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden mt-3">
      <motion.div
        className={`h-full ${color} rounded-full`}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: durationMs / 1000, ease: 'linear' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckInAlert Card
// ─────────────────────────────────────────────────────────────────────────────
function CheckInAlert({
  n,
  onDismiss,
}: {
  n: BiometricNotification;
  onDismiss: () => void;
}) {
  const initials = getMemberInitials(n.member_name);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-2xl border border-emerald-500/40 w-full"
      style={{
        background: 'linear-gradient(135deg, rgba(16,20,30,0.98) 0%, rgba(5,46,22,0.98) 100%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Glow strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 grid place-items-center">
              <Fingerprint className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
                Biometric Check-In
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white/60 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Member Row */}
        <div className="flex items-center gap-3">
          {n.member_photo_url ? (
            <img
              src={n.member_photo_url}
              alt={n.member_name}
              className="h-14 w-14 rounded-full object-cover border-2 border-emerald-500/40 shadow-lg"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 grid place-items-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20 border-2 border-emerald-500/40 shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-white truncate">{n.member_name}</p>
            {n.member_number && (
              <p className="text-xs text-emerald-400/80 font-mono font-semibold">Member #{n.member_number}</p>
            )}
          </div>
        </div>

        {/* Time + Fee */}
        <div className="mt-3.5 flex items-center justify-between gap-2 flex-wrap bg-white/5 p-2.5 rounded-xl border border-white/10">
          <div className="flex items-center gap-1.5 text-white/80 text-xs">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span className="font-mono font-bold text-white text-sm">{formatTime(n.check_in_time)}</span>
          </div>
          <FeeStatusBadge status={n.fee_status} amountDue={n.fee_amount_due} />
        </div>

        <AutoDismissBar durationMs={30000} color="bg-emerald-400" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DuplicateAlert Card
// ─────────────────────────────────────────────────────────────────────────────
function DuplicateAlert({
  n,
  onDismiss,
}: {
  n: BiometricNotification;
  onDismiss: () => void;
}) {
  const initials = getMemberInitials(n.member_name);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-2xl border border-red-500/40 w-full"
      style={{
        background: 'linear-gradient(135deg, rgba(16,20,30,0.98) 0%, rgba(60,5,5,0.98) 100%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Glow strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-rose-400 to-red-500" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-red-500/20 border border-red-500/40 grid place-items-center animate-pulse">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-widest">
                Duplicate Scan Detected
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white/60 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Member Row */}
        <div className="flex items-center gap-3">
          {n.member_photo_url ? (
            <img
              src={n.member_photo_url}
              alt={n.member_name}
              className="h-14 w-14 rounded-full object-cover border-2 border-red-500/50 shadow-lg"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-red-500 to-rose-700 grid place-items-center text-white font-bold text-lg shadow-lg shadow-red-500/20 border-2 border-red-500/40 shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-white truncate">{n.member_name}</p>
            <p className="text-xs text-red-400/90 font-semibold mt-0.5">
              Attempting to check in again
            </p>
          </div>
        </div>

        {/* Already checked in info */}
        <div className="mt-3.5 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-white/80">
            Already checked in today at{' '}
            <span className="font-mono font-bold text-red-300 text-sm">
              {n.existing_check_in ? formatTime(n.existing_check_in) : '—'}
            </span>
          </p>
          <p className="text-xs text-white/60 mt-1">
            Current scan time: <span className="font-mono">{formatTime(n.check_in_time)}</span>
          </p>
        </div>

        <AutoDismissBar durationMs={30000} color="bg-red-400" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function BiometricAlertsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [alerts, setAlerts] = useState<BiometricNotification[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceEnabledRef = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Keep ref in sync so the realtime callback always reads the latest value
  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  // Preload speech synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleNewNotification = useCallback((notification: BiometricNotification) => {
    if (seenIdsRef.current.has(notification.id)) return;
    seenIdsRef.current.add(notification.id);

    // Notify any active page/component immediately to refresh tables
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('biometric-punch', { detail: notification }));
    }

    setAlerts((prev) => {
      const updated = [...prev, notification];
      return updated.slice(-5);
    });

    // Audio & Voice
    if (voiceEnabledRef.current) {
      if (notification.type === 'checkin') {
        if (notification.fee_status === 'overdue') {
          playWarningTone();
        } else {
          playCheckinChime();
        }
      } else {
        playWarningTone();
      }
      speakNotification(notification);
    }

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      dismissAlert(notification.id);
    }, 30000);
  }, [dismissAlert]);

  useEffect(() => {
    // 1. Supabase Realtime WebSocket subscription
    const channel = supabase
      .channel('biometric-notifications-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'biometric_notifications',
        },
        (payload) => {
          handleNewNotification(payload.new as BiometricNotification);
        }
      )
      .subscribe();

    // 2. Fallback polling every 3 seconds for recent notifications (created in last 30s)
    const pollInterval = setInterval(async () => {
      try {
        const thirtySecsAgo = new Date(Date.now() - 30000).toISOString();
        const { data } = await supabase
          .from('biometric_notifications')
          .select('*')
          .gte('created_at', thirtySecsAgo)
          .order('created_at', { ascending: true });

        if (data && data.length > 0) {
          data.forEach((item) => handleNewNotification(item as BiometricNotification));
        }
      } catch {
        // Ignore polling error
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [handleNewNotification]);

  return (
    <>
      {children}

      {/* Voice toggle button — bottom-right corner */}
      <button
        onClick={() => setVoiceEnabled((v) => !v)}
        className={`fixed bottom-4 right-4 z-[201] h-11 w-11 rounded-full grid place-items-center shadow-2xl transition-all duration-200 border ${
          voiceEnabled
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30'
            : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
        }`}
        title={voiceEnabled ? 'Voice notifications ON — click to mute' : 'Voice notifications OFF — click to unmute'}
      >
        {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </button>

      {/* Fixed alert portal — renders on top of all page content */}
      <div
        className="fixed top-5 right-5 z-[200] flex flex-col gap-3 pointer-events-none"
        style={{ maxWidth: '380px', width: 'calc(100vw - 2.5rem)' }}
      >
        <AnimatePresence mode="sync">
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="pointer-events-auto"
            >
              {alert.type === 'checkin' ? (
                <CheckInAlert
                  n={alert}
                  onDismiss={() => dismissAlert(alert.id)}
                />
              ) : (
                <DuplicateAlert
                  n={alert}
                  onDismiss={() => dismissAlert(alert.id)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
