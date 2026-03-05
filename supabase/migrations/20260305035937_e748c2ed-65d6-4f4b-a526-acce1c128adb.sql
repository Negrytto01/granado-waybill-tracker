
-- Table for solicitacoes de compras
CREATE TABLE public.solicitacoes_compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor TEXT NOT NULL,
  volumes INTEGER DEFAULT 0,
  observacoes TEXT,
  data_sugerida DATE,
  horario_sugerido TIME,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  solicitado_por TEXT NOT NULL,
  solicitado_por_user_id UUID NOT NULL,
  respondido_por TEXT,
  data_resposta TIMESTAMPTZ,
  data_aprovacao_compras TIMESTAMPTZ,
  resposta_observacoes TEXT,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  nf_entries JSONB DEFAULT '[]'
);

ALTER TABLE public.solicitacoes_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read solicitacoes"
ON public.solicitacoes_compras FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert solicitacoes"
ON public.solicitacoes_compras FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update solicitacoes"
ON public.solicitacoes_compras FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Admins can delete solicitacoes"
ON public.solicitacoes_compras FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

-- Table for mensagens globais
CREATE TABLE public.mensagens_globais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem TEXT NOT NULL,
  enviado_por TEXT NOT NULL,
  enviado_por_user_id UUID NOT NULL,
  destinatarios JSONB NOT NULL DEFAULT '["todos"]',
  lida_por JSONB NOT NULL DEFAULT '[]',
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens_globais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mensagens"
ON public.mensagens_globais FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert mensagens"
ON public.mensagens_globais FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete mensagens"
ON public.mensagens_globais FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated users can update mensagens"
ON public.mensagens_globais FOR UPDATE TO authenticated
USING (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_compras;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_globais;
