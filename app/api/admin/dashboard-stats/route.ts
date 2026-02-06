import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = await createClient();

  try {
    // Get total students (all users with student role or student role assignment)
    const { count: totalStudents } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get active cohorts
    const { count: activeCohorts } = await supabase
      .from('cohorts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get total cohorts (all statuses)
    const { count: totalCohorts } = await supabase
      .from('cohorts')
      .select('*', { count: 'exact', head: true });

    // Get total sessions
    const { count: totalSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true });

    // Get upcoming sessions count
    const { count: upcomingSessionsCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .gte('scheduled_at', new Date().toISOString());

    // Get total learnings
    const { count: totalLearnings } = await supabase
      .from('learnings')
      .select('*', { count: 'exact', head: true });

    // Get upcoming sessions across all cohorts (with details)
    const { data: upcomingSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        title,
        scheduled_at,
        duration_minutes,
        meeting_url,
        cohort_id,
        cohort:cohorts(id, name, tag)
      `)
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (sessionsError) {
      console.error('Error fetching upcoming sessions:', sessionsError);
    }

    // Get recent learnings across all cohorts
    const { data: recentLearnings, error: learningsError } = await supabase
      .from('learnings')
      .select(`
        id,
        title,
        type,
        cohort_id,
        created_at,
        cohort:cohorts(id, name, tag)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (learningsError) {
      console.error('Error fetching recent learnings:', learningsError);
    }

    return NextResponse.json({
      stats: {
        totalStudents: totalStudents || 0,
        activeCohorts: activeCohorts || 0,
        totalCohorts: totalCohorts || 0,
        totalSessions: totalSessions || 0,
        upcomingSessionsCount: upcomingSessionsCount || 0,
        totalLearnings: totalLearnings || 0,
      },
      upcomingSessions: upcomingSessions?.map(s => {
        const cohort = Array.isArray(s.cohort) ? s.cohort[0] : s.cohort;
        return {
          id: s.id,
          title: s.title,
          scheduled_at: s.scheduled_at,
          duration_minutes: s.duration_minutes,
          meeting_url: s.meeting_url,
          cohortId: s.cohort_id,
          cohortName: cohort?.name || 'Unknown Cohort',
          cohortTag: cohort?.tag || '',
        };
      }) || [],
      recentLearnings: recentLearnings?.map(l => {
        const cohort = Array.isArray(l.cohort) ? l.cohort[0] : l.cohort;
        return {
          id: l.id,
          title: l.title,
          type: l.type,
          created_at: l.created_at,
          cohortId: l.cohort_id,
          cohortName: cohort?.name || 'Unknown Cohort',
          cohortTag: cohort?.tag || '',
        };
      }) || [],
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin dashboard stats' },
      { status: 500 }
    );
  }
}
