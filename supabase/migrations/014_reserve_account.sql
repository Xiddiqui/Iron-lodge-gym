-- ============================================
-- Reserve Account Feature
-- ============================================

-- 1. Add reserve_percentage to gym_settings
ALTER TABLE public.gym_settings
  ADD COLUMN IF NOT EXISTS reserve_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0;

-- 2. Add is_reserve flag to expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_reserve BOOLEAN NOT NULL DEFAULT false;

-- 3. Update the category CHECK constraint to allow 'reserve'
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_category_check
  CHECK (category IN ('rent', 'utility', 'salary', 'maintenance', 'equipment', 'misc', 'reserve'));
