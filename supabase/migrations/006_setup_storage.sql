-- Create storage bucket for resources
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources',
  'resources',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for resources bucket
-- Allow authenticated users to insert files
CREATE POLICY "Authenticated users can upload resources"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resources');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read resources"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resources');

-- Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete resources"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'resources');

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update resources"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'resources');
