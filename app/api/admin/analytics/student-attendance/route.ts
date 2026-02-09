import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET: Per-student attendance data
 * Query params: cohort_id (required), user_id (optional for single student)
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
    const userId = searchParams.get('user_id');

    if (!cohortId) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
    }

    // Get countable sessions for this cohort
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, title, scheduled_at, duration_minutes, actual_duration_minutes')
      .eq('counts_for_students', true)
      .eq('cohort_id', cohortId)
      .lt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ students: [], sessions: [] });
    }

    const sessionIds = sessions.map((s) => s.id);

    // Get students in this cohort — check both role_assignments and legacy profiles
    let raQuery = supabase
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student')
      .eq('cohort_id', cohortId);

    let profileQuery = supabase
      .from('profiles')
      .select('id')
      .eq('role', 'student')
      .eq('cohort_id', cohortId);

    if (userId) {
      raQuery = raQuery.eq('user_id', userId);
      profileQuery = profileQuery.eq('id', userId);
    }

    const [{ data: raStudents }, { data: profileStudents }] = await Promise.all([
      raQuery,
      profileQuery,
    ]);

    const studentIds = [...new Set([
      ...(raStudents?.map(s => s.user_id) ?? []),
      ...(profileStudents?.map(s => s.id) ?? []),
    ])];

    if (studentIds.length === 0) {
      return NextResponse.json({ students: [], sessions });
    }

    // Get profiles for these students
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', studentIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    // Get all attendance records for these sessions and students
    const { data: attendanceRecords } = await supabase
      .from('attendance')
      .select('id, session_id, user_id, attendance_percentage, duration_seconds, join_time, leave_time')
      .in('session_id', sessionIds)
      .in('user_id', studentIds);

    // Get segments for these attendance records
    const attendanceIds = (attendanceRecords || []).map((a) => a.id);
    const { data: segments } = attendanceIds.length > 0
      ? await supabase
          .from('attendance_segments')
          .select('attendance_id, join_time, leave_time, duration_seconds')
          .in('attendance_id', attendanceIds)
      : { data: [] };

    const segmentsByAttendanceId = new Map<string, typeof segments>();
    for (const seg of segments || []) {
      const existing = segmentsByAttendanceId.get(seg.attendance_id) || [];
      existing.push(seg);
      segmentsByAttendanceId.set(seg.attendance_id, existing);
    }

    // Build per-student data
    const students = studentIds.map((sid) => {
      const profile = profileMap.get(sid);
      const studentAttendance = (attendanceRecords || []).filter((a) => a.user_id === sid);

      const sessionsAttended = studentAttendance.length;
      const avgPercentage =
        sessionsAttended > 0
          ? Math.round(
              (studentAttendance.reduce((sum, a) => sum + (a.attendance_percentage || 0), 0) /
                sessionsAttended) *
                100
            ) / 100
          : 0;

      const sessionDetails = sessions.map((session) => {
        const attendance = studentAttendance.find((a) => a.session_id === session.id);
        const attendanceSegments = attendance
          ? segmentsByAttendanceId.get(attendance.id) || []
          : [];

        return {
          sessionId: session.id,
          title: session.title,
          date: session.scheduled_at,
          percentage: attendance?.attendance_percentage || 0,
          durationAttended: attendance?.duration_seconds
            ? Math.round(attendance.duration_seconds / 60)
            : 0,
          totalDuration: session.actual_duration_minutes || session.duration_minutes,
          attended: !!attendance,
          segments: attendanceSegments.map((seg) => ({
            join: seg.join_time,
            leave: seg.leave_time,
            duration: seg.duration_seconds ? Math.round(seg.duration_seconds / 60) : 0,
          })),
        };
      });

      return {
        userId: sid,
        name: profile?.full_name || 'Unknown',
        email: profile?.email || '',
        avatarUrl: profile?.avatar_url || null,
        sessionsAttended,
        sessionsTotal: sessions.length,
        avgPercentage,
        sessions: sessionDetails,
      };
    });

    // Sort by name
    students.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ students, sessions });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student attendance' },
      { status: 500 }
    );
  }
}
