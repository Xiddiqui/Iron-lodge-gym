-- ============================================
-- Migration 024: Reserve Deposits (Other Business / External Savings)
-- ============================================

CREATE TABLE IF NOT EXISTS public.reserve_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'Other Business',
  notes TEXT,
  logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by date
CREATE INDEX IF NOT EXISTS idx_reserve_deposits_date ON public.reserve_deposits(deposit_date);

-- Enable RLS
ALTER TABLE public.reserve_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reserve_deposits"
  ON public.reserve_deposits FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert reserve_deposits"
  ON public.reserve_deposits FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update reserve_deposits"
  ON public.reserve_deposits FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete reserve_deposits"
  ON public.reserve_deposits FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
