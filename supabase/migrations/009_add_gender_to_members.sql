-- Migration 009: Add gender column to members table
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
