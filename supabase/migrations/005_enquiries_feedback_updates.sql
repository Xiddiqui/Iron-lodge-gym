-- Migration 005: Enquiries & Feedback updates

-- 1. Add is_read column to enquiries if it doesn't exist
ALTER TABLE public.enquiries 
ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- 2. Ensure anyone (including unauthenticated users) can insert into enquiries for /feedback form
DROP POLICY IF EXISTS "Authenticated users can insert enquiries" ON public.enquiries;
DROP POLICY IF EXISTS "Anyone can insert enquiries" ON public.enquiries;

CREATE POLICY "Anyone can insert enquiries"
  ON public.enquiries FOR INSERT
  WITH CHECK (true);

-- 3. Ensure authenticated users (or admins) can read and update enquiries
DROP POLICY IF EXISTS "Authenticated users can read enquiries" ON public.enquiries;
CREATE POLICY "Authenticated users can read enquiries"
  ON public.enquiries FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update enquiries" ON public.enquiries;
CREATE POLICY "Authenticated users can update enquiries"
  ON public.enquiries FOR UPDATE
  USING (auth.uid() IS NOT NULL);
