-- ========================================
-- STORAGE BUCKET SETUP FOR RESOURCES
-- Run this in Supabase Dashboard > SQL Editor
-- ========================================

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources',
  'resources',
  false, -- Not public, requires authentication
  52428800, -- 50MB file size limit
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
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ];

-- Step 2: Create storage policies
-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload resources" ON storage.objects;
CREATE POLICY "Authenticated users can upload resources"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resources');

-- Allow authenticated users to read files
DROP POLICY IF EXISTS "Authenticated users can read resources" ON storage.objects;
CREATE POLICY "Authenticated users can read resources"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'resources');

-- Allow authenticated users to delete files
DROP POLICY IF EXISTS "Authenticated users can delete resources" ON storage.objects;
CREATE POLICY "Authenticated users can delete resources"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'resources');

-- Allow authenticated users to update files
DROP POLICY IF EXISTS "Authenticated users can update resources" ON storage.objects;
CREATE POLICY "Authenticated users can update resources"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'resources');

-- Verify setup
SELECT
  'Storage bucket created successfully!' as message,
  id,
  name,
  public,
  file_size_limit,
  array_length(allowed_mime_types, 1) as allowed_types_count
FROM storage.buckets
WHERE id = 'resources';
