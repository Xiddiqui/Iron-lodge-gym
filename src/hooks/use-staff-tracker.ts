'use client';
import { useEffect } from 'react';
import { useCurrentUser } from './use-session';
import { pingStaffSession } from '@/lib/staff-attendance';

export function useStaffTracker() {
  const { data: user } = useCurrentUser();

  useEffect(() => {
    if (!user?.id) return;

    // Initial ping on session load
    pingStaffSession(user.id);

    // Periodic heartbeat every 3 minutes
    const interval = setInterval(() => {
      pingStaffSession(user.id);
    }, 180000);

    return () => clearInterval(interval);
  }, [user?.id]);
}
