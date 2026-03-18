
-- Add new cargo type 'Portaria'
ALTER TYPE public.cargo_tipo ADD VALUE IF NOT EXISTS 'Portaria';

-- Add new recebimento status 'NAO_VEIO'
ALTER TYPE public.recebimento_status ADD VALUE IF NOT EXISTS 'NAO_VEIO';

-- Vehicles table
CREATE TABLE public.veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  placa text NOT NULL,
  modelo text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read veiculos" ON public.veiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert veiculos" ON public.veiculos FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update veiculos" ON public.veiculos FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete veiculos" ON public.veiculos FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Motoristas table (for portaria)
CREATE TABLE public.motoristas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.motoristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read motoristas" ON public.motoristas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert motoristas" ON public.motoristas FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update motoristas" ON public.motoristas FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete motoristas" ON public.motoristas FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Portaria registros (arrival logs)
CREATE TABLE public.portaria_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  motorista_id uuid REFERENCES public.motoristas(id) ON DELETE SET NULL,
  veiculo_nome text,
  veiculo_placa text,
  motorista_nome text,
  km_chegada text,
  tem_problema boolean NOT NULL DEFAULT false,
  observacoes_problema text,
  registrado_por text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.portaria_registros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read portaria" ON public.portaria_registros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert portaria" ON public.portaria_registros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete portaria" ON public.portaria_registros FOR DELETE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can update portaria" ON public.portaria_registros FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- User activity tracking (admin only)
CREATE TABLE public.atividades_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usuario_nome text NOT NULL,
  acao text NOT NULL,
  detalhes text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.atividades_usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read atividades" ON public.atividades_usuarios FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Authenticated users can insert atividades" ON public.atividades_usuarios FOR INSERT TO authenticated WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.atividades_usuarios;

-- Fornecedores that didn't show up + fines
CREATE TABLE public.fornecedores_nao_vieram (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id uuid REFERENCES public.recebimentos(id) ON DELETE CASCADE,
  fornecedor text NOT NULL,
  motivo text NOT NULL DEFAULT 'Não veio',
  observacoes text,
  usuario text,
  multa numeric NOT NULL DEFAULT 0,
  avisou_antecedencia boolean NOT NULL DEFAULT false,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores_nao_vieram ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read nao_vieram" ON public.fornecedores_nao_vieram FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert nao_vieram" ON public.fornecedores_nao_vieram FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update nao_vieram" ON public.fornecedores_nao_vieram FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete nao_vieram" ON public.fornecedores_nao_vieram FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Valor da multa config  
ALTER TABLE public.valores_descarga ADD COLUMN IF NOT EXISTS valor_multa numeric NOT NULL DEFAULT 0;

-- Ocorrências de armazenagem
CREATE TABLE public.ocorrencias_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.ocorrencias_tipos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read ocorrencias_tipos" ON public.ocorrencias_tipos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert ocorrencias_tipos" ON public.ocorrencias_tipos FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete ocorrencias_tipos" ON public.ocorrencias_tipos FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Insert default occurrence types
INSERT INTO public.ocorrencias_tipos (nome) VALUES ('Reposição'), ('Organização') ON CONFLICT DO NOTHING;

CREATE TABLE public.ocorrencias_armazenagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor text NOT NULL,
  ocorrencia text NOT NULL,
  registrado_por text,
  data_criacao timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.ocorrencias_armazenagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read ocorrencias" ON public.ocorrencias_armazenagem FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ocorrencias" ON public.ocorrencias_armazenagem FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete ocorrencias" ON public.ocorrencias_armazenagem FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Relatórios mensais snapshot
CREATE TABLE public.relatorios_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia date NOT NULL,
  fornecedor text NOT NULL,
  total_volumes integer NOT NULL DEFAULT 0,
  total_descargas integer NOT NULL DEFAULT 0,
  data_criacao timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(mes_referencia, fornecedor)
);
ALTER TABLE public.relatorios_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read relatorios" ON public.relatorios_mensais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert relatorios" ON public.relatorios_mensais FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update relatorios" ON public.relatorios_mensais FOR UPDATE TO authenticated USING (true);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.veiculos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.motoristas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portaria_registros;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fornecedores_nao_vieram;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ocorrencias_armazenagem;
