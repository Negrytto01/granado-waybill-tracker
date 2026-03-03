
-- Add new cargo values to enum
ALTER TYPE public.cargo_tipo ADD VALUE IF NOT EXISTS 'Master';
ALTER TYPE public.cargo_tipo ADD VALUE IF NOT EXISTS 'Agendamento/Conferente';
ALTER TYPE public.cargo_tipo ADD VALUE IF NOT EXISTS 'Compra';
