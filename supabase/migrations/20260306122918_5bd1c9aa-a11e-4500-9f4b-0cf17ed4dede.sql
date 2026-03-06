
ALTER TYPE public.armazenagem_status ADD VALUE IF NOT EXISTS 'PAUSADO';

ALTER TABLE public.armazenagem ADD COLUMN IF NOT EXISTS pausas jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.armazenagem ADD COLUMN IF NOT EXISTS observacoes_armazenagem text;

ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS is_retirada boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Admins can insert fluxo_financeiro" ON public.fluxo_financeiro;
CREATE POLICY "Authenticated users can insert fluxo_financeiro" ON public.fluxo_financeiro FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can insert mensagens" ON public.mensagens_globais;
CREATE POLICY "Authenticated users can insert mensagens" ON public.mensagens_globais FOR INSERT TO authenticated WITH CHECK (true);
