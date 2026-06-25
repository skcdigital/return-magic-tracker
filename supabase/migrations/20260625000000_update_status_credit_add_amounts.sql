-- ─────────────────────────────────────────────────────────────────
-- Migration: Update status/credit constraints, add credit amount cols
-- ─────────────────────────────────────────────────────────────────

-- 1. Drop old check constraints
ALTER TABLE return_entries DROP CONSTRAINT IF EXISTS return_entries_status_check;
ALTER TABLE return_entries DROP CONSTRAINT IF EXISTS return_entries_credit_status_check;

-- 2. Add new status constraint (includes incomplete, in_progress, credit_processed)
ALTER TABLE return_entries
  ADD CONSTRAINT return_entries_status_check
    CHECK (status IN ('completed','started','pending','missing','incomplete','in_progress','credit_processed'));

-- 3. Add new credit_status constraint (includes no_physical_unit)
ALTER TABLE return_entries
  ADD CONSTRAINT return_entries_credit_status_check
    CHECK (credit_status IN ('supplier_credit','unit_on_hand','no_physical_unit'));

-- 4. Add credit amount columns (stored as text to support any currency format)
ALTER TABLE return_entries
  ADD COLUMN IF NOT EXISTS requested_credit_amount text DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier_credit_amount  text DEFAULT '';
