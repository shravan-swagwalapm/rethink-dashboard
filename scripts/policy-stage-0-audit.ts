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
 * Read-only. No INSERT/UPDATE/DELETE/UPSERT.
 *
 * Exit codes:
 *   0 — no drift
 *   1 — drift detected (rows printed to stderr)
 *   2 — unexpected error (env missing, network failure, etc.)
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
  //    the new multi-role table.
  const { data: assignments, error: assignmentsError } = await supabase
    .from('user_role_assignments')
    .select('user_id')
    .in('role', ADMIN_ROLES as unknown as string[]);

  if (assignmentsError) {
    console.error('Failed to query user_role_assignments:', assignmentsError.message);
    process.exit(2);
  }

  const coveredUserIds = new Set<string>(
    (assignments ?? []).map((row) => row.user_id as string)
  );

  // 2. Fetch all profiles with an admin role (legacy single-role column).
  const { data: adminProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, role')
    .in('role', ADMIN_ROLES as unknown as string[]);

  if (profilesError) {
    console.error('Failed to query profiles:', profilesError.message);
    process.exit(2);
  }

  // 3. Set difference: profiles.role admins who are NOT in user_role_assignments.
  const driftRows: DriftRow[] = (adminProfiles ?? [])
    .filter((profile) => !coveredUserIds.has(profile.id as string))
    .map((profile) => ({
      id: profile.id as string,
      email: (profile.email as string | null) ?? null,
      role: profile.role as string,
    }));

  if (driftRows.length === 0) {
    console.log(
      '✓ OK — zero role drift between profiles.role and user_role_assignments'
    );
    process.exit(0);
  }

  // Drift found — emit summary + table on stderr, exit 1.
  console.error(`Found ${driftRows.length} drift row${driftRows.length === 1 ? '' : 's'}`);
  console.error(
    'These users have an admin role in profiles.role but no matching admin entry in user_role_assignments:'
  );
  console.error('');
  console.error(formatTable(driftRows));
  process.exit(1);
}

function formatTable(rows: DriftRow[]): string {
  const headers: Array<keyof DriftRow> = ['id', 'email', 'role'];
  const widths: Record<keyof DriftRow, number> = {
    id: headers[0].length,
    email: headers[1].length,
    role: headers[2].length,
  };

  for (const row of rows) {
    widths.id = Math.max(widths.id, row.id.length);
    widths.email = Math.max(widths.email, (row.email ?? '(null)').length);
    widths.role = Math.max(widths.role, row.role.length);
  }

  const pad = (value: string, w: number) => value.padEnd(w, ' ');
  const headerLine = headers.map((h) => pad(h, widths[h])).join('  ');
  const sepLine = headers.map((h) => '-'.repeat(widths[h])).join('  ');
  const dataLines = rows.map((row) =>
    [
      pad(row.id, widths.id),
      pad(row.email ?? '(null)', widths.email),
      pad(row.role, widths.role),
    ].join('  ')
  );

  return [headerLine, sepLine, ...dataLines].join('\n');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
