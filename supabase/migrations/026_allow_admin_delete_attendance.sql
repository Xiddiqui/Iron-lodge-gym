-- Migration 026: Allow authenticated admins to delete attendance records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attendance' AND policyname = 'Authenticated users can delete attendance'
  ) THEN
    CREATE POLICY "Authenticated users can delete attendance"
      ON public.attendance FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;
