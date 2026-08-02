-- Migration 004: Update trainers table with photo_url, cnic, availability_slot, experience_years

ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS cnic TEXT,
  ADD COLUMN IF NOT EXISTS availability_slot TEXT,
  ADD COLUMN IF NOT EXISTS experience_years NUMERIC(4, 1);
