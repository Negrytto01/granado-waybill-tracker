
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS observacoes text DEFAULT NULL;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS nfd_numero text DEFAULT NULL;
ALTER TABLE public.recebimentos ADD COLUMN IF NOT EXISTS is_pallet boolean NOT NULL DEFAULT false;
