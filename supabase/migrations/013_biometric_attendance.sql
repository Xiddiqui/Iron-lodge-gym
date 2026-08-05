-- Migration 013: ZKTeco K50 Biometric Attendance Integration
-- ──────────────────────────────────────────────────────────────
-- 1. Add 'source' column to attendance table to distinguish biometric vs manual
-- 2. Create biometric_notifications table for real-time popup alerts on all clients
-- 3. Enable Supabase Realtime on biometric_notifications for WebSocket delivery

-- ──────────────────────────────────────────────────────────────
-- 1. Add source to attendance
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'biometric'));

-- ──────────────────────────────────────────────────────────────
-- 2. Biometric notifications table
--    Each row is a transient popup event (check-in or duplicate warning).
--    Clients subscribe via Realtime and show the popup on INSERT.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.biometric_notifications (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type           TEXT NOT NULL CHECK (type IN ('checkin', 'duplicate')),
  member_id      UUID REFERENCES public.members(id) ON DELETE CASCADE,
  member_name    TEXT NOT NULL,
  member_photo_url TEXT,
  member_number  TEXT,
  fee_status     TEXT CHECK (fee_status IN ('paid', 'due', 'overdue')),
  fee_amount_due NUMERIC(10, 2),
  check_in_time  TIMESTAMPTZ,
  existing_check_in TIMESTAMPTZ,  -- populated for duplicate events
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.biometric_notifications ENABLE ROW LEVEL SECURITY;

-- Authenticated users (staff/admin) can read notifications to display popups
CREATE POLICY "Authenticated users can read biometric notifications"
  ON public.biometric_notifications FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- The API route uses the service role key which bypasses RLS for INSERT

-- ──────────────────────────────────────────────────────────────
-- 3. Enable Realtime WebSocket for biometric_notifications
-- ──────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.biometric_notifications;
