-- Add landing_page_data JSONB column to gym_settings table
ALTER TABLE public.gym_settings ADD COLUMN IF NOT EXISTS landing_page_data JSONB DEFAULT NULL;

-- Update RLS policy to allow public read access for gym_settings (needed for public landing page)
DROP POLICY IF EXISTS "Anyone authenticated can read gym settings" ON public.gym_settings;
DROP POLICY IF EXISTS "Anyone can read gym settings" ON public.gym_settings;

CREATE POLICY "Anyone can read gym settings"
  ON public.gym_settings FOR SELECT
  USING (true);
