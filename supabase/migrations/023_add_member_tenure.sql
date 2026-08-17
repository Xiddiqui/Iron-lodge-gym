-- Migration 023: Add tenure_months to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS tenure_months INTEGER DEFAULT 1;

-- Add comment explaining tenure_months
COMMENT ON COLUMN public.members.tenure_months IS 'Membership tenure package in months (e.g., 1, 3, 6 months)';
