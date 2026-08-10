'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from './use-session';
import { startStaffBreak, endStaffBreak, getActiveStaffBreak } from '@/lib/staff-attendance';
import { toast } from 'sonner';

export function useStaffBreak() {
  const { data: user } = useCurrentUser();
  const [activeBreak, setActiveBreak] = useState<{ id: string; start_at: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  const getStorageKey = useCallback(() => {
    return user?.id ? `staff_active_break_${user.id}` : null;
  }, [user?.id]);

  // Check active break status from both DB and localStorage
  const checkActiveBreak = useCallback(async () => {
    if (!user?.id) return;
    const key = getStorageKey();

    // First check local storage for instant sync
    if (key && typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.start_at) {
            setActiveBreak(parsed);
          }
        } catch (e) {
          console.error('Error parsing stored break:', e);
        }
      }
    }

    try {
      const data = await getActiveStaffBreak(user.id);
      if (data && !data.end_at) {
        const breakObj = { id: data.id, start_at: data.start_at };
        setActiveBreak(breakObj);
        if (key && typeof window !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(breakObj));
        }
      } else if (!data) {
        // If DB has no active break, check if we need to clear local state
        const localOnly = key && typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        if (!localOnly) {
          setActiveBreak(null);
        }
      }
    } catch (err) {
      console.error('Error checking active break:', err);
    }
  }, [user?.id, getStorageKey]);

  useEffect(() => {
    checkActiveBreak();
  }, [checkActiveBreak]);

  // Timer effect for live break duration display
  useEffect(() => {
    if (!activeBreak?.start_at) {
      setElapsedSeconds(0);
      return;
    }

    const calcElapsed = () => {
      const start = new Date(activeBreak.start_at).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      setElapsedSeconds(diff);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeBreak?.start_at]);

  const handleStartBreak = async () => {
    if (!user?.id) return;
    setLoading(true);
    const nowIso = new Date().toISOString();
    const fallbackObj = { id: 'break_' + Date.now(), start_at: nowIso };

    // Set local state & localStorage IMMEDIATELY so screen locks instantly
    setActiveBreak(fallbackObj);
    const key = getStorageKey();
    if (key && typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(fallbackObj));
    }
    toast.info('Break started. Dashboard locked.');

    try {
      const result = await startStaffBreak(user.id);
      if (result) {
        const realObj = { id: result.id, start_at: result.start_at };
        setActiveBreak(realObj);
        if (key && typeof window !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(realObj));
        }
      }
    } catch (err: any) {
      console.error('Failed to sync break start to DB:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!user?.id) return;
    setLoading(true);
    const key = getStorageKey();
    if (key && typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
    setActiveBreak(null);

    try {
      await endStaffBreak(user.id);
    } catch (err: any) {
      console.error('Failed to sync break end to DB:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    isOnBreak: !!activeBreak,
    breakStartTime: activeBreak?.start_at || null,
    elapsedSeconds,
    loading,
    startBreak: handleStartBreak,
    endBreak: handleEndBreak,
    refetch: checkActiveBreak,
  };
}
