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
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, AlertTriangle, X, CheckCircle, DollarSign, Clock } from 'lucide-react';

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
      className="relative rounded-2xl overflow-hidden shadow-2xl border border-emerald-500/30"
      style={{
        background: 'linear-gradient(135deg, rgba(16,20,30,0.98) 0%, rgba(5,46,22,0.98) 100%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Glow strip */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 grid place-items-center">
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
            className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white/60 hover:text-white transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Member Row */}
        <div className="flex items-center gap-3">
          {n.member_photo_url ? (
            <img
              src={n.member_photo_url}
              alt={n.member_name}
              className="h-12 w-12 rounded-full object-cover border-2 border-emerald-500/40 shadow-lg"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 grid place-items-center text-white font-bold text-base shadow-lg shadow-emerald-500/20 border-2 border-emerald-500/40 shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-base font-bold text-white truncate">{n.member_name}</p>
            {n.member_number && (
              <p className="text-xs text-white/50 font-mono">#{n.member_number}</p>
            )}
          </div>
        </div>

        {/* Time + Fee */}
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-white/70 text-xs">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-mono font-semibold text-white">{formatTime(n.check_in_time)}</span>
          </div>
          <FeeStatusBadge status={n.fee_status} amountDue={n.fee_amount_due} />
        </div>

        <AutoDismissBar durationMs={6000} color="bg-emerald-400" />
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
      className="relative rounded-2xl overflow-hidden shadow-2xl border border-red-500/40"
      style={{
        background: 'linear-gradient(135deg, rgba(16,20,30,0.98) 0%, rgba(60,5,5,0.98) 100%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Glow strip */}
      <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-400 to-red-500" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-red-500/20 border border-red-500/40 grid place-items-center animate-pulse">
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
            className="h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white/60 hover:text-white transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Member Row */}
        <div className="flex items-center gap-3">
          {n.member_photo_url ? (
            <img
              src={n.member_photo_url}
              alt={n.member_name}
              className="h-12 w-12 rounded-full object-cover border-2 border-red-500/50 shadow-lg"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-red-500 to-rose-700 grid place-items-center text-white font-bold text-base shadow-lg shadow-red-500/20 border-2 border-red-500/40 shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-base font-bold text-white truncate">{n.member_name}</p>
            <p className="text-xs text-red-400/80 mt-0.5">
              Attempting to check in again
            </p>
          </div>
        </div>

        {/* Already checked in info */}
        <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-white/70">
            Already checked in today at{' '}
            <span className="font-mono font-semibold text-red-300">
              {n.existing_check_in ? formatTime(n.existing_check_in) : '—'}
            </span>
          </p>
          <p className="text-xs text-white/50 mt-0.5">
            Current scan time: <span className="font-mono">{formatTime(n.check_in_time)}</span>
          </p>
        </div>

        <AutoDismissBar durationMs={10000} color="bg-red-400" />
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

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
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
          const notification = payload.new as BiometricNotification;

          setAlerts((prev) => {
            // Cap at 5 simultaneous alerts to avoid screen overflow
            const updated = [...prev, notification];
            return updated.slice(-5);
          });

          // Auto-dismiss timer: duplicate alerts stay longer
          const timeoutMs = notification.type === 'duplicate' ? 10000 : 6000;
          setTimeout(() => {
            dismissAlert(notification.id);
          }, timeoutMs);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dismissAlert]);

  return (
    <>
      {children}

      {/* Fixed alert portal — renders on top of all page content */}
      <div
        className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none"
        style={{ maxWidth: '320px', width: 'calc(100vw - 2rem)' }}
      >
        <AnimatePresence mode="sync">
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
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
