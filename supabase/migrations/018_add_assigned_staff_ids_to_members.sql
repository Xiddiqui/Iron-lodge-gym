-- Migration 018: Add assigned_staff_ids array column to members table
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS assigned_staff_ids TEXT[] DEFAULT '{}';

-- Populate assigned_staff_ids array from assigned_staff_id for existing records
UPDATE public.members
SET assigned_staff_ids = ARRAY[assigned_staff_id::text]
WHERE assigned_staff_id IS NOT NULL
  AND (assigned_staff_ids IS NULL OR cardinality(assigned_staff_ids) = 0);
