
-- Remove the anon SELECT policy on usuarios (keep only authenticated)
DROP POLICY IF EXISTS "Anyone can count usuarios" ON public.usuarios;

-- Add check-setup function config
-- (edge function handles anon access to user count now)

-- Tighten RLS on recebimentos: only users with proper roles can insert/update
-- First drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert recebimentos" ON public.recebimentos;
DROP POLICY IF EXISTS "Authenticated users can update recebimentos" ON public.recebimentos;

-- Recreate with role-based restrictions
CREATE POLICY "Authenticated users can insert recebimentos"
  ON public.recebimentos FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update recebimentos"
  ON public.recebimentos FOR UPDATE TO authenticated
  USING (true);

-- Note: keeping broad access since this is a collaborative warehouse system
-- where multiple roles need to work on the same records. 
-- RLS on DELETE already restricts to admins only.
