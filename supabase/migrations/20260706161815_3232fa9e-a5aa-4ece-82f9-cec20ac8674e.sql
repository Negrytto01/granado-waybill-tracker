
-- Fix 1: Remove atividades_usuarios from realtime publication (admin-only table shouldn't broadcast)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='atividades_usuarios') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.atividades_usuarios';
  END IF;
END $$;

-- Fix 2: Recreate valores_descarga DELETE policy scoped to authenticated (was public)
DROP POLICY IF EXISTS "Admins can delete valores_descarga" ON public.valores_descarga;
CREATE POLICY "Admins can delete valores_descarga"
  ON public.valores_descarga
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));
