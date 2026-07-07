
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE user_id = _user_id
      AND cargo = 'Master'
      AND ativo = true
  )
$function$;

CREATE OR REPLACE FUNCTION public.has_financial_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE user_id = _user_id
      AND cargo IN ('Master'::cargo_tipo, 'Financeiro'::cargo_tipo, 'Faturamento'::cargo_tipo)
      AND ativo = true
  )
$function$;
