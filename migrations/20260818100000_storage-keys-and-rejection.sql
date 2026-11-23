-- Persist storage object keys alongside public URLs (AGENTS.md convention).
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_key text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cover_key text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS document_keys jsonb;

-- Company verification lifecycle: rejected state + reason.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS rejected_by uuid;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS rejection_reason text;