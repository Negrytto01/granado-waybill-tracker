
-- 1) Tighten usuarios self-insert to prevent privilege escalation via duplicate rows
DROP POLICY IF EXISTS "Users can self-insert non-master profile" ON public.usuarios;

CREATE POLICY "Users can self-insert non-master profile"
  ON public.usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND cargo <> 'Master'::cargo_tipo
    AND NOT EXISTS (
      SELECT 1 FROM public.usuarios u WHERE u.user_id = auth.uid()
    )
  );

-- 2) Stop broadcasting fluxo_financeiro changes to all subscribers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'fluxo_financeiro'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.fluxo_financeiro';
  END IF;
END $$;
