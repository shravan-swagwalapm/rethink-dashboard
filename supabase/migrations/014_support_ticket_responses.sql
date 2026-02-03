-- Support Ticket System Enhancement Migration
-- FEATURE-001: Support Ticket System for Students
--
-- This migration adds:
-- 1. Category column to support_tickets table
-- 2. ticket_responses table for conversation threads
--
-- Run this SQL in your Supabase SQL editor

-- ============================================
-- Step 1: Add category column to support_tickets
-- ============================================
ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- Update any NULL categories to 'other'
UPDATE support_tickets SET category = 'other' WHERE category IS NULL;

-- Add check constraint for valid categories
ALTER TABLE support_tickets
DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE support_tickets
ADD CONSTRAINT support_tickets_category_check
CHECK (category IN ('technical', 'payment', 'content', 'schedule', 'other'));

-- ============================================
-- Step 2: Create ticket_responses table
-- ============================================
CREATE TABLE IF NOT EXISTS ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Step 3: Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ticket_responses_ticket_id
ON ticket_responses(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_responses_user_id
ON ticket_responses(user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_responses_created_at
ON ticket_responses(created_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_category
ON support_tickets(category);

-- ============================================
-- Step 4: Add RLS policies for ticket_responses
-- ============================================

-- Enable RLS
ALTER TABLE ticket_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read responses on their own tickets
DROP POLICY IF EXISTS "Users can read responses on their tickets" ON ticket_responses;
CREATE POLICY "Users can read responses on their tickets"
ON ticket_responses FOR SELECT
USING (
  ticket_id IN (
    SELECT id FROM support_tickets WHERE user_id = auth.uid()
  )
  OR
  -- Admins can read all responses
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'company_user')
  )
);

-- Policy: Users can insert responses on their own tickets
DROP POLICY IF EXISTS "Users can add responses to their tickets" ON ticket_responses;
CREATE POLICY "Users can add responses to their tickets"
ON ticket_responses FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND
  ticket_id IN (
    SELECT id FROM support_tickets WHERE user_id = auth.uid()
  )
);

-- Policy: Admins can insert responses on any ticket
DROP POLICY IF EXISTS "Admins can add responses to any ticket" ON ticket_responses;
CREATE POLICY "Admins can add responses to any ticket"
ON ticket_responses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'company_user')
  )
);

-- ============================================
-- Verification Query (run after migration)
-- ============================================
-- SELECT
--   'support_tickets' as table_name,
--   column_name,
--   data_type,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('support_tickets', 'ticket_responses')
-- ORDER BY table_name, ordinal_position;
