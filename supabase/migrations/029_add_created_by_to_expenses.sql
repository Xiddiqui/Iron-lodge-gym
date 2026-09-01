-- Migration 029: Add created_by column to expenses table (referencing profiles) for schema compatibility
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
