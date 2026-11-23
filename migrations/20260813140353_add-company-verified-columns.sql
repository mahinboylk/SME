-- NOTE: verified_at / verified_by already exist on companies; this is idempotent.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS verified_by uuid;
