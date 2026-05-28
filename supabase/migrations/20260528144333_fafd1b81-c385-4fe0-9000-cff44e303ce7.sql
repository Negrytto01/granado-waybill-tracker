-- Tabela principal de integrações
CREATE TABLE public.integracoes_externas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('totvs', 'sap', 'bling', 'generico')),
  base_url TEXT NOT NULL,
  auth_tipo TEXT NOT NULL CHECK (auth_tipo IN ('oauth2', 'basic', 'bearer', 'cookie', 'apikey_header')),
  auth_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  endpoints JSONB NOT NULL DEFAULT '{}'::jsonb,
  headers_extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_uso TIMESTAMPTZ,
  total_chamadas BIGINT NOT NULL DEFAULT 0,
  webhook_secret TEXT,
  criado_por TEXT,
  criado_por_user_id UUID,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integracoes_externas TO authenticated;
GRANT ALL ON public.integracoes_externas TO service_role;

ALTER TABLE public.integracoes_externas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can read integracoes" ON public.integracoes_externas FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Master can insert integracoes" ON public.integracoes_externas FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Master can update integracoes" ON public.integracoes_externas FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Master can delete integracoes" ON public.integracoes_externas FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Logs de sincronização
CREATE TABLE public.integracoes_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integracao_id UUID,
  integracao_nome TEXT,
  operacao TEXT NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('inbound', 'outbound')),
  status_code INTEGER,
  sucesso BOOLEAN NOT NULL DEFAULT false,
  payload_req JSONB,
  payload_resp JSONB,
  erro TEXT,
  duracao_ms INTEGER,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integracoes_sync_logs TO authenticated;
GRANT ALL ON public.integracoes_sync_logs TO service_role;

ALTER TABLE public.integracoes_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can read sync_logs" ON public.integracoes_sync_logs FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE INDEX idx_sync_logs_integracao ON public.integracoes_sync_logs(integracao_id, data_criacao DESC);
CREATE INDEX idx_integracoes_ativo ON public.integracoes_externas(ativo) WHERE ativo = true;