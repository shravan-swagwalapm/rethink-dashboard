import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';

function getDateRange(period: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      break;
    case 'custom':
      start = startDate ? new Date(startDate) : new Date(now.setMonth(now.getMonth() - 1));
      end = endDate ? new Date(endDate) : new Date();
      break;
    default:
      start = new Date(now);
      start.setDate(now.getDate() - 7);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function getPreviousPeriodRange(period: string, currentStart: string, currentEnd: string) {
  const start = new Date(currentStart);
  const end = new Date(currentEnd);
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - duration);
  return { start: prevStart.toISOString(), end: prevEnd.toISOString() };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || 'week';
  const startDate = searchParams.get('start_date') || undefined;
  const endDate = searchParams.get('end_date') || undefined;

  const { start, end } = getDateRange(period, startDate, endDate);
  const prev = getPreviousPeriodRange(period, start, end);

  const adminClient = await createAdminClient();

  // Parallel queries
  const [
    { count: totalLogins },
    { count: prevLogins },
    { data: allStudents },
    { data: loginsByUser },
    { data: dailyLogins },
    { data: resourceProgress },
    { data: moduleResources },
  ] = await Promise.all([
    // Current period logins
    adminClient
      .from('login_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', end),
    // Previous period logins (for % change)
    adminClient
      .from('login_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', prev.start)
      .lte('created_at', prev.end),
    // All students (from role assignments)
    adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student'),
    // Logins grouped by user in period
    adminClient
      .from('login_events')
      .select('user_id')
      .gte('created_at', start)
      .lte('created_at', end),
    // Daily login counts for trend chart
    adminClient
      .from('login_events')
      .select('created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
    // All resource progress (completions)
    adminClient
      .from('resource_progress')
      .select('user_id, resource_id, is_completed'),
    // All module resources with type info
    adminClient
      .from('module_resources')
      .select('id, resource_type'),
  ]);

  const studentIds = new Set((allStudents || []).map(s => s.user_id));
  const totalStudents = studentIds.size;

  // Active students = unique students who logged in this period
  const activeStudentIds = new Set(
    (loginsByUser || [])
      .filter(l => studentIds.has(l.user_id))
      .map(l => l.user_id)
  );
  const activeStudents = activeStudentIds.size;

  // Avg logins per student
  const avgLoginsPerStudent = totalStudents > 0
    ? Math.round(((totalLogins || 0) / totalStudents) * 10) / 10
    : 0;

  // Daily login trend
  const trendMap = new Map<string, number>();
  (dailyLogins || []).forEach(l => {
    const day = new Date(l.created_at).toISOString().split('T')[0];
    trendMap.set(day, (trendMap.get(day) || 0) + 1);
  });
  const dailyLoginTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

  // Content completion
  const resourceTypeMap = new Map<string, string>();
  (moduleResources || []).forEach(r => {
    resourceTypeMap.set(r.id, r.resource_type || 'other');
  });

  const assetCounts = { videos: { completed: 0, total: 0 }, case_studies: { completed: 0, total: 0 }, presentations: { completed: 0, total: 0 }, pdfs: { completed: 0, total: 0 } };
  const typeKeyMap: Record<string, keyof typeof assetCounts> = {
    video: 'videos', case_study: 'case_studies', presentation: 'presentations', pdf: 'pdfs',
  };

  // Count per student per resource (only students)
  const studentProgress = (resourceProgress || []).filter(rp => studentIds.has(rp.user_id));
  const seenResources = new Set<string>();
  (moduleResources || []).forEach(r => {
    const type = r.resource_type || 'other';
    const key = typeKeyMap[type];
    if (key && !seenResources.has(r.id)) {
      seenResources.add(r.id);
      assetCounts[key].total++;
    }
  });
  studentProgress.forEach(rp => {
    const type = resourceTypeMap.get(rp.resource_id);
    const key = type ? typeKeyMap[type] : undefined;
    if (key && rp.is_completed) {
      assetCounts[key].completed++;
    }
  });

  // Overall content completion %
  const totalResources = Object.values(assetCounts).reduce((sum, a) => sum + a.total, 0);
  const totalCompleted = Object.values(assetCounts).reduce((sum, a) => sum + a.completed, 0);
  const contentCompletionPercent = totalResources > 0
    ? Math.round((totalCompleted / (totalResources * totalStudents)) * 100)
    : 0;

  // Cohort rankings
  const { data: cohorts } = await adminClient
    .from('cohorts')
    .select('id, name')
    .eq('status', 'active');

  const { data: allRoleAssignments } = await adminClient
    .from('user_role_assignments')
    .select('user_id, cohort_id')
    .eq('role', 'student');

  const cohortRankings = (cohorts || []).map(cohort => {
    const cohortStudentIds = (allRoleAssignments || [])
      .filter(ra => ra.cohort_id === cohort.id)
      .map(ra => ra.user_id);
    const cohortActive = cohortStudentIds.filter(id => activeStudentIds.has(id)).length;
    const cohortTotal = cohortStudentIds.length;
    return {
      cohort_id: cohort.id,
      cohort_name: cohort.name,
      engagement_percent: cohortTotal > 0 ? Math.round((cohortActive / cohortTotal) * 100) : 0,
      active_count: cohortActive,
      total_count: cohortTotal,
    };
  }).sort((a, b) => b.engagement_percent - a.engagement_percent);

  return NextResponse.json({
    total_logins: totalLogins || 0,
    previous_period_logins: prevLogins || 0,
    active_students: activeStudents,
    total_students: totalStudents,
    avg_logins_per_student: avgLoginsPerStudent,
    content_completion_percent: contentCompletionPercent,
    cohort_rankings: cohortRankings,
    daily_login_trend: dailyLoginTrend,
    asset_summary: assetCounts,
  });
}
