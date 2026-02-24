
-- Create enum for user roles
CREATE TYPE public.cargo_tipo AS ENUM ('Administrador', 'Recebimento', 'Conferente', 'Estoque', 'Fiscal');

-- Create enum for recebimento status
CREATE TYPE public.recebimento_status AS ENUM ('AGENDADO', 'CHEGOU', 'EM DESCARGA', 'DESCARGA FINALIZADA', 'AGUARDANDO ARMAZENAGEM', 'FINALIZADO');

-- Create enum for armazenagem status
CREATE TYPE public.armazenagem_status AS ENUM ('AGUARDANDO ARMAZENAGEM', 'EM ARMAZENAGEM', 'FINALIZADO');

-- Usuarios table
CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cargo cargo_tipo NOT NULL DEFAULT 'Recebimento',
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read usuarios
CREATE POLICY "Authenticated users can read usuarios"
  ON public.usuarios FOR SELECT TO authenticated
  USING (true);

-- Users can read their own profile
CREATE POLICY "Users can insert own profile"
  ON public.usuarios FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin check function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE user_id = _user_id AND cargo = 'Administrador'
  )
$$;

-- Only admins can update usuarios
CREATE POLICY "Admins can update usuarios"
  ON public.usuarios FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Only admins can delete usuarios
CREATE POLICY "Admins can delete usuarios"
  ON public.usuarios FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Recebimentos table
CREATE TABLE public.recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nf TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  cnpj TEXT,
  transportadora TEXT,
  placa TEXT,
  motorista TEXT,
  quantidade_itens INTEGER DEFAULT 0,
  quantidade_volumes INTEGER DEFAULT 0,
  data_prevista DATE DEFAULT CURRENT_DATE,
  hora_chegada TIMESTAMPTZ,
  hora_inicio_descarga TIMESTAMPTZ,
  hora_fim_descarga TIMESTAMPTZ,
  status recebimento_status NOT NULL DEFAULT 'AGENDADO',
  xml_nota TEXT,
  usuario_responsavel TEXT,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read recebimentos"
  ON public.recebimentos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert recebimentos"
  ON public.recebimentos FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update recebimentos"
  ON public.recebimentos FOR UPDATE TO authenticated
  USING (true);

-- Armazenagem table
CREATE TABLE public.armazenagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id UUID REFERENCES public.recebimentos(id) ON DELETE CASCADE NOT NULL,
  quantidade_itens INTEGER DEFAULT 0,
  quantidade_volumes INTEGER DEFAULT 0,
  status armazenagem_status NOT NULL DEFAULT 'AGUARDANDO ARMAZENAGEM',
  usuario_responsavel TEXT,
  hora_inicio TIMESTAMPTZ,
  hora_fim TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.armazenagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read armazenagem"
  ON public.armazenagem FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert armazenagem"
  ON public.armazenagem FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update armazenagem"
  ON public.armazenagem FOR UPDATE TO authenticated
  USING (true);

-- Etiquetas pallet table
CREATE TABLE public.etiquetas_pallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  validade DATE,
  quantidade_caixa INTEGER NOT NULL DEFAULT 0,
  peso TEXT,
  usuario TEXT NOT NULL,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.etiquetas_pallet ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read etiquetas"
  ON public.etiquetas_pallet FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert etiquetas"
  ON public.etiquetas_pallet FOR INSERT TO authenticated
  WITH CHECK (true);
