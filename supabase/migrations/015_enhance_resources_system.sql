-- Migration: Enhanced Resources System with Categories and Global Library
-- Purpose: Add category-based organization and global library support
-- Date: 2026-02-05
-- Feature: Resources Rework

-- ============================================================================
-- 1. Add New Columns to Resources Table
-- ============================================================================

-- Add external_url column if it doesn't exist (for video/article links)
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Add category column for resource classification
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS category TEXT
CHECK (category IN ('video', 'article', 'presentation', 'pdf'));

-- Add is_global flag for global library resources
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN resources.category IS 'Resource type: video (links), article (links), presentation (files), pdf (files)';
COMMENT ON COLUMN resources.is_global IS 'When true, resource is visible to all students regardless of cohort (overrides cohort-specific filtering)';
COMMENT ON COLUMN resources.external_url IS 'URL for video links (YouTube, Drive, etc) or article links';


-- ============================================================================
-- 2. Migrate Existing Data
-- ============================================================================

-- Migrate existing resources based on file_type and type
UPDATE resources
SET category = CASE
  -- Video files
  WHEN file_type IN ('mp4', 'mov', 'avi', 'webm', 'mkv') THEN 'video'

  -- PDF files
  WHEN file_type IN ('pdf') THEN 'pdf'

  -- Presentation files
  WHEN file_type IN ('ppt', 'pptx', 'pptm', 'key') THEN 'presentation'

  -- Document files (treat as PDF category for simplicity)
  WHEN file_type IN ('doc', 'docx', 'docm', 'txt', 'rtf') THEN 'pdf'

  -- Links without file_type default to article
  WHEN type = 'link' AND file_type IS NULL THEN 'article'

  -- Folders are kept as is (no category needed)
  WHEN type = 'folder' THEN NULL

  -- Default fallback for unknown types
  ELSE 'article'
END
WHERE category IS NULL;

-- Ensure all non-folder resources have a category
UPDATE resources
SET category = 'article'
WHERE category IS NULL
  AND type != 'folder';

-- Set all existing resources as non-global (cohort-specific by default)
UPDATE resources
SET is_global = false
WHERE is_global IS NULL;


-- ============================================================================
-- 3. Add Constraints
-- ============================================================================

-- Make category required for non-folder resources
ALTER TABLE resources
ADD CONSTRAINT check_category_required
CHECK (
  (type = 'folder' AND category IS NULL) OR
  (type != 'folder' AND category IS NOT NULL)
);

-- Ensure global resources are not tied to a specific cohort
ALTER TABLE resources
ADD CONSTRAINT check_global_cohort
CHECK (
  (is_global = true AND cohort_id IS NULL) OR
  (is_global = false)
);

-- Make is_global NOT NULL going forward
ALTER TABLE resources
ALTER COLUMN is_global SET DEFAULT false,
ALTER COLUMN is_global SET NOT NULL;


-- ============================================================================
-- 4. Add Indexes for Performance
-- ============================================================================

-- Index for category filtering (will be used heavily in queries)
CREATE INDEX IF NOT EXISTS idx_resources_category
ON resources(category)
WHERE category IS NOT NULL;

-- Index for global library queries
CREATE INDEX IF NOT EXISTS idx_resources_global
ON resources(is_global)
WHERE is_global = true;

-- Composite index for category + global filtering
CREATE INDEX IF NOT EXISTS idx_resources_category_global
ON resources(category, is_global)
WHERE category IS NOT NULL;

-- Index for cohort-specific queries (improve existing query performance)
CREATE INDEX IF NOT EXISTS idx_resources_cohort_category
ON resources(cohort_id, category)
WHERE cohort_id IS NOT NULL AND category IS NOT NULL;


-- ============================================================================
-- 5. Update Storage Bucket File Size Limit (50MB → 100MB)
-- ============================================================================

-- Update resources bucket to allow 100MB files
UPDATE storage.buckets
SET file_size_limit = 104857600  -- 100MB in bytes
WHERE id = 'resources';

-- Add PowerPoint MIME types if not already present
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm'
]
WHERE id = 'resources';


-- ============================================================================
-- 6. Update RLS Policies (if needed)
-- ============================================================================

-- Resources table should already have RLS policies
-- We just need to ensure global resources are visible to all authenticated users

-- Drop existing overly restrictive policies if they exist
DROP POLICY IF EXISTS "Students see only their cohort resources" ON resources;

-- Create new policy: Users see global resources
CREATE POLICY "Users see global resources" ON resources
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND is_global = true
  );

-- Create new policy: Users see their cohort-specific resources
CREATE POLICY "Users see cohort resources" ON resources
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    is_global = false AND
    cohort_id IN (
      SELECT cohort_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Admin policy should already exist, but recreate to be sure
DROP POLICY IF EXISTS "Admins manage all resources" ON resources;

CREATE POLICY "Admins manage all resources" ON resources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'company_user')
    )
  );


-- ============================================================================
-- 7. Verification Queries
-- ============================================================================

-- Verify category column exists and has data
DO $$
DECLARE
  col_count INT;
  data_count INT;
BEGIN
  -- Check column exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'resources'
    AND column_name = 'category';

  IF col_count = 0 THEN
    RAISE EXCEPTION 'FAILED: category column not added to resources table';
  END IF;

  -- Check data migration worked
  SELECT COUNT(*) INTO data_count
  FROM resources
  WHERE type != 'folder'
    AND category IS NULL;

  IF data_count > 0 THEN
    RAISE WARNING 'WARNING: % non-folder resources still have NULL category', data_count;
  ELSE
    RAISE NOTICE 'SUCCESS: All resources have categories assigned';
  END IF;
END $$;

-- Verify is_global column
DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'resources'
    AND column_name = 'is_global';

  IF col_count = 0 THEN
    RAISE EXCEPTION 'FAILED: is_global column not added';
  ELSE
    RAISE NOTICE 'SUCCESS: is_global column added to resources table';
  END IF;
END $$;

-- Verify indexes created
DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'resources'
    AND indexname LIKE 'idx_resources_%';

  RAISE NOTICE 'INFO: % indexes created for resources table', idx_count;
END $$;

-- Verify storage bucket updated
DO $$
DECLARE
  size_limit BIGINT;
BEGIN
  SELECT file_size_limit INTO size_limit
  FROM storage.buckets
  WHERE id = 'resources';

  IF size_limit = 104857600 THEN
    RAISE NOTICE 'SUCCESS: Storage bucket limit updated to 100MB';
  ELSE
    RAISE WARNING 'WARNING: Storage bucket limit is % bytes (expected 104857600)', size_limit;
  END IF;
END $$;

-- Show migration summary
DO $$
DECLARE
  total_resources INT;
  video_count INT;
  article_count INT;
  pdf_count INT;
  presentation_count INT;
  global_count INT;
BEGIN
  SELECT COUNT(*) INTO total_resources FROM resources WHERE type != 'folder';
  SELECT COUNT(*) INTO video_count FROM resources WHERE category = 'video';
  SELECT COUNT(*) INTO article_count FROM resources WHERE category = 'article';
  SELECT COUNT(*) INTO pdf_count FROM resources WHERE category = 'pdf';
  SELECT COUNT(*) INTO presentation_count FROM resources WHERE category = 'presentation';
  SELECT COUNT(*) INTO global_count FROM resources WHERE is_global = true;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total resources: %', total_resources;
  RAISE NOTICE 'Videos: %', video_count;
  RAISE NOTICE 'Articles: %', article_count;
  RAISE NOTICE 'PDFs: %', pdf_count;
  RAISE NOTICE 'Presentations: %', presentation_count;
  RAISE NOTICE 'Global resources: %', global_count;
  RAISE NOTICE '========================================';
END $$;
