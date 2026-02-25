import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { successResponse, errorResponse, unauthorizedResponse, badRequestResponse } from '@/lib/api/responses';
import type { StudentDashboardResponse } from '@/types';

/**
 * GET /api/dashboard/student?cohort_id=<id>
 *
 * BFF (Backend-for-Frontend) route that aggregates all student dashboard queries
 * into a single request. Replaces 11 parallel client→Supabase calls with 1 client→server call.
 *
 * Uses Promise.allSettled for partial-failure resilience: if one query fails,
 * the rest still return data. The _meta field tracks which sections failed.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');

    if (!cohortId) {
      return badRequestResponse('cohort_id is required');
    }

    const adminClient = await createAdminClient();

    // Validate user has access to this cohort
    const { data: roleAssignment } = await adminClient
      .from('user_role_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('cohort_id', cohortId)
      .limit(1)
      .maybeSingle();

    if (!roleAssignment) {
      return errorResponse('No access to this cohort', 403);
    }

    // ── Phase A: Fetch cohort metadata (needed for modules query) ──
    const { data: cohort, error: cohortError } = await adminClient
      .from('cohorts')
      .select('id, name, start_date, active_link_type, linked_cohort_id')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return errorResponse('Cohort not found', 404);
    }

    const now = new Date().toISOString();

    // ── Phase B: 9 parallel queries via Promise.allSettled ──
    const results = await Promise.allSettled([
      // [0] Attendance — scoped to this cohort's sessions
      fetchCohortAttendance(adminClient, user.id, cohortId, now),

      // [1] User's rank in this cohort
      // maybeSingle: new students may not have a ranking row yet — not an error
      adminClient
        .from('rankings')
        .select('rank')
        .eq('user_id', user.id)
        .eq('cohort_id', cohortId)
        .maybeSingle(),

      // [2] Total resource count for cohort
      adminClient
        .from('resources')
        .select('*', { count: 'exact', head: true })
        .eq('cohort_id', cohortId),

      // [3] Upcoming sessions (next 3)
      adminClient
        .from('sessions')
        .select('*, session_cohorts!inner(cohort_id)')
        .eq('session_cohorts.cohort_id', cohortId)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(3),

      // [4] Recent modules (uses cohort.active_link_type from Phase A)
      fetchModules(adminClient, cohortId, cohort.active_link_type, cohort.linked_cohort_id),

      // [5] Recent file resources
      adminClient
        .from('resources')
        .select('*')
        .eq('cohort_id', cohortId)
        .eq('type', 'file')
        .order('created_at', { ascending: false })
        .limit(4),

      // [6] Invoices with cohort info
      adminClient
        .from('invoices')
        .select('*, cohort:cohorts!invoices_cohort_id_fkey(id, name, tag)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // [7] Recent learning assets with progress
      // Uses RLS-scoped client — resource_progress has RLS policy (auth.uid() = user_id)
      fetchRecentLearningAssets(supabase, user.id, cohortId),

      // [8] Lightweight leaderboard stats (totalStudents + cohortAvg)
      fetchLeaderboardStats(adminClient, cohortId),

      // [9] Completed resources count (head-only query)
      adminClient
        .from('resource_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_completed', true),
    ]);

    // ── Process results with section tracking ──
    // NOTE: Supabase returns { data, error } as a *fulfilled* promise even on query errors.
    // We must check both Promise rejection AND the Supabase error field.
    const failedSections: string[] = [];

    function extractSupabase<T>(index: number, section: string, fallback: T): T {
      const r = results[index];
      if (r.status === 'rejected') {
        failedSections.push(section);
        return fallback;
      }
      const value = r.value as T & { error?: unknown };
      if (value && typeof value === 'object' && 'error' in value && value.error) {
        failedSections.push(section);
        return fallback;
      }
      return value;
    }

    // For helpers that return plain objects (not Supabase responses)
    function extractPlain<T>(index: number, section: string, fallback: T): T {
      const r = results[index];
      if (r.status === 'rejected') {
        failedSections.push(section);
        return fallback;
      }
      return r.value as T;
    }

    // [0] Attendance (plain object from helper)
    const attendanceStats = extractPlain(0, 'attendance', { avgAttendance: 0 });
    const avgAttendance = (attendanceStats as { avgAttendance: number }).avgAttendance;

    // [1] Ranking
    const rankingResult = extractSupabase(1, 'ranking', { data: null, error: null });
    const ranking = (rankingResult as { data: { rank: number | null } | null }).data;

    // [2] Resources count
    const resourcesCountResult = extractSupabase(2, 'resources_count', { count: 0, data: null, error: null });
    const totalResources = (resourcesCountResult as { count: number | null }).count || 0;

    // [3] Upcoming sessions
    const sessionsResult = extractSupabase(3, 'sessions', { data: [], error: null });
    const upcomingSessions = (sessionsResult as { data: unknown[] | null }).data || [];

    // [4] Recent modules
    const modulesResult = extractSupabase(4, 'modules', { data: [], error: null });
    const recentModules = (modulesResult as { data: unknown[] | null }).data || [];

    // [5] Recent resources
    const resourcesResult = extractSupabase(5, 'resources', { data: [], error: null });
    const recentResources = (resourcesResult as { data: unknown[] | null }).data || [];

    // [6] Invoices
    const invoicesResult = extractSupabase(6, 'invoices', { data: [], error: null });
    const invoiceList = ((invoicesResult as { data: unknown[] | null }).data || []) as Array<{ status: string; amount: number; cohort?: unknown }>;
    const pendingInvoiceAmount = invoiceList
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + (i.amount || 0), 0);

    // [7] Learning assets (plain array from helper)
    const recentLearningAssets = extractPlain(7, 'learning_assets', [] as unknown[]);

    // [8] Leaderboard stats (plain object from helper)
    const leaderboardStats = extractPlain(8, 'leaderboard', { totalStudents: 0, cohortAvg: null as number | null });
    const { totalStudents, cohortAvg } = leaderboardStats as { totalStudents: number; cohortAvg: number | null };

    // [9] Completed resources count
    const completedResult = extractSupabase(9, 'completed_resources', { count: 0, data: null, error: null });
    const completedResources = (completedResult as { count: number | null }).count || 0;

    const response: StudentDashboardResponse = {
      cohort: { name: cohort.name, start_date: cohort.start_date ?? null },
      stats: {
        total_students: totalStudents,
        attendance_percentage: Math.round(avgAttendance),
        current_rank: ranking?.rank || null,
        total_resources: totalResources,
        cohort_avg: cohortAvg,
        completed_resources: completedResources,
      },
      upcomingSessions: upcomingSessions as StudentDashboardResponse['upcomingSessions'],
      recentModules: recentModules as StudentDashboardResponse['recentModules'],
      recentResources: recentResources as StudentDashboardResponse['recentResources'],
      recentLearningAssets: recentLearningAssets as StudentDashboardResponse['recentLearningAssets'],
      invoices: invoiceList as StudentDashboardResponse['invoices'],
      pendingInvoiceAmount,
      _meta: {
        totalQueries: results.length,
        failedQueries: failedSections.length,
        failedSections,
      },
    };

    return successResponse(response);
  } catch (error) {
    console.error('Student dashboard BFF error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// ── Helpers ──

/**
 * Fetch attendance scoped to the active cohort's sessions.
 * Matches the getLeaderboard approach: find countable sessions for cohort,
 * then filter attendance by those session IDs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchCohortAttendance(client: any, userId: string, cohortId: string, now: string) {
  // Get countable sessions for this cohort via session_cohorts junction table
  const { data: sessions, error: sessionsError } = await client
    .from('sessions')
    .select('id, session_cohorts!inner(cohort_id)')
    .eq('session_cohorts.cohort_id', cohortId)
    .eq('counts_for_students', true)
    .lt('scheduled_at', now);

  if (sessionsError || !sessions || sessions.length === 0) {
    return { avgAttendance: 0 };
  }

  const sessionIds = sessions.map((s: { id: string }) => s.id);

  const { data: attendance, error: attendanceError } = await client
    .from('attendance')
    .select('attendance_percentage')
    .eq('user_id', userId)
    .in('session_id', sessionIds);

  if (attendanceError || !attendance || attendance.length === 0) {
    return { avgAttendance: 0 };
  }

  const avg = attendance.reduce(
    (acc: number, a: { attendance_percentage: number | null }) => acc + (a.attendance_percentage || 0),
    0
  ) / attendance.length;

  return { avgAttendance: avg };
}

/** Fetch recent modules respecting cohort link configuration */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchModules(client: any, cohortId: string, activeLinkType: string | null, linkedCohortId: string | null) {
  let query = client
    .from('learning_modules')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(4);

  switch (activeLinkType) {
    case 'global':
      query = query.eq('is_global', true);
      break;
    case 'cohort':
      query = query.eq('cohort_id', linkedCohortId || cohortId);
      break;
    case 'own':
    default:
      query = query.eq('cohort_id', cohortId);
      break;
  }

  return await query;
}

/**
 * Lightweight leaderboard stats: just totalStudents + cohortAvg.
 * Mirrors the formula from getLeaderboard in /api/analytics/route.ts exactly:
 *   per-student avgPercentage = round((sum / totalSessions) * 100) / 100
 *   cohortAvg = round((sum_of_avgPercentages / studentCount) * 100) / 100
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLeaderboardStats(client: any, cohortId: string) {
  // Count students from both sources (role_assignments + legacy profiles)
  const [{ data: raStudents }, { data: profileStudents }] = await Promise.all([
    client
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student')
      .eq('cohort_id', cohortId),
    client
      .from('profiles')
      .select('id')
      .eq('role', 'student')
      .eq('cohort_id', cohortId),
  ]);

  const allStudentIds = new Set([
    ...(raStudents?.map((r: { user_id: string }) => r.user_id) ?? []),
    ...(profileStudents?.map((r: { id: string }) => r.id) ?? []),
  ]);
  const totalStudents = allStudentIds.size;
  const studentIds = Array.from(allStudentIds);

  if (studentIds.length === 0) {
    return { totalStudents: 0, cohortAvg: 0 };
  }

  // Get countable sessions for this cohort via session_cohorts junction table
  const { data: sessions } = await client
    .from('sessions')
    .select('id, session_cohorts!inner(cohort_id)')
    .eq('session_cohorts.cohort_id', cohortId)
    .eq('counts_for_students', true)
    .lt('scheduled_at', new Date().toISOString());

  if (!sessions || sessions.length === 0) {
    return { totalStudents, cohortAvg: 0 };
  }

  const sessionIds = sessions.map((s: { id: string }) => s.id);

  // Get all attendance records for the cohort
  const { data: attendanceRecords } = await client
    .from('attendance')
    .select('user_id, attendance_percentage')
    .in('session_id', sessionIds)
    .in('user_id', studentIds);

  if (!attendanceRecords || attendanceRecords.length === 0) {
    return { totalStudents, cohortAvg: 0 };
  }

  // Compute per-student avgPercentage using the EXACT same formula as getLeaderboard:
  //   avgPercentage = Math.round((sum / totalSessions) * 100) / 100
  const totalSessions = sessions.length;
  const studentSums = new Map<string, number>();
  for (const record of attendanceRecords) {
    const existing = studentSums.get(record.user_id) || 0;
    studentSums.set(record.user_id, existing + (record.attendance_percentage || 0));
  }

  // Build per-student avgPercentage (rounded to 2 decimal places, same as original)
  let sumOfAvgPercentages = 0;
  for (const [, sum] of studentSums) {
    const avgPercentage = Math.round((sum / totalSessions) * 100) / 100;
    sumOfAvgPercentages += avgPercentage;
  }
  // Students with zero attendance contribute 0 implicitly (not in studentSums)

  // cohortAvg = Math.round((sum_of_avgs / totalStudents) * 100) / 100
  const cohortAvg = totalStudents > 0
    ? Math.round((sumOfAvgPercentages / totalStudents) * 100) / 100
    : 0;

  return { totalStudents, cohortAvg };
}

/** Fetch recent learning assets with progress data */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRecentLearningAssets(supabase: any, userId: string, cohortId: string) {
  const { data: progressData, error } = await supabase
    .from('resource_progress')
    .select(`
      *,
      module_resources(
        *,
        learning_modules(cohort_id, is_global)
      )
    `)
    .eq('user_id', userId)
    .not('last_viewed_at', 'is', null)
    .order('last_viewed_at', { ascending: false })
    .limit(12); // Fetch more for filtering

  if (error || !progressData) return [];

  // Filter by cohort
  const filtered = progressData.filter((p: { module_resources?: { learning_modules?: { cohort_id: string; is_global: boolean } } }) => {
    const module = p.module_resources?.learning_modules;
    if (!module) return false;
    return module.cohort_id === cohortId || module.is_global;
  });

  // Transform and limit
  return filtered.slice(0, 4).map((p: { module_resources: Record<string, unknown>; is_completed: boolean; progress_seconds: number; last_viewed_at: string | null }) => ({
    ...p.module_resources,
    progress: {
      is_completed: p.is_completed,
      progress_seconds: p.progress_seconds,
      last_viewed_at: p.last_viewed_at,
    },
  }));
}
