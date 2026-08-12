-- Migration 020: Add member verification function and member_number column to enquiries
-- ──────────────────────────────────────────────────────────────
-- 1. Add member_number and member_id columns to enquiries table
-- 2. Create verify_member_exists SECURITY DEFINER RPC function
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.enquiries 
  ADD COLUMN IF NOT EXISTS member_number TEXT,
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.verify_member_exists(p_member_number text)
RETURNS TABLE (
  exists boolean,
  member_id uuid,
  member_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_member_number IS NULL OR trim(p_member_number) = '' THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    true as exists,
    m.id as member_id,
    m.member_number as member_number
  FROM public.members m
  WHERE trim(m.member_number) = trim(p_member_number)
     OR (
          m.member_number ~ '^[0-9]+$' 
          AND trim(p_member_number) ~ '^[0-9]+$' 
          AND m.member_number::bigint = trim(p_member_number)::bigint
        )
     OR m.id::text = trim(p_member_number)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_member_exists(text) TO anon, authenticated, service_role;
