
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS is_marketing boolean NOT NULL DEFAULT false;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS is_encaixe boolean NOT NULL DEFAULT false;
