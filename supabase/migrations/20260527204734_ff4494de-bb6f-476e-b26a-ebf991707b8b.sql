
-- Tabela de chaves de API
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  permissoes jsonb NOT NULL DEFAULT '{"read":[],"write":[]}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_uso timestamptz,
  total_chamadas bigint NOT NULL DEFAULT 0,
  criado_por text,
  criado_por_user_id uuid,
  data_expiracao timestamptz,
  data_criacao timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can read api_keys" ON public.api_keys
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Master can insert api_keys" ON public.api_keys
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Master can update api_keys" ON public.api_keys
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Master can delete api_keys" ON public.api_keys
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Tabela de logs das chamadas externas
CREATE TABLE public.api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE CASCADE,
  api_key_nome text,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  ip text,
  user_agent text,
  payload_resumo text,
  data_criacao timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_logs_data ON public.api_logs(data_criacao DESC);
CREATE INDEX idx_api_logs_key ON public.api_logs(api_key_id);

GRANT SELECT, INSERT ON public.api_logs TO authenticated;
GRANT ALL ON public.api_logs TO service_role;

ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can read api_logs" ON public.api_logs
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));
