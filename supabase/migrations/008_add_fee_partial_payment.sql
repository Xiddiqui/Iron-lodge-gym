-- Migration 008: Add partial payment tracking to fee_records
-- Adds amount_paid (how much was actually paid) and discount columns

ALTER TABLE public.fee_records
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Backfill: for existing paid records, set amount_paid = amount
UPDATE public.fee_records
  SET amount_paid = amount
  WHERE paid = true AND amount_paid = 0;
