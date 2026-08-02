-- Migration 007: Fix infinite recursion (42P17) in RLS policies for public.profiles

-- 1. Create a SECURITY DEFINER function to check admin role.
-- SECURITY DEFINER bypasses RLS on public.profiles, breaking any recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Fix policies on public.profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON public.profiles;

CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users or admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

-- 3. Update gym_settings policies using is_admin()
DROP POLICY IF EXISTS "Admins can update gym settings" ON public.gym_settings;
CREATE POLICY "Admins can update gym settings"
  ON public.gym_settings FOR UPDATE
  USING (public.is_admin());

-- 4. Update members delete policy using is_admin()
DROP POLICY IF EXISTS "Admins can delete members" ON public.members;
CREATE POLICY "Admins can delete members"
  ON public.members FOR DELETE
  USING (public.is_admin());
