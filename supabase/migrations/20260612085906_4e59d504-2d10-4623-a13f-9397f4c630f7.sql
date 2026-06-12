CREATE TABLE public.return_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_type text NOT NULL CHECK (ref_type IN ('RFC', 'GRS', 'GRN')),
  ref_number text NOT NULL,
  job_number text,
  serial_number text,
  store_name text,
  product_type text NOT NULL DEFAULT 'laptop' CHECK (product_type IN ('laptop', 'printer')),
  bundle text NOT NULL DEFAULT 'no' CHECK (bundle IN ('yes', 'partial', 'no')),
  unit_location text,
  date text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'started', 'pending')),
  credit_status text NOT NULL DEFAULT 'unit_on_hand' CHECK (credit_status IN ('supplier_credit', 'unit_on_hand')),
  credit_note_number text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_entries TO authenticated;
GRANT ALL ON public.return_entries TO service_role;

ALTER TABLE public.return_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon full access" ON public.return_entries FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access" ON public.return_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);