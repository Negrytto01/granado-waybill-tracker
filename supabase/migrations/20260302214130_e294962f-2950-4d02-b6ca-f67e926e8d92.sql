
-- 1. Add "ativo" column to usuarios for activate/deactivate instead of delete
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- 2. Add "valor_por_tonelada" to valores_descarga for weight-based pricing
ALTER TABLE public.valores_descarga ADD COLUMN IF NOT EXISTS valor_por_tonelada numeric NOT NULL DEFAULT 0;

-- 3. Add "toneladas" and "tipo_descarga" to recebimentos  
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS toneladas numeric DEFAULT 0;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS tipo_descarga text DEFAULT NULL;

-- 4. Add "calendario" to the permissions page list and add default permissions
INSERT INTO public.cargo_permissoes (cargo, pagina, ativo)
SELECT c.cargo, 'calendario', true
FROM (VALUES ('Recebimento'), ('Conferente'), ('Estoque'), ('Fiscal'), ('Compras'), ('Financeiro'), ('Faturamento')) AS c(cargo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.cargo_permissoes cp WHERE cp.cargo = c.cargo AND cp.pagina = 'calendario'
);

-- 5. Add cascade delete: when a recebimento is deleted, delete related armazenagem and fluxo_financeiro
ALTER TABLE public.armazenagem DROP CONSTRAINT IF EXISTS armazenagem_recebimento_id_fkey;
ALTER TABLE public.armazenagem ADD CONSTRAINT armazenagem_recebimento_id_fkey 
  FOREIGN KEY (recebimento_id) REFERENCES public.recebimentos(id) ON DELETE CASCADE;

ALTER TABLE public.fluxo_financeiro DROP CONSTRAINT IF EXISTS fluxo_financeiro_recebimento_id_fkey;
ALTER TABLE public.fluxo_financeiro ADD CONSTRAINT fluxo_financeiro_recebimento_id_fkey 
  FOREIGN KEY (recebimento_id) REFERENCES public.recebimentos(id) ON DELETE CASCADE;

-- 6. Add delete policy for valores_descarga for admins
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete valores_descarga' AND tablename = 'valores_descarga') THEN
    CREATE POLICY "Admins can delete valores_descarga"
    ON public.valores_descarga FOR DELETE
    USING (is_admin(auth.uid()));
  END IF;
END $$;

-- 7. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_recebimentos_status ON public.recebimentos(status);
CREATE INDEX IF NOT EXISTS idx_recebimentos_data_prevista ON public.recebimentos(data_prevista);
CREATE INDEX IF NOT EXISTS idx_armazenagem_status ON public.armazenagem(status);
CREATE INDEX IF NOT EXISTS idx_fluxo_financeiro_mes ON public.fluxo_financeiro(mes_referencia);
