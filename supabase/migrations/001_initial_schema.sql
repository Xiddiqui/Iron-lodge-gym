-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')) DEFAULT 'staff',
  section_access TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users or admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. GYM SETTINGS
-- ============================================
CREATE TABLE public.gym_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  gym_name TEXT NOT NULL DEFAULT 'Iron Lodge Gym',
  logo_url TEXT,
  currency TEXT DEFAULT 'PKR',
  timezone TEXT DEFAULT 'Asia/Karachi',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read gym settings"
  ON public.gym_settings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update gym settings"
  ON public.gym_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Insert default settings
INSERT INTO public.gym_settings (gym_name) VALUES ('Iron Lodge Gym');

-- ============================================
-- 3. MEMBERS
-- ============================================
CREATE TABLE public.members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  cnic TEXT,
  age INTEGER,
  email TEXT,
  address TEXT,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  monthly_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read members"
  ON public.members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert members"
  ON public.members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update members"
  ON public.members FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete members"
  ON public.members FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 4. FEE RECORDS
-- ============================================
CREATE TABLE public.fee_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  period_month DATE NOT NULL,         -- First day of the billing month (e.g., '2026-08-01')
  period_end DATE NOT NULL,           -- Last day of billing period
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  payment_method TEXT CHECK (payment_method IN ('cash', 'online', 'card', 'other')),
  collected_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fee records"
  ON public.fee_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert fee records"
  ON public.fee_records FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update fee records"
  ON public.fee_records FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Unique constraint: one fee per member per period
CREATE UNIQUE INDEX fee_records_member_period_idx
  ON public.fee_records (member_id, period_month);

-- ============================================
-- 5. EXPENSES
-- ============================================
CREATE TABLE public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('rent', 'utility', 'salary', 'maintenance', 'equipment', 'misc')),
  amount NUMERIC(10, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  logged_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update expenses"
  ON public.expenses FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete expenses"
  ON public.expenses FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 6. ATTENDANCE
-- ============================================
CREATE TABLE public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out TIMESTAMPTZ,
  marked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attendance"
  ON public.attendance FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update attendance"
  ON public.attendance FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Unique: one check-in per member per day
CREATE UNIQUE INDEX attendance_member_day_idx
  ON public.attendance (member_id, ((check_in AT TIME ZONE 'UTC')::date));

-- ============================================
-- 7. ENQUIRIES
-- ============================================
CREATE TABLE public.enquiries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'converted', 'closed')) DEFAULT 'new',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read enquiries"
  ON public.enquiries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert enquiries"
  ON public.enquiries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update enquiries"
  ON public.enquiries FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- 8. HELPER FUNCTIONS: Get user role & Admin check
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
