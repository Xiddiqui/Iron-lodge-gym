-- Migration 003: Add member_number, trainers table, trainer assignment, and training fees

-- 1. Create trainers table
CREATE TABLE IF NOT EXISTS public.trainers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  specialization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read trainers"
  ON public.trainers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert trainers"
  ON public.trainers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update trainers"
  ON public.trainers FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Seed initial default trainers
INSERT INTO public.trainers (name, specialization)
VALUES 
  ('John Doe', 'Bodybuilding & Strength'),
  ('Alex Smith', 'Cardio & Fitness'),
  ('Sarah Connor', 'Crossfit & Endurance'),
  ('Mike Tyson', 'Boxing & Conditioning')
ON CONFLICT DO NOTHING;

-- 2. Alter members table to add member_number, training_fees, trainer_id, amount_paid
ALTER TABLE public.members 
  ADD COLUMN IF NOT EXISTS member_number TEXT,
  ADD COLUMN IF NOT EXISTS training_fees NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0;
