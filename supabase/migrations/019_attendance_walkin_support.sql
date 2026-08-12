-- Migration 019: Walk-in / 1-Day Attendance Support
-- ──────────────────────────────────────────────────────────────
-- 1. Make member_id nullable so walk-in guests can be recorded
-- 2. Add guest_name column for walk-in visitor names
-- 3. Add notes column for any extra context
-- ──────────────────────────────────────────────────────────────

-- Drop the NOT NULL constraint on member_id
ALTER TABLE public.attendance
  ALTER COLUMN member_id DROP NOT NULL;

-- Add guest_name for walk-in visitors (NULL for regular members)
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- Add a general notes column
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- The existing unique index (member_id, date) will still work correctly
-- because NULL != NULL in Postgres, so multiple walk-ins on the same day are allowed.
-- Regular members still enforce uniqueness per day via the existing index.
