-- Migration 006: Allow 'read' status in enquiries status check constraint

ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_status_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_status_check CHECK (status IN ('new', 'read', 'contacted', 'converted', 'closed'));
