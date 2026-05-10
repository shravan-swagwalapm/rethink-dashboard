/**
 * Policy Module Stage 0 — Role Drift Audit
 *
 * Audits the invariant that every admin-role user recorded in the legacy
 * `profiles.role` column also has a corresponding entry in
 * `user_role_assignments` with an admin role. Drift here would mean the
 * legacy authorization path grants admin access without the multi-role
 * table backing it — a precondition for collapsing onto a single source
 * of truth in later stages.
 *
 * This audit is one-directional: it does NOT detect users who have an
 * admin role in `user_role_assignments` but a non-admin (or absent)
 * `profiles.role`. Stage 1 should add the reverse check before collapsing
 * onto a single source of truth.
 *
 * Read-only. No INSERT/UPDATE/DELETE/UPSERT.
 *
 * Exit codes:
 *   0 — no drift
 *   1 — drift detected (rows printed to stderr)
 *   2 — unexpected error (env missing, network failure, result truncation, etc.)
 *
 * Run with: npm run policy:stage-0-audit
 *
 * Reference: docs/adr/0003-cohort-scoped-policy-module.md §"Migration path (resolved Q8)"
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_ROLES } from '../lib/utils/auth';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(2);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface DriftRow {
  id: string;
  email: string | null;
  role: string;
}

async function main() {
  // 1. Fetch all admin-role assignments from user_role_assignments.
  //    We only need the user_id — that's the set of users "covered" by
  //    the new multi-role table. `count: 'exact'` lets us assert no
  //    silent truncation by Supabase's default row cap (typically 1000).
  const {
    data: assignments,
    error: assignmentsError,
    count: assignmentsCount,
  } = await supabase
    .from('user_role_assignments')
    .select('user_id', { count: 'exact' })
    .in('role', [...ADMIN_ROLES]);

  if (assignmentsError) {
    console.error('Failed to query user_role_assignments:', assignmentsError.message);
    process.exit(2);
  }

  const assignmentsRows = assignments ?? [];
  if (assignmentsCount !== null && assignmentsRows.length !== assignmentsCount) {
    console.error(
      `Result truncated: received ${assignmentsRows.length} of ${assignmentsCount} rows from user_role_assignments. Audit cannot proceed without pagination.`
    );
    process.exit(2);
  }

  const coveredUserIds = new Set<string>(
    assignmentsRows.map((row) => row.user_id as string)
  );

  // 2. Fetch all profiles with an admin role (legacy single-role column).
  const {
    data: adminProfiles,
    error: profilesError,
    count: profilesCount,
  } = await supabase
    .from('profiles')
    .select('id, email, role', { count: 'exact' })
    .in('role', [...ADMIN_ROLES]);

  if (profilesError) {
    console.error('Failed to query profiles:', profilesError.message);
    process.exit(2);
  }

  const adminProfilesRows = adminProfiles ?? [];
  if (profilesCount !== null && adminProfilesRows.length !== profilesCount) {
    console.error(
      `Result truncated: received ${adminProfilesRows.length} of ${profilesCount} rows from profiles. Audit cannot proceed without pagination.`
    );
    process.exit(2);
  }

  // 3. Set difference: profiles.role admins who are NOT in user_role_assignments.
  const driftRows: DriftRow[] = adminProfilesRows
    .filter((profile) => !coveredUserIds.has(profile.id as string))
    .map((profile) => ({
      id: profile.id as string,
      email: (profile.email as string | null) ?? null,
      role: profile.role as string,
    }));

  if (driftRows.length === 0) {
    console.log(
      `✓ OK — checked ${adminProfilesRows.length} admin profiles against ${coveredUserIds.size} covered users — zero role drift between profiles.role and user_role_assignments`
    );
    process.exit(0);
  }

  // Drift found — emit summary + table on stderr, exit 1.
  console.error(
    `Found ${driftRows.length} drift row${driftRows.length === 1 ? '' : 's'} (out of ${adminProfilesRows.length} admin profiles checked against ${coveredUserIds.size} covered users)`
  );
  console.error(
    'These users have an admin role in profiles.role but no matching admin entry in user_role_assignments:'
  );
  console.error('\nDrift rows:');
  console.table(driftRows);
  process.exit(1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
