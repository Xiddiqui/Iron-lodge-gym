-- Migration 012: Enable Supabase Realtime (WebSocket) for attendance tables
-- This is required for the live socket-based attendance dashboard to work.
-- Run this in Supabase SQL Editor.

-- Enable realtime publication for member attendance table
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

-- Enable realtime publication for staff attendance table
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_attendance;
