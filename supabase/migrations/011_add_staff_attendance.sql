-- Migration 011: Add staff_attendance table for automated credential session tracking
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and user can read staff attendance"
  ON public.staff_attendance FOR SELECT
  USING (
    auth.uid() = profile_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can insert own staff attendance"
  ON public.staff_attendance FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users and admins can update staff attendance"
  ON public.staff_attendance FOR UPDATE
  USING (
    auth.uid() = profile_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
