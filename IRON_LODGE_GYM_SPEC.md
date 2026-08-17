# Iron Lodge Gym Management System — Complete Specification

> **Purpose**: This document is a complete, detailed specification to recreate an **exact copy** of the gym management web application at `https://gymmmms.lovable.app/` using **Next.js (App Router)**, **PostgreSQL (via Supabase)**, and **Supabase Auth**. All backend APIs must live inside Next.js (API routes / server actions). Follow every detail precisely.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Design System & Theme](#3-design-system--theme)
4. [Database Schema (Supabase / PostgreSQL)](#4-database-schema-supabase--postgresql)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Navigation & Layout](#6-navigation--layout)
7. [Pages & Features — Detailed](#7-pages--features--detailed)
8. [API Routes (Next.js Backend)](#8-api-routes-nextjs-backend)
9. [Utility Functions](#9-utility-functions)
10. [PWA Configuration](#10-pwa-configuration)
11. [Seed Data & Default Credentials](#11-seed-data--default-credentials)
12. [Environment Variables](#12-environment-variables)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 14+ (App Router) |
| **Language** | TypeScript |
| **Database** | PostgreSQL (via Supabase) |
| **Auth** | Supabase Auth (email/password) |
| **ORM / Client** | `@supabase/supabase-js` + `@supabase/ssr` |
| **State Management** | TanStack React Query (`@tanstack/react-query`) |
| **Styling** | Tailwind CSS v4 |
| **UI Components** | shadcn/ui (Button, Card, Badge, Input, Select, Label, Dialog, Table, Tabs, Separator) |
| **Icons** | Lucide React (`lucide-react`) |
| **Charts** | Recharts (`recharts`) — BarChart, AreaChart, PieChart |
| **Animations** | Framer Motion (`motion`) |
| **Fonts** | Google Fonts: **Inter** (body, 400/500/600/700) + **Space Grotesk** (display/headings, 500/600/700) |
| **Toast** | Sonner (`sonner`) |
| **Date Utils** | `date-fns` |
| **Form Validation** | Zod |

### Install Commands
```bash
npx create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query recharts motion lucide-react sonner date-fns zod
npx shadcn@latest init
npx shadcn@latest add button card badge input select label dialog table tabs separator sheet avatar dropdown-menu
```

---

## 2. Project Structure

```
iron-lodge-gym/
├── public/
│   ├── favicon.png
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── apple-touch-icon.png
│   └── manifest.webmanifest
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (fonts, providers, metadata)
│   │   ├── page.tsx                   # Redirect to /dashboard or /auth
│   │   ├── globals.css                # Tailwind + custom CSS variables
│   │   ├── auth/
│   │   │   └── page.tsx               # Login page
│   │   ├── (authenticated)/
│   │   │   ├── layout.tsx             # Sidebar layout with auth guard
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx           # Admin dashboard (stats, charts, tables)
│   │   │   ├── members/
│   │   │   │   └── page.tsx           # Member list + CRUD
│   │   │   ├── attendance/
│   │   │   │   └── page.tsx           # Attendance tracking
│   │   │   ├── enquiries/
│   │   │   │   └── page.tsx           # Enquiries / messages
│   │   │   ├── expenses/
│   │   │   │   └── page.tsx           # Expense management (admin only)
│   │   │   └── settings/
│   │   │       └── page.tsx           # Gym settings (admin only)
│   │   └── api/
│   │       ├── auth/
│   │       │   └── callback/route.ts  # Supabase auth callback
│   │       ├── fees/
│   │       │   ├── generate/route.ts  # Generate fee records for month
│   │       │   └── collect/route.ts   # Mark fee as paid
│   │       └── role/
│   │           └── route.ts           # Get user role
│   ├── components/
│   │   ├── ui/                        # shadcn/ui primitives
│   │   ├── layout/
│   │   │   ├── sidebar.tsx            # Main sidebar navigation
│   │   │   ├── mobile-header.tsx      # Mobile top bar
│   │   │   └── auth-guard.tsx         # Auth protection wrapper
│   │   ├── dashboard/
│   │   │   ├── stat-card.tsx          # Animated stat card
│   │   │   ├── trend-chart.tsx        # Revenue/Expense/Profit area chart
│   │   │   ├── fee-status-pie.tsx     # Paid vs Unpaid pie chart
│   │   │   ├── recent-payments.tsx    # Recent payments table
│   │   │   ├── expense-breakdown.tsx  # Expense bar chart
│   │   │   └── month-selector.tsx     # Year-month picker
│   │   ├── members/
│   │   │   ├── member-table.tsx       # Members list with search/filter
│   │   │   ├── member-form.tsx        # Add/Edit member dialog
│   │   │   └── member-detail.tsx      # Member detail view
│   │   ├── fees/
│   │   │   ├── fee-table.tsx          # Fee records table
│   │   │   ├── fee-collect-dialog.tsx # Payment collection dialog
│   │   │   └── generate-fees-btn.tsx  # Generate monthly fees button
│   │   ├── attendance/
│   │   │   ├── attendance-list.tsx    # Today's attendance
│   │   │   └── mark-attendance.tsx    # Mark member attendance
│   │   ├── enquiries/
│   │   │   ├── enquiry-list.tsx       # Enquiries table
│   │   │   └── enquiry-form.tsx       # New enquiry form
│   │   ├── expenses/
│   │   │   ├── expense-table.tsx      # Expenses table
│   │   │   └── expense-form.tsx       # Add expense dialog
│   │   └── settings/
│   │       └── gym-settings-form.tsx  # Gym name, logo upload
│   ├── hooks/
│   │   ├── use-session.ts             # Current user hook
│   │   ├── use-role.ts                # User role hook (admin/staff)
│   │   └── use-gym-settings.ts        # Gym settings hook
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   ├── server.ts             # Server Supabase client
│   │   │   └── middleware.ts          # Supabase middleware
│   │   ├── utils.ts                   # cn() helper
│   │   ├── format.ts                  # formatCurrency, formatDate utilities
│   │   └── constants.ts              # Expense categories, etc.
│   ├── providers/
│   │   └── query-provider.tsx         # TanStack Query provider
│   └── middleware.ts                  # Next.js middleware for auth
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # Full database schema
├── .env.local
├── tailwind.config.ts
├── next.config.js
└── package.json
```

---

## 3. Design System & Theme

### Color Palette (Dark Theme — MANDATORY)

The app uses an extremely dark theme with a vibrant lime-green accent. This is the **EXACT** color scheme — do not deviate.

```css
/* globals.css — CSS Custom Properties */
:root {
  --background: 0 0% 3.5%;          /* #09090b — zinc-950 */
  --foreground: 0 0% 98%;           /* #fafafa */
  --card: 0 0% 5%;                  /* slightly lighter than bg */
  --card-foreground: 0 0% 98%;
  --popover: 0 0% 5%;
  --popover-foreground: 0 0% 98%;
  --primary: 82 85% 55%;            /* #a3e635 — lime-400 */
  --primary-foreground: 0 0% 3.5%;  /* dark text on lime */
  --secondary: 0 0% 10%;
  --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 10%;
  --muted-foreground: 0 0% 55%;
  --accent: 0 0% 12%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 12%;
  --input: 0 0% 12%;
  --ring: 82 85% 55%;

  /* Sidebar specific */
  --sidebar-bg: linear-gradient(180deg, hsl(0 0% 6%) 0%, hsl(0 0% 3.5%) 100%);
  --sidebar-foreground: 0 0% 90%;
  --sidebar-border: 0 0% 12%;
  --sidebar-accent: 0 0% 14%;
  --sidebar-accent-foreground: 0 0% 98%;

  /* Custom gradients */
  --gradient-primary: linear-gradient(135deg, #a3e635 0%, #65a30d 100%);
  --gradient-sidebar: linear-gradient(180deg, hsl(0 0% 6%) 0%, hsl(0 0% 3.5%) 100%);

  /* Shadows */
  --shadow-elegant: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3);
}
```

### Typography

```css
/* Font declarations */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');

body {
  font-family: 'Inter', sans-serif;
}

.font-display {
  font-family: 'Space Grotesk', sans-serif;
}
```

### Key Design Rules

1. **Background**: Pure dark `#09090b` (zinc-950)
2. **Cards**: Slightly lighter `hsl(0 0% 5%)` with `border-border` (subtle 12% white)
3. **Primary buttons/active nav**: Lime gradient (`#a3e635` → `#65a30d`)
4. **Active nav indicator**: A small white vertical bar on the left side of active nav items, animated with `layoutId`
5. **Sidebar**: Has a large blurred gradient glow circle at top-left corner (pointer-events-none, opacity-30, blur-3xl)
6. **Animations**: All page transitions use Framer Motion `opacity` + `y` slide (0.22s ease-out). Nav items stagger in with `x` slide.
7. **Mobile**: Sidebar slides in from left as overlay with spring animation (stiffness: 260, damping: 28). Background has `bg-black/60 backdrop-blur-sm`.
8. **Stat cards**: Use animated number counting (Framer Motion `useMotionValue` + `useTransform`, 1.1s easeOut)
9. **Text hierarchy**: Headings use Space Grotesk, body uses Inter
10. **Status badges**: Use colored badges — green for paid/active, red for unpaid, yellow for pending, gray for inactive

---

## 4. Database Schema (Supabase / PostgreSQL)

### Migration SQL (`supabase/migrations/001_initial_schema.sql`)

```sql
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
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

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
-- 5B. RESERVE DEPOSITS (Other Business / Savings)
-- ============================================
CREATE TABLE public.reserve_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'Other Business',
  notes TEXT,
  logged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Unique: one check-in per member per day
CREATE UNIQUE INDEX attendance_member_day_idx
  ON public.attendance (member_id, (check_in::date));

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
-- 8. HELPER FUNCTION: Get user role
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
```

---

## 5. Authentication & Authorization

### Login Page (`/auth`)

- Clean dark login form with lime-green accent
- **Fields**: Email, Password
- **Button**: "Sign In" with gradient primary background
- Supabase `signInWithPassword`
- On success: redirect to `/dashboard` (admin) or `/members` (staff)
- Show toast on error using Sonner

### Role-Based Access

| Feature | Admin | Staff |
|---|:---:|:---:|
| Dashboard | ✅ | ❌ (redirected to /members) |
| Members | ✅ | ✅ |
| Attendance | ✅ | ✅ |
| Enquiries | ✅ | ✅ |
| Expenses | ✅ | ❌ (hidden from nav) |
| Settings | ✅ | ❌ (hidden from nav) |

### Auth Hooks

```typescript
// use-session.ts
function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      return error ? null : data.user;
    },
    staleTime: 0,
  });
}

// use-role.ts
function useRole() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ['my-role', user?.id],
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      // Call Supabase RPC or API route to get role
      const { data } = await supabase.rpc('get_my_role');
      return data; // 'admin' | 'staff'
    },
  });
}
```

### Route Protection

- Staff attempting to access `/dashboard`, `/expenses`, or `/settings` should be redirected to `/members`
- Unauthenticated users should be redirected to `/auth`
- Use Next.js middleware + client-side `useEffect` checks

---

## 6. Navigation & Layout

### Sidebar (Desktop — visible md+ breakpoint)

The sidebar is a fixed-height, `w-64` aside with:

1. **Glow effect**: A large blurred circle (`h-64 w-64 rounded-full opacity-30 blur-3xl`) at top-left with `gradient-primary` background
2. **Header section** (border-bottom):
   - Gym logo (from `gym_settings.logo_url`) or dumbbell icon in a `h-11 w-11 rounded-xl` gradient container
   - Gym name (from `gym_settings.gym_name`, fallback: "Gym Manager")
   - Subtitle "Gym Manager" (only for admin role, `text-[11px] uppercase tracking-widest`)
3. **Navigation links** (with stagger animation):
   ```
   Dashboard    — LayoutDashboard icon  — adminOnly: true
   Members      — Users icon
   Attendance   — CalendarCheck icon
   Enquiries    — MessageSquare icon
   Expenses     — Receipt icon           — adminOnly: true
   Settings     — Settings icon           — adminOnly: true
   ```
   - Active link: `bg-gradient-primary text-primary-foreground shadow-elegant`
   - Active indicator: White vertical bar `h-6 w-1 rounded-r-full` on the left, animated with `layoutId="nav-dot"`
   - Inactive: `text-sidebar-foreground/75 hover:bg-sidebar-accent`
4. **User section** (border-top):
   - Avatar circle with first letter of name
   - User full name + role label
   - "Sign out" button with LogOut icon

### Mobile Header + Sheet

- Sticky top bar with hamburger menu icon (Menu/X icons), gym logo + name centered
- Sidebar opens as animated overlay from left (Framer Motion spring: `stiffness: 260, damping: 28`)
- Backdrop: `bg-black/60 backdrop-blur-sm`

### Page Transitions

Every page wraps content in:
```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -4 }}
  transition={{ duration: 0.22, ease: 'easeOut' }}
>
  {children}
</motion.div>
```

---

## 7. Pages & Features — Detailed

### 7.1 Login Page (`/auth`)

- Full-screen dark background
- Centered card with:
  - Dumbbell icon in gradient primary circle
  - "Gym Manager" title (Space Grotesk)
  - "Sign in to your account" subtitle
  - Email input
  - Password input
  - "Sign In" button (gradient primary, full width)
- On submit → `supabase.auth.signInWithPassword()`
- On success → redirect based on role

---

### 7.2 Dashboard Page (`/dashboard`) — ADMIN ONLY

This is the main analytics page. It has:

#### Month Selector
- A dropdown/select at the top to pick Year-Month (default: current month)
- Format: `YYYY-MM`

#### Stat Cards Row (4 cards)
Animated number counters using Framer Motion `useMotionValue`:

| Card | Icon | Color | Value |
|---|---|---|---|
| Revenue | Wallet | Lime/Green | Total paid fees for selected month |
| Expenses | Receipt | Red/Orange | Total expenses for selected month |
| Net Profit | Zap | Green (if positive), Red (if negative) | Revenue - Expenses |
| Active Members | UserCheck | Blue | Count of active members |

Each card shows:
- Icon in a small colored circle
- Label text (muted)
- Animated big number in PKR format
- Trend arrow (ArrowUpRight or ArrowDownRight) comparing to previous month
- Percentage change badge

#### Trend Chart (Revenue vs Expenses vs Profit)
- **Type**: Recharts `AreaChart` with gradient fills
- **Duration selector**: 3, 6, 12, or 24 months (buttons/tabs)
- **Data**: Monthly revenue (from `fee_records` where `paid = true`), expenses (from `expenses`), calculated profit
- **Colors**: Green for revenue, Red for expenses, Lime for profit
- **Styling**: Gradient area fills, smooth curves (`type="monotone"`)

#### Fee Collection Status (Pie Chart)
- **Type**: Recharts `PieChart`
- **Data**: Paid vs Unpaid fee records for selected month
- **Colors**: Green (#a3e635) for paid, Red for unpaid
- **Center label**: Total count

#### Recent Payments Table
- Shows latest paid fees with: Member name, Amount (PKR), Date paid, Payment method badge
- Limited to 5-10 most recent

#### Expense Breakdown (Bar Chart)
- **Type**: Recharts `BarChart`
- **Data**: Expenses grouped by category for selected month
- **Categories**: Rent, Utility, Salary, Maintenance, Equipment, Misc
- **Colors**: Different color per category

#### Dashboard Queries (EXACT Supabase queries used)

```typescript
// 1. Fee records for month
const { data: fees } = await supabase
  .from('fee_records')
  .select('id, amount, paid, paid_at, member_id, period_month, period_end, members(full_name, phone)')
  .lt('period_month', endOfMonth)  // period_month < first day of next month
  .gt('period_end', startOfMonth)  // period_end > first day of month
  .order('paid', { ascending: false });

// 2. Expenses for month
const { data: expenses } = await supabase
  .from('expenses')
  .select('id, amount, category, expense_date, name')
  .gte('expense_date', startOfMonth)
  .lt('expense_date', endOfMonth)
  .order('expense_date', { ascending: false });

// 3. Trend data (last N months)
const { data: feeRecords } = await supabase
  .from('fee_records')
  .select('amount, paid, paid_at')
  .eq('paid', true)
  .gte('paid_at', startDate)
  .lt('paid_at', endDate);

const { data: expenseRecords } = await supabase
  .from('expenses')
  .select('amount, expense_date')
  .gte('expense_date', startDate)
  .lt('expense_date', endDate);

// 4. Active member counts (current vs previous month)
const { count: current } = await supabase
  .from('members')
  .select('id', { count: 'exact', head: true })
  .eq('active', true)
  .lte('join_date', endOfCurrentMonth);

const { count: previous } = await supabase
  .from('members')
  .select('id', { count: 'exact', head: true })
  .eq('active', true)
  .lte('join_date', endOfPreviousMonth);
```

---

### 7.3 Members Page (`/members`) — ALL USERS

#### Top Bar
- Page title: "Members" with Users icon
- Search input (searches by name, phone)
- Filter by status: All / Active / Inactive
- "Add Member" button (primary gradient)

#### Members Table
| Column | Description |
|---|---|
| Name | Full name + avatar circle (first letter) |
| Phone | Phone number |
| Join Date | Formatted as "dd MMM yyyy" |
| Monthly Fee | PKR formatted |
| Status | Badge: green "Active" / red "Inactive" |
| Actions | Edit button, Toggle active/inactive |

#### Add/Edit Member Dialog
Fields:
- Full Name (required)
- Phone
- CNIC
- Email
- Address
- Join Date (date picker, default: today)
- Monthly Fee (number, required)
- Notes
- Active (toggle, default: true)

#### Member Detail View
When clicking a member row, show detail panel/dialog with:
- All member info
- Fee history table (all `fee_records` for this member)
- Attendance history
- Quick actions: Collect fee, Mark attendance

---

### 7.4 Attendance Page (`/attendance`) — ALL USERS

#### Layout
- Date selector at top (default: today)
- "Mark Attendance" button → opens dialog to search and select a member
- Attendance list for selected date showing:
  | Column | Description |
  |---|---|
  | Member Name | With avatar |
  | Check-in Time | Formatted time |
  | Check-out Time | If available |
  | Marked By | Staff name who marked |

#### Mark Attendance Dialog
- Search members by name
- Click to mark check-in
- If already checked in, show option to mark check-out

---

### 7.5 Enquiries Page (`/enquiries`) — ALL USERS

#### Layout
- "New Enquiry" button at top
- Enquiries table:
  | Column | Description |
  |---|---|
  | Name | Enquirer's name |
  | Phone | Phone number |
  | Status | Badge: New (blue), Contacted (yellow), Converted (green), Closed (gray) |
  | Date | Created at, formatted |
  | Actions | Edit status, View details |

#### New Enquiry Form
Fields:
- Name (required)
- Phone
- Email
- Message/notes
- Status (dropdown: New, Contacted, Converted, Closed)

---

### 7.6 Expenses Page (`/expenses`) — ADMIN ONLY

#### Layout
- Month selector at top
- "Add Expense" button
- Expenses table:
  | Column | Description |
  |---|---|
  | Name/Title | Expense name |
  | Category | Badge with category color |
  | Amount | PKR formatted |
  | Date | Formatted date |
  | Actions | Edit, Delete |

#### Add Expense Dialog
Fields:
- Name/Title (required)
- Category (select: Rent, Utility, Salary, Maintenance, Equipment, Misc)
- Amount (number, required)
- Date (date picker, default: today)
- Notes

#### Category Colors
```
rent        → Slate/Gray badge
utility     → Blue badge
salary      → Purple badge
maintenance → Orange badge
equipment   → Cyan badge
misc        → Default/Gray badge
```

---

### 7.7 Settings Page (`/settings`) — ADMIN ONLY

#### Gym Settings Form
- Gym Name (text input)
- Logo (file upload → Supabase Storage → save URL to `gym_settings.logo_url`)
- Save button

#### Staff Management Section
- List of all profiles (staff users)
- Ability to change role (admin/staff) — admin only
- Ability to add new staff member (creates auth user + profile)

---

## 8. API Routes (Next.js Backend)

### `POST /api/fees/generate`
- **Purpose**: Generate fee records for all active members for a given month
- **Body**: `{ month: "2026-08-01" }`
- **Logic**:
  1. Get all active members
  2. For each member, create a `fee_records` entry with `period_month`, `period_end`, `amount = member.monthly_fee`, `paid = false`
  3. Skip if fee record already exists for that member/month (upsert or check)
- **Auth**: Admin only

### `POST /api/fees/collect`
- **Purpose**: Mark a fee as paid
- **Body**: `{ feeId: "uuid", paymentMethod: "cash" | "online" }`
- **Logic**: Update `fee_records` set `paid = true`, `paid_at = NOW()`, `payment_method`, `collected_by = currentUserId`
- **Auth**: Any authenticated user

### `GET /api/role`
- **Purpose**: Return current user's role
- **Response**: `{ role: "admin" | "staff" }`
- **Auth**: Any authenticated user

---

## 9. Utility Functions

### `formatCurrency(value: number | string): string`
```typescript
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(num)) return 'PKR 0';
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(num);
}
```

### `formatDate(date: string | Date): string`
```typescript
export function formatDate(date: string | Date): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
```

### `formatMonthYear(date: Date): string`
```typescript
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}
```

### `getMonthStart(date?: Date): string`
```typescript
export function getMonthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}
```

### `daysBetween(a: Date, b: Date): number`
```typescript
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}
```

---

## 10. PWA Configuration

### `public/manifest.webmanifest`
```json
{
  "name": "Gym Manager",
  "short_name": "Gym Manager",
  "description": "Digital gym register: members, monthly fees, expenses, and profit at a glance.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#000000",
  "theme_color": "#a3e635",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Root Layout `<head>` Meta Tags
```html
<meta name="theme-color" content="#a3e635" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Gym Manager" />
<meta name="description" content="Digital gym register: members, monthly fees, expenses, and profit at a glance." />
<meta property="og:title" content="Gym Manager" />
<meta property="og:description" content="Digital gym register: members, fees, expenses and profit dashboard." />
<meta property="og:type" content="website" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
```

---

## 11. Seed Data & Default Credentials

### Admin User
```
Email:    manager1@gmail.com
Password: Iron048
Role:     admin
Name:     Alfat Rahman Manager
```

### Staff User
```
Email:    ahmad@gmail.com
Password: Staff1234
Role:     staff
Name:     Ahmad Staff
```

### Seeding Script
After setting up Supabase, create these users via Supabase Auth dashboard or a seed script:

```typescript
// seed.ts (run once)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Create admin user
const { data: admin } = await supabase.auth.admin.createUser({
  email: 'manager1@gmail.com',
  password: 'Iron048',
  email_confirm: true,
  user_metadata: { full_name: 'Alfat Rahman Manager', role: 'admin' },
});

// Create staff user
const { data: staff } = await supabase.auth.admin.createUser({
  email: 'ahmad@gmail.com',
  password: 'Staff1234',
  email_confirm: true,
  user_metadata: { full_name: 'Ahmad Staff', role: 'staff' },
});

// Update profiles to ensure correct roles
if (admin.user) {
  await supabase.from('profiles').update({ role: 'admin' }).eq('id', admin.user.id);
}
if (staff.user) {
  await supabase.from('profiles').update({ role: 'staff' }).eq('id', staff.user.id);
}
```

---

## 12. Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # server-side only
```

---

## Critical Implementation Notes

1. **EXACT COLOR SCHEME**: The app is dark-themed with `#09090b` background and `#a3e635` lime accent. Do NOT use default shadcn colors.

2. **CURRENCY IS PKR**: All monetary values must be formatted as Pakistani Rupees using `Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 })`.

3. **DATE FORMAT**: Use `en-GB` locale — "01 Aug 2026" format (`{ day: '2-digit', month: 'short', year: 'numeric' }`).

4. **ANIMATED NUMBERS**: Dashboard stat cards must use Framer Motion `useMotionValue` + `useTransform` for counting animation (duration: 1.1s, ease: easeOut).

5. **SIDEBAR NAV INDICATOR**: The active nav item has an animated white bar (`layoutId="nav-dot"`) that smoothly transitions between items.

6. **PAGE TRANSITIONS**: Every page uses Framer Motion AnimatePresence with fade+slide animations.

7. **RECHARTS**: Use Recharts for all charts (NOT Chart.js, NOT D3). The dashboard has: AreaChart (trend), PieChart (fee status), BarChart (expense breakdown).

8. **FEE RECORDS SYSTEM**: Fee records are generated monthly for all active members. `period_month` is the first day of the month, `period_end` is the last day. Fees can be marked as paid by any user (admin or staff).

9. **SUPABASE RPC**: Use `supabase.rpc('get_my_role')` to get the current user's role. This is a SQL function, not a direct table query (for security).

10. **GYM SETTINGS**: The `gym_settings` table is a single-row table (constrained by `id = 1`). It stores gym name and logo URL. The sidebar and mobile header read from this table.

11. **TAILWIND CLASS NAMING**: Use the exact class patterns from the source:
    - `bg-gradient-primary` → lime gradient
    - `shadow-elegant` → subtle dark shadow
    - `font-display` → Space Grotesk
    - `tracking-tight`, `tracking-widest` for letter spacing

12. **MOBILE RESPONSIVE**: Sidebar is hidden on mobile (`hidden md:block`). Mobile has a sticky top header with hamburger menu. Sidebar slides in as overlay with spring animation.

13. **TOAST NOTIFICATIONS**: Use Sonner for all success/error notifications (e.g., "Signed out", "Member added", "Fee collected").

14. **STAFF REDIRECTION**: Staff users are automatically redirected away from admin-only pages. In the sidebar, admin-only nav items are filtered out for staff users.
