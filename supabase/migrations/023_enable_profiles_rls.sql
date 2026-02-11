-- Migration 023: Enable RLS on profiles table (security fix)
--
-- Context: Supabase Security Advisor flagged 2 critical errors (08 Feb 2026):
--   1. "Policy Exists RLS Disabled" — 5 RLS policies exist but RLS is OFF
--   2. "RLS Disabled in Public" — table exposed via PostgREST without protection
--
-- The 5 policies were defined in 001_initial_schema.sql but RLS was never
-- enabled on production. This migration activates them.
--
-- IMPORTANT: Deploy code changes (Steps 1-3 from plan) BEFORE running this.
-- If run before code deploy, public profiles, team page, and dashboard stats
-- will break until the new code is live.
--
-- Rollback: ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
