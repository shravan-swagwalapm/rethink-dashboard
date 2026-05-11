import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * GET /api/admin/cohorts/[id]/certificates
 *
 * Lists every member of the cohort (students + mentors, recovered from
 * `user_role_assignments`) joined with their certificate row from
 * `cohort_certificates` if one exists.
 *
 * Response shape:
 *   [
 *     {
 *       user_id, full_name, email, role,
 *       certificate: { id, file_type, file_size, uploaded_at, uploaded_by } | null
 *     },
 *     ...
 *   ]
 *
 * Notes on the member-list query:
 *   - A single user may have multiple `user_role_assignments` rows for the same
 *     cohort (e.g. a mentor who is also a co-mentor under another schema). The
 *     UNIQUE constraint on `cohort_certificates(user_id, cohort_id)` means at
 *     most one cert per (user, cohort) pair, so we deduplicate by user_id and
 *     prefer the `mentor` role over `student` when both exist (defensive — the
 *     UI badge then reflects the higher-trust role).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: cohortId } = await params;

  try {
    const adminClient = await createAdminClient();

    // Step 1: fetch all role assignments for this cohort (student + mentor).
    const { data: assignments, error: assignmentsError } = await adminClient
      .from('user_role_assignments')
      .select('user_id, role')
      .eq('cohort_id', cohortId)
      .in('role', ['student', 'mentor']);

    if (assignmentsError) {
      return NextResponse.json(
        { error: 'Failed to fetch cohort members', detail: assignmentsError.message },
        { status: 500 }
      );
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json([]);
    }

    // Deduplicate by user_id; mentor outranks student if both exist.
    const roleByUser = new Map<string, 'student' | 'mentor'>();
    for (const a of assignments as { user_id: string; role: 'student' | 'mentor' }[]) {
      const existing = roleByUser.get(a.user_id);
      if (!existing || (existing === 'student' && a.role === 'mentor')) {
        roleByUser.set(a.user_id, a.role);
      }
    }
    const userIds = Array.from(roleByUser.keys());

    // Step 2: batch-fetch profiles for those users.
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds)
      .order('full_name', { ascending: true });

    if (profilesError) {
      return NextResponse.json(
        { error: 'Failed to fetch member profiles', detail: profilesError.message },
        { status: 500 }
      );
    }

    // Step 3: batch-fetch any existing certificates for this cohort + users.
    const { data: certs, error: certsError } = await adminClient
      .from('cohort_certificates')
      .select('id, user_id, file_type, file_size, uploaded_at, uploaded_by')
      .eq('cohort_id', cohortId)
      .in('user_id', userIds);

    if (certsError) {
      return NextResponse.json(
        { error: 'Failed to fetch certificates', detail: certsError.message },
        { status: 500 }
      );
    }

    const certByUser = new Map<string, {
      id: string;
      file_type: string;
      file_size: number;
      uploaded_at: string;
      uploaded_by: string;
    }>();
    for (const c of certs ?? []) {
      const typed = c as {
        id: string;
        user_id: string;
        file_type: string;
        file_size: number;
        uploaded_at: string;
        uploaded_by: string;
      };
      certByUser.set(typed.user_id, {
        id: typed.id,
        file_type: typed.file_type,
        file_size: typed.file_size,
        uploaded_at: typed.uploaded_at,
        uploaded_by: typed.uploaded_by,
      });
    }

    const rows = (profiles ?? []).map((p) => {
      const typed = p as {
        id: string;
        full_name: string | null;
        email: string;
        avatar_url: string | null;
      };
      return {
        user_id: typed.id,
        full_name: typed.full_name,
        email: typed.email,
        avatar_url: typed.avatar_url,
        role: roleByUser.get(typed.id) ?? 'student',
        certificate: certByUser.get(typed.id) ?? null,
      };
    });

    return NextResponse.json(rows);
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Failed to fetch cohort certificates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
