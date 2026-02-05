-- Migration: Add File Storage Columns to Module Resources
-- Purpose: Support PDF and document uploads to Supabase Storage for module_resources
-- Date: 2026-02-05
-- Feature: YouTube + PDF Upload Implementation

-- ============================================================================
-- 1. Add File Storage Columns
-- ============================================================================

-- Add file_path column for Supabase Storage path
ALTER TABLE module_resources
ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Add file_type column for file extension
ALTER TABLE module_resources
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Add file_size column for file size in bytes
ALTER TABLE module_resources
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- ============================================================================
-- 2. Add Documentation Comments
-- ============================================================================

COMMENT ON COLUMN module_resources.file_path IS 'Path to file in Supabase Storage (e.g., "cohort-5/week-1/slides.pdf")';
COMMENT ON COLUMN module_resources.file_type IS 'File type extension (e.g., "pdf", "docx")';
COMMENT ON COLUMN module_resources.file_size IS 'File size in bytes';

-- ============================================================================
-- 3. Add Performance Index
-- ============================================================================

-- Index for file_path lookups (used for signed URL generation)
CREATE INDEX IF NOT EXISTS idx_module_resources_file_path
ON module_resources(file_path)
WHERE file_path IS NOT NULL;

-- ============================================================================
-- 4. Verification
-- ============================================================================

DO $$
DECLARE
  col_count INT;
BEGIN
  -- Verify file_path column exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'module_resources'
    AND column_name = 'file_path';

  IF col_count = 0 THEN
    RAISE EXCEPTION 'FAILED: file_path column not added to module_resources table';
  END IF;

  -- Verify file_type column exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'module_resources'
    AND column_name = 'file_type';

  IF col_count = 0 THEN
    RAISE EXCEPTION 'FAILED: file_type column not added to module_resources table';
  END IF;

  -- Verify file_size column exists
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'module_resources'
    AND column_name = 'file_size';

  IF col_count = 0 THEN
    RAISE EXCEPTION 'FAILED: file_size column not added to module_resources table';
  END IF;

  RAISE NOTICE 'SUCCESS: All file storage columns added to module_resources table';
END $$;

-- Verify index created
DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'module_resources'
    AND indexname = 'idx_module_resources_file_path';

  IF idx_count > 0 THEN
    RAISE NOTICE 'SUCCESS: idx_module_resources_file_path index created';
  ELSE
    RAISE WARNING 'WARNING: idx_module_resources_file_path index not found';
  END IF;
END $$;

-- Show migration summary
DO $$
DECLARE
  total_resources INT;
  with_file_path INT;
BEGIN
  SELECT COUNT(*) INTO total_resources FROM module_resources;
  SELECT COUNT(*) INTO with_file_path FROM module_resources WHERE file_path IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total module_resources: %', total_resources;
  RAISE NOTICE 'With file_path: %', with_file_path;
  RAISE NOTICE 'Columns added: file_path, file_type, file_size';
  RAISE NOTICE '========================================';
END $$;
