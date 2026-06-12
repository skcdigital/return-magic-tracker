-- Add image URL columns to return_entries table
ALTER TABLE public.return_entries
ADD COLUMN grs_rfc_grn_image_url text,
ADD COLUMN supplier_credit_image_url text;

-- Create storage bucket for return documents
-- Note: This will be created via Supabase dashboard/CLI
-- CREATE POLICY to allow authenticated users to upload and read images
