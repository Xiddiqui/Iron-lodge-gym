-- Run this AFTER running 001_initial_schema.sql
-- This creates the admin profile for the user who signed up before the trigger existed

INSERT INTO public.profiles (id, full_name, email, role)
VALUES (
  '30759c13-ad3f-4406-a995-041ba4af8df1',
  'Alfat Rahman Manager',
  'manager1@gmail.com',
  'admin'
)
ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Alfat Rahman Manager';
