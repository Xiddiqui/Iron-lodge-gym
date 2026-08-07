-- Migration 015: Add created_by to members and create member_pending_edits table

-- 1. Add created_by column to members table (referencing profiles)
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create member_pending_edits table
CREATE TABLE IF NOT EXISTS public.member_pending_edits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  changes JSONB NOT NULL,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_member_pending_edits_status ON public.member_pending_edits(status);
CREATE INDEX IF NOT EXISTS idx_member_pending_edits_member_id ON public.member_pending_edits(member_id);

-- RLS Policies
ALTER TABLE public.member_pending_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read member_pending_edits"
  ON public.member_pending_edits FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert member_pending_edits"
  ON public.member_pending_edits FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update member_pending_edits"
  ON public.member_pending_edits FOR UPDATE
  USING (auth.uid() IS NOT NULL);
