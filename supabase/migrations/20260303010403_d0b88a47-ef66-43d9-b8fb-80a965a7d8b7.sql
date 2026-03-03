
-- Delete old cargo_permissoes for Recebimento, Conferente, Compras (replaced by new cargos)
DELETE FROM public.cargo_permissoes WHERE cargo IN ('Recebimento', 'Conferente', 'Compras');

-- Ensure new cargos have entries - insert if not exists
INSERT INTO public.cargo_permissoes (cargo, pagina, ativo) VALUES
  ('Agendamento/Conferente', 'dashboard', true),
  ('Agendamento/Conferente', 'agenda', true),
  ('Agendamento/Conferente', 'calendario', true),
  ('Agendamento/Conferente', 'descarga', true),
  ('Agendamento/Conferente', 'armazenagem', false),
  ('Agendamento/Conferente', 'relatorios', true),
  ('Agendamento/Conferente', 'historico', true),
  ('Agendamento/Conferente', 'compras', false),
  ('Agendamento/Conferente', 'fornecedores', true),
  ('Agendamento/Conferente', 'valores', false),
  ('Agendamento/Conferente', 'financeiro', false),
  ('Agendamento/Conferente', 'usuarios', false),
  ('Compra', 'dashboard', true),
  ('Compra', 'agenda', true),
  ('Compra', 'calendario', true),
  ('Compra', 'descarga', false),
  ('Compra', 'armazenagem', false),
  ('Compra', 'relatorios', false),
  ('Compra', 'historico', false),
  ('Compra', 'compras', true),
  ('Compra', 'fornecedores', false),
  ('Compra', 'valores', false),
  ('Compra', 'financeiro', false),
  ('Compra', 'usuarios', false)
ON CONFLICT (cargo, pagina) DO NOTHING;

-- Make sure Estoque, Faturamento, Financeiro, Fiscal have full permission entries
INSERT INTO public.cargo_permissoes (cargo, pagina, ativo)
SELECT c.cargo, p.pagina, false
FROM (VALUES ('Estoque'), ('Faturamento'), ('Financeiro'), ('Fiscal')) AS c(cargo)
CROSS JOIN (VALUES ('dashboard'), ('agenda'), ('calendario'), ('descarga'), ('armazenagem'), ('relatorios'), ('historico'), ('compras'), ('fornecedores'), ('valores'), ('financeiro'), ('usuarios')) AS p(pagina)
ON CONFLICT (cargo, pagina) DO NOTHING;

-- Set default permissions for each cargo
UPDATE public.cargo_permissoes SET ativo = true WHERE cargo = 'Estoque' AND pagina IN ('dashboard', 'armazenagem', 'historico', 'relatorios');
UPDATE public.cargo_permissoes SET ativo = true WHERE cargo = 'Faturamento' AND pagina IN ('dashboard', 'historico', 'relatorios');
UPDATE public.cargo_permissoes SET ativo = true WHERE cargo = 'Financeiro' AND pagina IN ('dashboard', 'financeiro', 'historico', 'relatorios');
UPDATE public.cargo_permissoes SET ativo = true WHERE cargo = 'Fiscal' AND pagina IN ('dashboard', 'historico', 'relatorios', 'descarga');
