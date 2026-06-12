-- Update product_type constraint to include RMA
ALTER TABLE public.return_entries
DROP CONSTRAINT return_entries_product_type_check;

ALTER TABLE public.return_entries
ADD CONSTRAINT return_entries_product_type_check 
CHECK (product_type IN ('laptop', 'printer', 'rma'));

-- Update bundle constraint to include standalone_laptop and none
ALTER TABLE public.return_entries
DROP CONSTRAINT return_entries_bundle_check;

ALTER TABLE public.return_entries
ADD CONSTRAINT return_entries_bundle_check 
CHECK (bundle IN ('yes', 'partial', 'no', 'standalone_laptop', 'none'));

-- Also update status constraint to include 'missing' if it's missing
ALTER TABLE public.return_entries
DROP CONSTRAINT return_entries_status_check;

ALTER TABLE public.return_entries
ADD CONSTRAINT return_entries_status_check 
CHECK (status IN ('completed', 'started', 'pending', 'missing'));
