-- Migration 030: Add admission_fee column to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS admission_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Add comment explaining admission_fee
COMMENT ON COLUMN public.members.admission_fee IS 'One-time admission / registration fee charged once upon joining';
