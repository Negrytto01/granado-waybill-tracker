
-- 1. etiquetas_pallet: add UPDATE/DELETE policies
CREATE POLICY "Authenticated users can update etiquetas"
  ON public.etiquetas_pallet FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete etiquetas"
  ON public.etiquetas_pallet FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- 2. atividades_usuarios: tighten INSERT to prevent log spoofing
DROP POLICY IF EXISTS "Authenticated users can insert atividades" ON public.atividades_usuarios;
CREATE POLICY "Users can insert own activity"
  ON public.atividades_usuarios FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. usuarios INSERT: prevent self-assigning the Master role (privilege escalation)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.usuarios;
CREATE POLICY "Users can self-insert non-master profile"
  ON public.usuarios FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND cargo <> 'Master'::cargo_tipo);

-- 4. Helper to check if a user has financial access (Master, Financeiro, Faturamento)
CREATE OR REPLACE FUNCTION public.has_financial_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE user_id = _user_id
      AND cargo IN ('Master'::cargo_tipo, 'Financeiro'::cargo_tipo, 'Faturamento'::cargo_tipo)
  )
$$;

-- 5. fluxo_financeiro: restrict SELECT to financial roles
DROP POLICY IF EXISTS "Admin and Financeiro can read fluxo_financeiro" ON public.fluxo_financeiro;
CREATE POLICY "Financial roles can read fluxo_financeiro"
  ON public.fluxo_financeiro FOR SELECT TO authenticated
  USING (public.has_financial_access(auth.uid()));

-- 6. mensagens_globais: guard against non-sender tampering of message content
DROP POLICY IF EXISTS "Authenticated users can update mensagens" ON public.mensagens_globais;
CREATE POLICY "Authenticated users can update mensagens"
  ON public.mensagens_globais FOR UPDATE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.mensagens_globais_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Sender (or service role) may modify anything
  IF auth.uid() IS NULL OR auth.uid() = OLD.enviado_por_user_id THEN
    RETURN NEW;
  END IF;
  -- Non-senders may only modify lida_por (read receipts)
  IF NEW.mensagem        IS DISTINCT FROM OLD.mensagem
  OR NEW.destinatarios   IS DISTINCT FROM OLD.destinatarios
  OR NEW.enviado_por     IS DISTINCT FROM OLD.enviado_por
  OR NEW.enviado_por_user_id IS DISTINCT FROM OLD.enviado_por_user_id
  OR NEW.data_criacao    IS DISTINCT FROM OLD.data_criacao THEN
    RAISE EXCEPTION 'Only the sender can modify message content';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS mensagens_globais_guard_trg ON public.mensagens_globais;
CREATE TRIGGER mensagens_globais_guard_trg
  BEFORE UPDATE ON public.mensagens_globais
  FOR EACH ROW EXECUTE FUNCTION public.mensagens_globais_guard();
