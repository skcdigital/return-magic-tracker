-- ─────────────────────────────────────────────────────────────────
-- Ensure all application columns exist (idempotent - safe to re-run)
-- These columns are required for saves to work. Apply via:
--   Supabase Dashboard → SQL Editor → paste and run
--   OR: supabase db push
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.return_entries
  ADD COLUMN IF NOT EXISTS grs_rfc_grn_image_url      text DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_credit_image_url   text DEFAULT '',
  ADD COLUMN IF NOT EXISTS requested_credit_amount     text DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_credit_amount      text DEFAULT '';
