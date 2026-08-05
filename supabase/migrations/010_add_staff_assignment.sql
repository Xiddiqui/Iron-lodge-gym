-- Migration 010: Add assigned_staff_id column to members table
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
