-- Migration: Cross-Cohort Resource Sharing
-- Purpose: Enable learning modules to be shared across multiple cohorts
-- Date: 2026-01-26

-- ============================================================================
-- 1. Create Junction Table for Many-to-Many Cohort-Module Relationships
-- ============================================================================

CREATE TABLE IF NOT EXISTS cohort_module_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,

  -- Tracking metadata
  source_cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  linked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Prevent duplicate links
  UNIQUE(cohort_id, module_id)
);

-- Indexes for performance
CREATE INDEX idx_cohort_module_links_cohort ON cohort_module_links(cohort_id);
CREATE INDEX idx_cohort_module_links_module ON cohort_module_links(module_id);
CREATE INDEX idx_cohort_module_links_source ON cohort_module_links(source_cohort_id);

-- Comments
COMMENT ON TABLE cohort_module_links IS 'Many-to-many relationship: cohorts can share learning modules';
COMMENT ON COLUMN cohort_module_links.source_cohort_id IS 'Original cohort this module was copied from (for audit trail)';
COMMENT ON COLUMN cohort_module_links.linked_at IS 'Timestamp when the module was linked to this cohort';
COMMENT ON COLUMN cohort_module_links.linked_by IS 'Admin user who created this link';


-- ============================================================================
-- 2. Modify learning_modules Table for Global Library Support
-- ============================================================================

-- Make cohort_id nullable to support global modules
ALTER TABLE learning_modules
ALTER COLUMN cohort_id DROP NOT NULL;

-- Add flag for global modules
ALTER TABLE learning_modules
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Update existing modules (keep cohort_id populated)
UPDATE learning_modules SET is_global = false WHERE cohort_id IS NOT NULL;

-- Constraint: Global modules must have cohort_id = null
ALTER TABLE learning_modules
ADD CONSTRAINT check_global_module CHECK (
  (is_global = true AND cohort_id IS NULL) OR
  (is_global = false)
);

-- Index for global module queries
CREATE INDEX idx_learning_modules_global ON learning_modules(is_global) WHERE is_global = true;

COMMENT ON COLUMN learning_modules.is_global IS 'True for global library modules not tied to any specific cohort';


-- ============================================================================
-- 3. Update Row Level Security (RLS) Policies
-- ============================================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view modules" ON learning_modules;
DROP POLICY IF EXISTS "Anyone can view resources" ON module_resources;

-- New restrictive policies for learning_modules

-- Policy 1: Users see global modules
CREATE POLICY "Users see global modules" ON learning_modules
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND is_global = true
  );

-- Policy 2: Users see their cohort modules (both owned and linked)
CREATE POLICY "Users see their cohort modules" ON learning_modules
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- Direct ownership: module belongs to user's cohort
      cohort_id IN (
        SELECT cohort_id FROM profiles WHERE id = auth.uid()
      )
      OR
      -- Linked ownership: module is shared to user's cohort via junction table
      id IN (
        SELECT module_id FROM cohort_module_links
        WHERE cohort_id IN (
          SELECT cohort_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- Admin policies for learning_modules (unchanged)
CREATE POLICY "Admins manage modules" ON learning_modules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );


-- New restrictive policies for module_resources

-- Policy 1: Users see resources of global modules
CREATE POLICY "Users see resources of global modules" ON module_resources
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    module_id IN (
      SELECT id FROM learning_modules WHERE is_global = true
    )
  );

-- Policy 2: Users see resources of their cohort modules
CREATE POLICY "Users see resources of their cohort modules" ON module_resources
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- Resources of modules owned by user's cohort
      module_id IN (
        SELECT id FROM learning_modules
        WHERE cohort_id IN (
          SELECT cohort_id FROM profiles WHERE id = auth.uid()
        )
      )
      OR
      -- Resources of linked modules
      module_id IN (
        SELECT module_id FROM cohort_module_links
        WHERE cohort_id IN (
          SELECT cohort_id FROM profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- Admin policies for module_resources (unchanged)
CREATE POLICY "Admins manage resources" ON module_resources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );


-- ============================================================================
-- 4. Enable RLS on cohort_module_links Table
-- ============================================================================

ALTER TABLE cohort_module_links ENABLE ROW LEVEL SECURITY;

-- Students and users can view links for their cohort
CREATE POLICY "Users see their cohort links" ON cohort_module_links
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    cohort_id IN (
      SELECT cohort_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Only admins can manage links
CREATE POLICY "Admins manage cohort module links" ON cohort_module_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );


-- ============================================================================
-- 5. Verification Queries (for testing)
-- ============================================================================

-- Verify table creation
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'cohort_module_links'
  ) THEN
    RAISE NOTICE 'SUCCESS: cohort_module_links table created';
  ELSE
    RAISE EXCEPTION 'FAILED: cohort_module_links table not created';
  END IF;
END $$;

-- Verify is_global column
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'learning_modules'
    AND column_name = 'is_global'
  ) THEN
    RAISE NOTICE 'SUCCESS: is_global column added to learning_modules';
  ELSE
    RAISE EXCEPTION 'FAILED: is_global column not added';
  END IF;
END $$;

-- Verify RLS policies
DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename = 'cohort_module_links';

  IF policy_count >= 2 THEN
    RAISE NOTICE 'SUCCESS: RLS policies created for cohort_module_links';
  ELSE
    RAISE WARNING 'WARNING: Expected at least 2 RLS policies for cohort_module_links, found %', policy_count;
  END IF;
END $$;
