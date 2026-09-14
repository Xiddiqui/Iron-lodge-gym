-- Migration 031: Inactive Members (60-Day Rule) & Reactivation System
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add inactive_reason and last_check_in columns to members table
-- 2. Create inactive_member_notifications table
-- 3. Enable Realtime publication on inactive_member_notifications
-- 4. Create sync_inactive_members_60_days() database function
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add columns to members table
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS inactive_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_check_in TIMESTAMPTZ;

COMMENT ON COLUMN public.members.inactive_reason IS 'Reason why member is inactive, e.g. no_attendance_60_days or manual';
COMMENT ON COLUMN public.members.last_check_in IS 'Cached timestamp of member latest attendance check-in';

-- Backfill last_check_in for members from existing attendance records
UPDATE public.members m
SET last_check_in = (
  SELECT MAX(a.check_in)
  FROM public.attendance a
  WHERE a.member_id = m.id
)
WHERE m.last_check_in IS NULL;

-- 2. Create inactive_member_notifications table
CREATE TABLE IF NOT EXISTS public.inactive_member_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  member_number TEXT,
  member_photo_url TEXT,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_check_in_before TIMESTAMPTZ,
  days_inactive INTEGER,
  fee_status TEXT NOT NULL CHECK (fee_status IN ('paid', 'unpaid')),
  fee_amount_due NUMERIC(10, 2) DEFAULT 0,
  is_cleared BOOLEAN NOT NULL DEFAULT false,
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.inactive_member_notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view notifications
CREATE POLICY "Authenticated users can read inactive notifications"
  ON public.inactive_member_notifications FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated users / admins to update notifications (mark cleared)
CREATE POLICY "Authenticated users can update inactive notifications"
  ON public.inactive_member_notifications FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated users / admins to delete notifications
CREATE POLICY "Authenticated users can delete inactive notifications"
  ON public.inactive_member_notifications FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Allow authenticated users to insert notifications
CREATE POLICY "Authenticated users can insert inactive notifications"
  ON public.inactive_member_notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Enable Realtime WebSocket publication for instant badge & alert updates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inactive_member_notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- 4. Function to auto-sync members inactive after 60 days
CREATE OR REPLACE FUNCTION public.sync_inactive_members_60_days()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Backfill any missing last_check_in
  UPDATE public.members m
  SET last_check_in = (
    SELECT MAX(a.check_in)
    FROM public.attendance a
    WHERE a.member_id = m.id
  )
  WHERE m.last_check_in IS NULL;

  -- Set active = false for active members who have had no attendance for 60+ days
  -- (measured from last_check_in, or join_date if never checked in)
  WITH to_inactivate AS (
    SELECT id
    FROM public.members
    WHERE active = true
      AND COALESCE(last_check_in::date, join_date) <= (CURRENT_DATE - INTERVAL '60 days')
  )
  UPDATE public.members m
  SET
    active = false,
    inactive_reason = 'no_attendance_60_days',
    updated_at = NOW()
  FROM to_inactivate
  WHERE m.id = to_inactivate.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
