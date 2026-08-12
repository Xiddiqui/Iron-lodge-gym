-- Migration 017: Add auto_assign_male and auto_assign_female to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_assign_male BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_assign_female BOOLEAN DEFAULT FALSE;
