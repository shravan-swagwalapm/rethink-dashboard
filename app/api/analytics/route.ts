import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * GET: Attendance data for the authenticated user.
 * - Default: Student's own attendance
 * - ?view=mentor: Team attendance (all students in mentor's cohort)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminClient = await createAdminClient();
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    // Get the user's role assignments
    const { data: roleAssignments } = await adminClient
      .from('user_role_assignments')
      .select('role, cohort_id')
      .eq('user_id', user.id);

    const studentRole = roleAssignments?.find((r) => r.role === 'student');
    const mentorRole = roleAssignments?.find((r) => r.role === 'mentor');

    // Mentor view — return team attendance data
    if (view === 'mentor' && mentorRole) {
      return await getMentorTeamAttendance(adminClient, mentorRole.cohort_id);
    }

    // Student leaderboard — cohort-wide attendance for ranking table
    if (view === 'leaderboard' && studentRole?.cohort_id) {
      return await getLeaderboard(adminClient, user.id, studentRole.cohort_id);
    }

    // Student view — return own attendance
    const cohortId = studentRole?.cohort_id || mentorRole?.cohort_id;

    if (!cohortId) {
      return NextResponse.json({ attendance: [], stats: null, sessions: [] });
    }

    return await getStudentOwnAttendance(adminClient, user.id, cohortId);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance data' },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getStudentOwnAttendance(supabase: any, userId: string, cohortId: string) {
  // Get countable sessions for the cohort
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, scheduled_at, duration_minutes, actual_duration_minutes')
    .eq('counts_for_students', true)
    .eq('cohort_id', cohortId)
    .lt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ attendance: [], stats: null, sessions: [] });
  }

  const sessionIds = sessions.map((s: { id: string }) => s.id);

  // Get attendance records for this user
  const { data: attendanceRecords } = await supabase
    .from('attendance')
    .select('id, session_id, attendance_percentage, duration_seconds, join_time, leave_time')
    .in('session_id', sessionIds)
    .eq('user_id', userId);

  // Get segments
  const attendanceIds = (attendanceRecords || []).map((a: { id: string }) => a.id);
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

  // Build attendance data
  const attendance = sessions.map((session: { id: string; title: string; scheduled_at: string; actual_duration_minutes: number | null; duration_minutes: number }) => {
    const record = attendanceRecords?.find((a: { session_id: string }) => a.session_id === session.id);
    const recordSegments = record ? segmentsByAttendanceId.get(record.id) || [] : [];

    return {
      sessionId: session.id,
      title: session.title,
      date: session.scheduled_at,
      totalDuration: session.actual_duration_minutes || session.duration_minutes,
      attended: !!record,
      percentage: record?.attendance_percentage || 0,
      durationAttended: record?.duration_seconds
        ? Math.round(record.duration_seconds / 60)
        : 0,
      joinCount: recordSegments.length,
      segments: recordSegments.map((seg: { join_time: string; leave_time: string; duration_seconds: number | null }) => ({
        join: seg.join_time,
        leave: seg.leave_time,
        duration: seg.duration_seconds ? Math.round(seg.duration_seconds / 60) : 0,
      })),
    };
  });

  // Calculate stats
  const attendedSessions = attendance.filter((a: { attended: boolean }) => a.attended);
  const avgPercentage =
    attendedSessions.length > 0
      ? Math.round(
          (attendedSessions.reduce((sum: number, a: { percentage: number }) => sum + a.percentage, 0) /
            attendedSessions.length) *
            100
        ) / 100
      : 0;

  const totalMinutes = attendedSessions.reduce(
    (sum: number, a: { durationAttended: number }) => sum + a.durationAttended,
    0
  );

  const stats = {
    overallPercentage: avgPercentage,
    sessionsAttended: attendedSessions.length,
    sessionsTotal: sessions.length,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
  };

  return NextResponse.json({ attendance, stats, sessions });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMentorTeamAttendance(supabase: any, cohortId: string | null) {
  if (!cohortId) {
    return NextResponse.json({ students: [], sessions: [] });
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

  const sessionIds = sessions.map((s: { id: string }) => s.id);

  // Get students in this cohort
  const { data: studentAssignments } = await supabase
    .from('user_role_assignments')
    .select('user_id')
    .eq('role', 'student')
    .eq('cohort_id', cohortId);

  const studentIds = (studentAssignments || []).map((s: { user_id: string }) => s.user_id);

  if (studentIds.length === 0) {
    return NextResponse.json({ students: [], sessions });
  }

  // Get profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', studentIds);

  const profileMap = new Map(
    (profiles || []).map((p: { id: string; full_name: string; email: string; avatar_url: string | null }) => [p.id, p])
  );

  // Get all attendance records
  const { data: attendanceRecords } = await supabase
    .from('attendance')
    .select('id, session_id, user_id, attendance_percentage, duration_seconds, join_time, leave_time')
    .in('session_id', sessionIds)
    .in('user_id', studentIds);

  // Get segments
  const attendanceIds = (attendanceRecords || []).map((a: { id: string }) => a.id);
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
  const students = studentIds.map((sid: string) => {
    const profile = profileMap.get(sid) as { id: string; full_name: string; email: string; avatar_url: string | null } | undefined;
    const studentAttendance = (attendanceRecords || []).filter((a: { user_id: string }) => a.user_id === sid);

    const sessionsAttended = studentAttendance.length;
    const avgPercentage =
      sessionsAttended > 0
        ? Math.round(
            (studentAttendance.reduce((sum: number, a: { attendance_percentage: number }) => sum + (a.attendance_percentage || 0), 0) /
              sessionsAttended) *
              100
          ) / 100
        : 0;

    const sessionDetails = sessions.map((session: { id: string; title: string; scheduled_at: string; actual_duration_minutes: number | null; duration_minutes: number }) => {
      const attendance = studentAttendance.find((a: { session_id: string }) => a.session_id === session.id);
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
        segments: (attendanceSegments as { join_time: string; leave_time: string; duration_seconds: number | null }[]).map((seg) => ({
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

  students.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

  return NextResponse.json({ students, sessions });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLeaderboard(supabase: any, _currentUserId: string, cohortId: string) {
  // Get countable sessions for this cohort
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, scheduled_at, duration_minutes, actual_duration_minutes')
    .eq('counts_for_students', true)
    .eq('cohort_id', cohortId)
    .lt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ leaderboard: [], sessions: [], cohortAvg: 0 });
  }

  const sessionIds = sessions.map((s: { id: string }) => s.id);

  // Get all students in this cohort
  const { data: studentAssignments } = await supabase
    .from('user_role_assignments')
    .select('user_id')
    .eq('role', 'student')
    .eq('cohort_id', cohortId);

  const studentIds = (studentAssignments || []).map((s: { user_id: string }) => s.user_id);

  if (studentIds.length === 0) {
    return NextResponse.json({ leaderboard: [], sessions, cohortAvg: 0 });
  }

  // Get profiles for names/avatars
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', studentIds);

  const profileMap = new Map(
    (profiles || []).map((p: { id: string; full_name: string; avatar_url: string | null }) => [p.id, p])
  );

  // Get all attendance records for these sessions and students
  const { data: attendanceRecords } = await supabase
    .from('attendance')
    .select('session_id, user_id, attendance_percentage')
    .in('session_id', sessionIds)
    .in('user_id', studentIds);

  // Build per-student leaderboard entries
  const leaderboard = studentIds.map((sid: string) => {
    const profile = profileMap.get(sid) as { id: string; full_name: string; avatar_url: string | null } | undefined;
    const studentRecords = (attendanceRecords || []).filter((a: { user_id: string }) => a.user_id === sid);

    const sessionsAttended = studentRecords.length;
    const avgPercentage =
      sessionsAttended > 0
        ? Math.round(
            (studentRecords.reduce((sum: number, a: { attendance_percentage: number }) => sum + (a.attendance_percentage || 0), 0) /
              sessionsAttended) *
              100
          ) / 100
        : 0;

    // Per-session percentages (for session filter)
    const sessionPercentages: Record<string, number> = {};
    for (const record of studentRecords) {
      sessionPercentages[(record as { session_id: string }).session_id] = (record as { attendance_percentage: number }).attendance_percentage || 0;
    }

    return {
      userId: sid,
      name: profile?.full_name || 'Unknown',
      avatarUrl: profile?.avatar_url || null,
      avgPercentage,
      sessionsAttended,
      sessionsTotal: sessions.length,
      sessionPercentages,
    };
  });

  // Sort by overall avgPercentage descending
  leaderboard.sort((a: { avgPercentage: number }, b: { avgPercentage: number }) => b.avgPercentage - a.avgPercentage);

  // Compute cohort average
  const cohortAvg =
    leaderboard.length > 0
      ? Math.round(
          (leaderboard.reduce((sum: number, s: { avgPercentage: number }) => sum + s.avgPercentage, 0) /
            leaderboard.length) *
            100
        ) / 100
      : 0;

  // Session list for filter dropdown
  const sessionList = sessions.map((s: { id: string; title: string; scheduled_at: string }) => ({
    id: s.id,
    title: s.title,
    date: s.scheduled_at,
  }));

  return NextResponse.json({ leaderboard, sessions: sessionList, cohortAvg });
}
