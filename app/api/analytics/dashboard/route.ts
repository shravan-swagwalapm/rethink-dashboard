import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*, cohort:cohorts(*)')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    if (!profile.cohort_id) {
      return NextResponse.json({
        total_students: 0,
        attendance_percentage: 0,
        current_rank: null,
        upcoming_sessions: 0,
      });
    }

    // Fetch stats in parallel
    const [
      { count: totalStudents },
      { data: attendanceData },
      { data: ranking },
      { count: upcomingSessions },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('cohort_id', profile.cohort_id)
        .eq('role', 'student'),
      supabase
        .from('attendance')
        .select('attendance_percentage')
        .eq('user_id', user.id),
      supabase
        .from('rankings')
        .select('rank')
        .eq('user_id', user.id)
        .eq('cohort_id', profile.cohort_id)
        .single(),
      supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('cohort_id', profile.cohort_id)
        .gte('scheduled_at', new Date().toISOString()),
    ]);

    // Calculate average attendance
    const avgAttendance = attendanceData?.length
      ? Math.round(
          attendanceData.reduce((acc, a) => acc + (a.attendance_percentage || 0), 0) /
            attendanceData.length
        )
      : 0;

    return NextResponse.json({
      total_students: totalStudents || 0,
      attendance_percentage: avgAttendance,
      current_rank: ranking?.rank || null,
      upcoming_sessions: upcomingSessions || 0,
    });
  } catch (error: unknown) {
    console.error('Error fetching dashboard stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
