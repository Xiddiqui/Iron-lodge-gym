-- Staff can collect a payment, including adding to a partial balance.
-- Reducing a recorded payment, or changing the fee after money was recorded, is admin-only.

CREATE OR REPLACE FUNCTION public.protect_recorded_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.amount_paid, 0) > 0
     AND COALESCE(NEW.amount_paid, 0) < COALESCE(OLD.amount_paid, 0) THEN
    RAISE EXCEPTION 'Only an admin can update a recorded payment';
  END IF;

  IF COALESCE(OLD.amount_paid, 0) > 0
     AND NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'Only an admin can update a recorded payment';
  END IF;

  IF COALESCE(OLD.amount_paid, 0) > 0
     AND COALESCE(NEW.discount, 0) < COALESCE(OLD.discount, 0) THEN
    RAISE EXCEPTION 'Only an admin can update a recorded payment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_recorded_payments ON public.fee_records;
CREATE TRIGGER protect_recorded_payments
  BEFORE UPDATE ON public.fee_records
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_recorded_payments();
