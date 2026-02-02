# Database Migration Guide

## 🔍 Issue Identified

The linking failure is caused by **missing database migrations**. The verification script shows:

```
❌ MISSING:
   ❌ cohorts.active_link_type
   ❌ cohorts.linked_cohort_id
   ❌ cohort_module_links.link_type
   ❌ atomic_update_cohort_link
   ❌ atomic_unlink_all
   ❌ atomic_unlink_by_type
```

## 🚀 Step-by-Step Fix

### Step 1: Open Supabase Dashboard

1. Go to: https://isethhyihdbhquozlabl.supabase.co
2. Navigate to **SQL Editor** (left sidebar)

### Step 2: Apply Migration 012 (Override Module Linking)

1. Click **New Query**
2. Copy the entire contents of `supabase/migrations/012_override_module_linking.sql`
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl/Cmd + Enter)
5. Wait for success message: ✅ "Success. No rows returned"

**This migration adds:**
- `active_link_type` column to `cohorts` table
- `linked_cohort_id` column to `cohorts` table
- `link_type` column to `cohort_module_links` table
- Database triggers for automatic state management

### Step 3: Apply Migration 013 (Atomic Functions)

1. Click **New Query** (or clear previous query)
2. Copy the entire contents of `supabase/migrations/013_atomic_link_update_function.sql`
3. Paste into the SQL Editor
4. Click **Run**
5. Wait for success message: ✅ "All atomic functions created successfully"

**This migration adds:**
- `atomic_update_cohort_link()` PostgreSQL function
- `atomic_unlink_all()` PostgreSQL function
- `atomic_unlink_by_type()` PostgreSQL function

### Step 4: Verify Migrations

Run the verification script again:

```bash
npm run verify-migrations
```

Expected output:
```
✅ All migrations verified! Database is ready.
```

### Step 5: Test Linking

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Navigate to: http://localhost:3000/admin/cohorts/[cohort-id]

3. Try linking Cohort 7 to Cohort 6:
   - Select "Cohort 6" from source dropdown
   - Should show "10 modules from Cohort 6"
   - Click "Link & Override with 10 Modules"
   - Should see success message ✓

## 📋 What Changed

### Database Schema

**cohorts table:**
```sql
active_link_type VARCHAR(20) DEFAULT 'own'
  CHECK (active_link_type IN ('own', 'cohort', 'global'))
linked_cohort_id UUID REFERENCES cohorts(id)
```

**cohort_module_links table:**
```sql
link_type VARCHAR(20) NOT NULL DEFAULT 'cohort'
  CHECK (link_type IN ('cohort', 'global'))
```

### Database Triggers

1. **enforce_single_link**: Automatically removes all existing links when creating a new link
2. **cleanup_after_unlink**: Resets cohort to 'own' state when all links are removed

### PostgreSQL Functions

1. **atomic_update_cohort_link**: Atomically deletes old links + inserts new links in single transaction
2. **atomic_unlink_all**: Removes all links for a cohort
3. **atomic_unlink_by_type**: Removes links of specific type (cohort or global)

## 🔧 Detailed Logging Added

I've added comprehensive logging to the API endpoint:

```
[LINK] Step 1: Request received
[LINK] Step 2: Validation passed
[LINK] Step 3: Querying modules
[LINK] Step 4: Modules fetched
[LINK] Step 5: Determined link type
[LINK] Step 6: Checked for circular links
[LINK] Step 7: Calling atomic_update_cohort_link
[LINK] Step 8: Success!
```

Check server logs (terminal running `npm run dev`) to see exactly where it fails if issues persist.

## ✅ Verification Checklist

After applying migrations, verify these scenarios work:

- [ ] Verification script shows all green checks
- [ ] Can link Cohort 7 to Cohort 6 (cohort link)
- [ ] Can unlink Cohort 7 from Cohort 6
- [ ] Can link Cohort 7 to Global Library
- [ ] Can unlink from Global Library
- [ ] Cannot link to both cohort AND global simultaneously
- [ ] Circular links are prevented
- [ ] Admin sees link status banner in /admin/learnings
- [ ] Students see correct modules based on active link

## 🐛 Troubleshooting

### If migration fails:

1. **Check SQL syntax errors**: Look for error message in Supabase Dashboard
2. **Check for duplicate columns**: If columns already exist, migrations will fail
3. **Roll back manually**: Drop columns/functions if needed before retrying

### If linking still fails after migrations:

1. Check server logs for `[LINK]` messages
2. Look for specific error at step where it fails
3. Verify auth.userId is not null
4. Check cohort IDs are valid UUIDs

### If verification script fails:

1. Ensure .env.local has correct Supabase credentials
2. Check SUPABASE_SERVICE_ROLE_KEY has admin permissions
3. Verify database connection

## 📊 Migration Status

Run `npm run verify-migrations` anytime to check migration status:

- ✅ **6/12** = Migrations needed
- ✅ **12/12** = All good!

## 🎯 Next Steps

After migrations are applied:

1. Test all linking scenarios (checklist above)
2. Remove the detailed `[LINK]` logging from production (optional)
3. Deploy to production with migrations applied
4. Monitor error logs for any edge cases

---

**Created**: 2026-02-03
**Last Updated**: 2026-02-03
**Status**: Ready for application
