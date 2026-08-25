-- Migration 028: Fix static 12:00:00 / 00:00:00 timestamps in fee_records with real created_at timestamps
UPDATE public.fee_records f
SET paid_at = COALESCE(f.created_at, m.created_at, f.paid_at)
FROM public.members m
WHERE f.member_id = m.id
  AND f.paid_at IS NOT NULL
  AND (
    (EXTRACT(HOUR FROM f.paid_at AT TIME ZONE 'UTC') = 12 AND EXTRACT(MINUTE FROM f.paid_at AT TIME ZONE 'UTC') = 0 AND EXTRACT(SECOND FROM f.paid_at AT TIME ZONE 'UTC') = 0)
    OR
    (EXTRACT(HOUR FROM f.paid_at AT TIME ZONE 'UTC') = 0 AND EXTRACT(MINUTE FROM f.paid_at AT TIME ZONE 'UTC') = 0 AND EXTRACT(SECOND FROM f.paid_at AT TIME ZONE 'UTC') = 0)
  );
