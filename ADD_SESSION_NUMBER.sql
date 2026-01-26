-- ========================================
-- ADD SESSION NUMBER TO MODULE RESOURCES
-- Run this in Supabase Dashboard > SQL Editor
-- ========================================

-- Add session_number column to module_resources table
ALTER TABLE module_resources
ADD COLUMN IF NOT EXISTS session_number INT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_module_resources_session ON module_resources(session_number);

-- Verify the column was added
SELECT
  'Session number column added successfully!' as message,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'module_resources'
  AND column_name = 'session_number';
