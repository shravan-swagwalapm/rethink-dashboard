-- Add session_number column to module_resources table
ALTER TABLE module_resources
ADD COLUMN IF NOT EXISTS session_number INT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_module_resources_session ON module_resources(session_number);
