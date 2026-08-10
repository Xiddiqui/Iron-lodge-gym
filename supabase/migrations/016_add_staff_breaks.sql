-- Migration 016: Add staff_breaks table for tracking explicit break periods
CREATE TABLE IF NOT EXISTS public.staff_breaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES public.staff_attendance(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff_breaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for staff_breaks
CREATE POLICY "Admins and user can read staff breaks"
  ON public.staff_breaks FOR SELECT
  USING (
    auth.uid() = profile_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users and admins can insert staff breaks"
  ON public.staff_breaks FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users and admins can update staff breaks"
  ON public.staff_breaks FOR UPDATE
  USING (
    auth.uid() = profile_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
