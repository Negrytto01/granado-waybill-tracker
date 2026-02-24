
-- Allow anonymous to count usuarios for first-time setup check
CREATE POLICY "Anyone can count usuarios"
  ON public.usuarios FOR SELECT TO anon
  USING (true);
