import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET: Aggregated attendance analytics stats
 * Query params: cohort_id (optional filter)
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = await createAdminClient();
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');

    // Active students count — check both role_assignments and legacy profiles
    let raQuery = supabase
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student');
    if (cohortId) raQuery = raQuery.eq('cohort_id', cohortId);

    let profileQuery = supabase
      .from('profiles')
      .select('id')
      .eq('role', 'student');
    if (cohortId) profileQuery = profileQuery.eq('cohort_id', cohortId);

    const [{ data: raStudents }, { data: profileStudents }] = await Promise.all([
      raQuery,
      profileQuery,
    ]);

    const allStudentIds = new Set([
      ...(raStudents?.map(r => r.user_id) ?? []),
      ...(profileStudents?.map(r => r.id) ?? []),
    ]);
    const activeStudents = allStudentIds.size;

    // Sessions that count for students
    let sessionsQuery = supabase
      .from('sessions')
      .select('id, title, scheduled_at')
      .eq('counts_for_students', true)
      .lt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (cohortId) {
      sessionsQuery = sessionsQuery.eq('cohort_id', cohortId);
    }

    const { data: countableSessions } = await sessionsQuery;
    const sessionsCompleted = countableSessions?.length || 0;

    // Average attendance across all countable sessions
    let avgAttendance = 0;
    let unmatchedCount = 0;
    const trendData: { sessionId: string; title: string; date: string; avgPercentage: number }[] = [];

    if (countableSessions && countableSessions.length > 0) {
      const sessionIds = countableSessions.map((s) => s.id);

      // Get all attendance records for these sessions
      const { data: attendanceRecords } = await supabase
        .from('attendance')
        .select('session_id, user_id, attendance_percentage')
        .in('session_id', sessionIds);

      if (attendanceRecords && attendanceRecords.length > 0) {
        // Overall average (only matched users)
        const matchedRecords = attendanceRecords.filter((r) => r.user_id !== null);
        if (matchedRecords.length > 0) {
          avgAttendance =
            Math.round(
              (matchedRecords.reduce((sum, r) => sum + (r.attendance_percentage || 0), 0) /
                matchedRecords.length) *
                100
            ) / 100;
        }

        // Unmatched count
        unmatchedCount = attendanceRecords.filter((r) => r.user_id === null).length;

        // Per-session trend data
        for (const session of countableSessions) {
          const sessionRecords = matchedRecords.filter((r) => r.session_id === session.id);
          if (sessionRecords.length > 0) {
            const sessionAvg =
              Math.round(
                (sessionRecords.reduce((sum, r) => sum + (r.attendance_percentage || 0), 0) /
                  sessionRecords.length) *
                  100
              ) / 100;
            trendData.push({
              sessionId: session.id,
              title: session.title,
              date: session.scheduled_at,
              avgPercentage: sessionAvg,
            });
          }
        }
      }
    }

    return NextResponse.json({
      activeStudents: activeStudents || 0,
      avgAttendance,
      sessionsCompleted,
      unmatchedCount,
      trendData,
    });
  } catch (error) {
    console.error('Error fetching analytics stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics stats' },
      { status: 500 }
    );
  }
}
