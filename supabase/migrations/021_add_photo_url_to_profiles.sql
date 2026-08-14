-- Migration 021: Add photo_url column to profiles table for staff avatar support
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
