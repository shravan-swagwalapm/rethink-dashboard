import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    // Fetch all stats in parallel
    const [
      { count: totalUsers },
      { count: totalStudents },
      { count: totalMentors },
      { count: activeCohorts },
      { count: upcomingSessions },
      { count: openTickets },
      { data: attendance },
    ] = await Promise.all([
      adminClient.from('profiles').select('*', { count: 'exact', head: true }),
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
      adminClient.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'mentor'),
      adminClient.from('cohorts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      adminClient.from('sessions').select('*', { count: 'exact', head: true }).gte('scheduled_at', new Date().toISOString()),
      adminClient.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      adminClient.from('attendance').select('attendance_percentage'),
    ]);

    const avgAttendance = attendance?.length
      ? Math.round(
          attendance.reduce((acc: number, a: { attendance_percentage: number | null }) => acc + (a.attendance_percentage || 0), 0) / attendance.length
        )
      : 0;

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalStudents: totalStudents || 0,
      totalMentors: totalMentors || 0,
      activeCohorts: activeCohorts || 0,
      upcomingSessions: upcomingSessions || 0,
      openTickets: openTickets || 0,
      avgAttendance,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
