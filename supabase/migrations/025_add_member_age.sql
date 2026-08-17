-- Migration 025: Add age column to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS age INTEGER;

-- Add comment explaining age
COMMENT ON COLUMN public.members.age IS 'Member age in years';
