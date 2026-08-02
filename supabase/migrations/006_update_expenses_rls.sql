-- Migration 006: Update expenses RLS policies to allow authenticated users to manage expenses safely

DROP POLICY IF EXISTS "Admins can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON public.expenses;

CREATE POLICY "Authenticated users can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON public.expenses;

CREATE POLICY "Authenticated users can update expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON public.expenses;

CREATE POLICY "Authenticated users can delete expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() IS NOT NULL);
