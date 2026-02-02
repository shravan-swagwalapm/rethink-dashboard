/**
 * Database Migration Verification Script
 *
 * This script verifies that all required database migrations have been applied.
 * Run with: npm run verify-migrations
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CheckResult {
  name: string;
  exists: boolean;
  error?: string;
}

async function checkTableExists(tableName: string): Promise<CheckResult> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);

    return { name: tableName, exists: !error };
  } catch (err) {
    return { name: tableName, exists: false, error: String(err) };
  }
}

async function checkFunctionExists(functionName: string): Promise<CheckResult> {
  try {
    const { data, error } = await supabase
      .rpc('pg_get_functiondef', { funcid: functionName } as any);

    if (error && error.message.includes('does not exist')) {
      return { name: functionName, exists: false };
    }

    return { name: functionName, exists: !error };
  } catch (err) {
    // Try alternative method - just call the function with dummy params
    try {
      await supabase.rpc(functionName, {});
      return { name: functionName, exists: true };
    } catch {
      return { name: functionName, exists: false };
    }
  }
}

async function checkColumnExists(tableName: string, columnName: string): Promise<CheckResult> {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(0);

    return { name: `${tableName}.${columnName}`, exists: !error };
  } catch (err) {
    return { name: `${tableName}.${columnName}`, exists: false, error: String(err) };
  }
}

async function main() {
  console.log('🔍 Verifying database migrations...\n');

  const checks: CheckResult[] = [];

  // Check tables
  console.log('📋 Checking tables...');
  checks.push(await checkTableExists('profiles'));
  checks.push(await checkTableExists('cohorts'));
  checks.push(await checkTableExists('learning_modules'));
  checks.push(await checkTableExists('module_resources'));
  checks.push(await checkTableExists('cohort_module_links'));
  checks.push(await checkTableExists('otp_codes'));

  // Check cohorts columns (Migration 012)
  console.log('\n📊 Checking cohorts columns (Migration 012)...');
  checks.push(await checkColumnExists('cohorts', 'active_link_type'));
  checks.push(await checkColumnExists('cohorts', 'linked_cohort_id'));

  // Check cohort_module_links columns (Migration 012)
  console.log('\n📊 Checking cohort_module_links columns (Migration 012)...');
  checks.push(await checkColumnExists('cohort_module_links', 'link_type'));

  // Check functions (Migration 013)
  console.log('\n⚙️  Checking PostgreSQL functions (Migration 013)...');
  checks.push(await checkFunctionExists('atomic_update_cohort_link'));
  checks.push(await checkFunctionExists('atomic_unlink_all'));
  checks.push(await checkFunctionExists('atomic_unlink_by_type'));

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(60) + '\n');

  const passed = checks.filter(c => c.exists);
  const failed = checks.filter(c => !c.exists);

  passed.forEach(check => {
    console.log(`✅ ${check.name}`);
  });

  if (failed.length > 0) {
    console.log('\n❌ MISSING:');
    failed.forEach(check => {
      console.log(`   ❌ ${check.name}`);
      if (check.error) {
        console.log(`      Error: ${check.error}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${passed.length}/${checks.length} checks passed`);
  console.log('='.repeat(60));

  if (failed.length > 0) {
    console.log('\n⚠️  MIGRATIONS REQUIRED!\n');
    console.log('Missing migrations detected. To fix:');
    console.log('');
    console.log('1. Go to your Supabase Dashboard:');
    console.log(`   ${supabaseUrl.replace('/rest/v1', '')}`);
    console.log('');
    console.log('2. Navigate to SQL Editor');
    console.log('');
    console.log('3. Run these migration files in order:');

    if (failed.some(f => f.name.includes('active_link_type') || f.name.includes('link_type'))) {
      console.log('   - supabase/migrations/012_override_module_linking.sql');
    }
    if (failed.some(f => f.name.includes('atomic_'))) {
      console.log('   - supabase/migrations/013_atomic_link_update_function.sql');
    }

    console.log('');
    console.log('4. Re-run this script to verify');
    console.log('');

    process.exit(1);
  } else {
    console.log('\n✅ All migrations verified! Database is ready.');
    console.log('');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
