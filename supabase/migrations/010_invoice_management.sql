-- Invoice Management Migration
-- Adds cohort_id to invoices table and sets up invoice storage bucket

-- Add cohort_id column to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;

-- Add updated_at column to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for faster cohort-based queries
CREATE INDEX IF NOT EXISTS idx_invoices_cohort ON invoices(cohort_id);

-- Create trigger function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS update_invoices_updated_at_trigger ON invoices;
CREATE TRIGGER update_invoices_updated_at_trigger
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

-- Create storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760, -- 10MB max for PDFs
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoices bucket

-- Allow admins and company_users to upload invoices
CREATE POLICY "Admins can upload invoices"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'invoices' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Allow users to view their own invoices, and admins to view all
CREATE POLICY "Users can view their invoices"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoices' AND (
      -- Admin/company_user can view all
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'company_user')
      ) OR
      -- Users can view invoices in their folder (path includes user_id)
      EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.pdf_path = name
          AND invoices.user_id = auth.uid()
      )
    )
  );

-- Allow admins to delete invoices
CREATE POLICY "Admins can delete invoices"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'invoices' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Allow admins to update/replace invoices
CREATE POLICY "Admins can update invoices"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'invoices' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );
