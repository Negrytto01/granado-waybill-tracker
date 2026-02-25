
-- Enable realtime for main tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.recebimentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.armazenagem;
ALTER PUBLICATION supabase_realtime ADD TABLE public.etiquetas_pallet;
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios;
