
-- 1. Add new cargo types: Compras, Financeiro, Faturamento
ALTER TYPE public.cargo_tipo ADD VALUE IF NOT EXISTS 'Compras';
ALTER TYPE public.cargo_tipo ADD VALUE IF NOT EXISTS 'Financeiro';
ALTER TYPE public.cargo_tipo ADD VALUE IF NOT EXISTS 'Faturamento';

-- 2. Add new columns to recebimentos for acoplagem/desacoplagem/valor workflow
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS hora_acoplagem timestamp with time zone;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS hora_desacoplagem timestamp with time zone;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS caixas_batidas integer DEFAULT 0;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS pallets_descarregados integer DEFAULT 0;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS valor_cobrado numeric(10,2) DEFAULT 0;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS horario_agenda time;

-- 3. Add new recebimento statuses for acoplagem/desacoplagem
ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'ACOPLADO';
ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'DESACOPLADO';

-- 4. Create permissions table for role-based page access
CREATE TABLE public.cargo_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo text NOT NULL,
  pagina text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  data_criacao timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(cargo, pagina)
);
ALTER TABLE public.cargo_permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cargo_permissoes"
  ON public.cargo_permissoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert cargo_permissoes"
  ON public.cargo_permissoes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update cargo_permissoes"
  ON public.cargo_permissoes FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete cargo_permissoes"
  ON public.cargo_permissoes FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 5. Create valores_descarga table (admin pricing config)
CREATE TABLE public.valores_descarga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor_por_caixa numeric(10,2) NOT NULL DEFAULT 0,
  valor_por_pallet numeric(10,2) NOT NULL DEFAULT 0,
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_por text
);
ALTER TABLE public.valores_descarga ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read valores_descarga"
  ON public.valores_descarga FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert valores_descarga"
  ON public.valores_descarga FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update valores_descarga"
  ON public.valores_descarga FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6. Create fornecedores_urgencia table
CREATE TABLE public.fornecedores_urgencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_fornecedor text NOT NULL,
  contagem_urgencias integer NOT NULL DEFAULT 1,
  ultima_urgencia timestamp with time zone NOT NULL DEFAULT now(),
  observacoes text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores_urgencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fornecedores_urgencia"
  ON public.fornecedores_urgencia FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert fornecedores_urgencia"
  ON public.fornecedores_urgencia FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update fornecedores_urgencia"
  ON public.fornecedores_urgencia FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete fornecedores_urgencia"
  ON public.fornecedores_urgencia FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. Create fluxo_financeiro table (monthly financial flow)
CREATE TABLE public.fluxo_financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  mes_referencia date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE),
  recebimento_id uuid REFERENCES public.recebimentos(id),
  criado_por text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.fluxo_financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin and Financeiro can read fluxo_financeiro"
  ON public.fluxo_financeiro FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert fluxo_financeiro"
  ON public.fluxo_financeiro FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update fluxo_financeiro"
  ON public.fluxo_financeiro FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete fluxo_financeiro"
  ON public.fluxo_financeiro FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 8. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.cargo_permissoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.valores_descarga;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fornecedores_urgencia;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fluxo_financeiro;

-- 9. Insert default permissions for each cargo
INSERT INTO public.cargo_permissoes (cargo, pagina, ativo) VALUES
  ('Administrador', 'dashboard', true),
  ('Administrador', 'agenda', true),
  ('Administrador', 'descarga', true),
  ('Administrador', 'armazenagem', true),
  ('Administrador', 'relatorios', true),
  ('Administrador', 'historico', true),
  ('Administrador', 'usuarios', true),
  ('Administrador', 'valores', true),
  ('Administrador', 'compras', true),
  ('Administrador', 'fornecedores', true),
  ('Administrador', 'financeiro', true),
  ('Recebimento', 'dashboard', true),
  ('Recebimento', 'armazenagem', true),
  ('Recebimento', 'relatorios', true),
  ('Recebimento', 'historico', true),
  ('Conferente', 'dashboard', true),
  ('Conferente', 'agenda', true),
  ('Conferente', 'descarga', true),
  ('Conferente', 'relatorios', true),
  ('Conferente', 'historico', true),
  ('Estoque', 'dashboard', true),
  ('Estoque', 'armazenagem', true),
  ('Estoque', 'relatorios', true),
  ('Estoque', 'historico', true),
  ('Fiscal', 'dashboard', true),
  ('Fiscal', 'agenda', true),
  ('Fiscal', 'relatorios', true),
  ('Fiscal', 'historico', true),
  ('Compras', 'dashboard', true),
  ('Compras', 'agenda', true),
  ('Compras', 'historico', true),
  ('Financeiro', 'dashboard', true),
  ('Financeiro', 'financeiro', true),
  ('Financeiro', 'relatorios', true),
  ('Financeiro', 'historico', true),
  ('Faturamento', 'dashboard', true),
  ('Faturamento', 'agenda', true),
  ('Faturamento', 'relatorios', true),
  ('Faturamento', 'historico', true);

-- 10. Add admin delete policy for recebimentos
CREATE POLICY "Admins can delete recebimentos"
  ON public.recebimentos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 11. Add admin delete policy for armazenagem
CREATE POLICY "Admins can delete armazenagem"
  ON public.armazenagem FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
