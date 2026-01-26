-- ========================================
-- NOTIFICATION SYSTEM SETUP
-- Run this in Supabase Dashboard > SQL Editor
-- ========================================

-- This is the same as migration 008_notification_system.sql
-- Copy the contents from supabase/migrations/008_notification_system.sql
-- and run it in your Supabase SQL Editor

-- After running, you should see:
-- ✓ 8 new tables created (notification_templates, contact_lists, contacts, notification_rules, notification_jobs, notification_logs, notification_campaigns, campaign_enrollments)
-- ✓ 3 sample templates inserted
-- ✓ RLS policies enabled
-- ✓ Triggers for auto-updating timestamps

-- To verify the setup, run:
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND (table_name LIKE 'notification%' OR table_name LIKE 'contact%' OR table_name LIKE 'campaign%')
ORDER BY table_name;

-- Check sample templates:
SELECT id, name, channel, created_at FROM notification_templates;
