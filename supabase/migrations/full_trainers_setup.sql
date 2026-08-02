-- ==========================================================
-- Migration Script: Complete Trainers Setup & Migration
-- ==========================================================

-- 1. Create trainers table (if not exists)
CREATE TABLE IF NOT EXISTS public.trainers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  cnic TEXT,
  availability_slot TEXT,
  experience_years NUMERIC(4, 1),
  photo_url TEXT,
  specialization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns if trainers table already existed previously without new columns
ALTER TABLE public.trainers 
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS cnic TEXT,
  ADD COLUMN IF NOT EXISTS availability_slot TEXT,
  ADD COLUMN IF NOT EXISTS experience_years NUMERIC(4, 1),
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS specialization TEXT;

-- 3. Enable Row Level Security (RLS) and set up policies
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read trainers" ON public.trainers;
CREATE POLICY "Authenticated users can read trainers"
  ON public.trainers FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert trainers" ON public.trainers;
CREATE POLICY "Authenticated users can insert trainers"
  ON public.trainers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update trainers" ON public.trainers;
CREATE POLICY "Authenticated users can update trainers"
  ON public.trainers FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete trainers" ON public.trainers;
CREATE POLICY "Authenticated users can delete trainers"
  ON public.trainers FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 4. Ensure members table has trainer_id column
ALTER TABLE public.members 
  ADD COLUMN IF NOT EXISTS member_number TEXT,
  ADD COLUMN IF NOT EXISTS training_fees NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- 5. Seed initial trainers
INSERT INTO public.trainers (name, specialization, availability_slot, experience_years)
VALUES 
  ('John Doe', 'Bodybuilding & Strength', '06:00 AM - 10:00 AM', 5.0),
  ('Alex Smith', 'Cardio & Fitness', '10:00 AM - 02:00 PM', 3.5),
  ('Sarah Connor', 'Crossfit & Endurance', '02:00 PM - 06:00 PM', 4.0),
  ('Mike Tyson', 'Boxing & Conditioning', '06:00 PM - 10:00 PM', 8.0)
ON CONFLICT DO NOTHING;
