-- Migration 024: Fix self-referencing RLS recursion on profiles table
--
-- Problem: Migration 023 enabled RLS on profiles, activating 5 existing policies.
-- 3 of those policies contain subqueries against the profiles table itself:
--   - "Admins can view all profiles"   → EXISTS(SELECT 1 FROM profiles WHERE ...)
--   - "Mentors can view their team profiles" → EXISTS(SELECT 1 FROM profiles WHERE ...)
--   - "Admins can manage all profiles" → EXISTS(SELECT 1 FROM profiles WHERE ...)
--
-- When PostgreSQL evaluates these policies, the inner SELECT triggers the same
-- policies again, creating infinite recursion. This cascades to 75+ policies on
-- 16+ other tables that subquery profiles in their USING clauses.
--
-- Fix: Use a SECURITY DEFINER function to read the current user's role.
-- SECURITY DEFINER functions execute as their owner (bypassing RLS), so
-- get_my_role() can read profiles.role without triggering policy evaluation.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;
--   -- Then recreate original policies from 001_initial_schema.sql (lines 305-330)

-- Step 1: Create SECURITY DEFINER helper function
-- STABLE = pure read, safe to cache within a transaction
-- SET search_path = public prevents search_path hijacking (security best practice)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Step 2: Grant execute permissions to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- Step 3: Drop the 3 self-referencing policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Mentors can view their team profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Step 4: Recreate policies using get_my_role() instead of subqueries
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.get_my_role() IN ('admin', 'company_user'));

CREATE POLICY "Mentors can view their team profiles"
  ON profiles FOR SELECT
  USING (public.get_my_role() = 'mentor' AND mentor_id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  USING (public.get_my_role() IN ('admin', 'company_user'));

-- The 2 non-recursive policies remain untouched:
--   "Users can view their own profile"  (auth.uid() = id) — no subquery
--   "Users can update their own profile" (auth.uid() = id) — no subquery
