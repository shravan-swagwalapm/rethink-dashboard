import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import type { StudentHealthStatus } from '@/types';

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
    case 'custom': {
      const fallbackStart = new Date();
      fallbackStart.setMonth(fallbackStart.getMonth() - 1);
      start = startDate ? new Date(startDate) : fallbackStart;
      end = endDate ? new Date(endDate) : new Date();
      break;
    }
    default:
      start = new Date(now);
      start.setDate(now.getDate() - 7);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function computeHealthStatus(lastLogin: string | null, completionPercent: number): StudentHealthStatus {
  const now = new Date();
  const daysSinceLogin = lastLogin
    ? Math.floor((now.getTime() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  if (daysSinceLogin <= 3 && completionPercent > 50) return 'active';
  if (daysSinceLogin <= 7 || (completionPercent >= 30 && completionPercent <= 50)) return 'at_risk';
  return 'inactive';
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohort_id');
  const period = searchParams.get('period') || 'week';
  const startDate = searchParams.get('start_date') || undefined;
  const endDate = searchParams.get('end_date') || undefined;

  if (!cohortId) {
    return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
  }

  const { start, end } = getDateRange(period, startDate, endDate);
  const adminClient = await createAdminClient();

  // Get students in this cohort
  const { data: roleAssignments } = await adminClient
    .from('user_role_assignments')
    .select('user_id')
    .eq('role', 'student')
    .eq('cohort_id', cohortId);

  const studentUserIds = (roleAssignments || []).map(ra => ra.user_id);

  if (studentUserIds.length === 0) {
    return NextResponse.json({
      logins_this_period: 0,
      active_students: 0,
      total_students: 0,
      at_risk_count: 0,
      content_completion_percent: 0,
      students: [],
      module_assets: [],
    });
  }

  // Parallel queries
  const [
    { data: profiles },
    { data: loginEvents },
    { data: lastLogins },
    { data: resourceProgress },
    { data: modules },
    { data: moduleResources },
  ] = await Promise.all([
    // Student profiles
    adminClient
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', studentUserIds),
    // Login events in period
    adminClient
      .from('login_events')
      .select('user_id, created_at')
      .in('user_id', studentUserIds)
      .gte('created_at', start)
      .lte('created_at', end),
    // Last login per student (most recent login regardless of period)
    adminClient
      .from('login_events')
      .select('user_id, created_at')
      .in('user_id', studentUserIds)
      .order('created_at', { ascending: false }),
    // Resource progress for these students
    adminClient
      .from('resource_progress')
      .select('user_id, resource_id, is_completed')
      .in('user_id', studentUserIds),
    // Modules linked to this cohort
    adminClient
      .from('cohort_module_links')
      .select('module_id, learning_modules(id, title, week_number)')
      .eq('cohort_id', cohortId),
    // All module resources
    adminClient
      .from('module_resources')
      .select('id, module_id, content_type'),
  ]);

  // Build profile map
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // Login counts per user in period
  const loginCountMap = new Map<string, number>();
  (loginEvents || []).forEach(l => {
    loginCountMap.set(l.user_id, (loginCountMap.get(l.user_id) || 0) + 1);
  });

  // Last login per user (from login_events)
  const lastLoginMap = new Map<string, string>();
  (lastLogins || []).forEach(l => {
    if (!lastLoginMap.has(l.user_id)) {
      lastLoginMap.set(l.user_id, l.created_at);
    }
  });

  // Fallback: for students with no login_events, check auth.users.last_sign_in_at
  const missingLoginUsers = studentUserIds.filter(uid => !lastLoginMap.has(uid));
  if (missingLoginUsers.length > 0) {
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });
    const authUserMap = new Map(authUsers.map(u => [u.id, u.last_sign_in_at]));
    missingLoginUsers.forEach(uid => {
      const authLastLogin = authUserMap.get(uid);
      if (authLastLogin) {
        lastLoginMap.set(uid, authLastLogin);
      }
    });
  }

  // Resource completion per user
  const completionMap = new Map<string, { completed: number; total: number }>();
  const moduleResourceIds = new Set((moduleResources || []).map(r => r.id));
  studentUserIds.forEach(uid => {
    const userProgress = (resourceProgress || []).filter(
      rp => rp.user_id === uid && moduleResourceIds.has(rp.resource_id)
    );
    const completed = userProgress.filter(rp => rp.is_completed).length;
    completionMap.set(uid, { completed, total: moduleResourceIds.size });
  });

  // Build student rows
  const students = studentUserIds.map(uid => {
    const profile = profileMap.get(uid);
    let loginCount = loginCountMap.get(uid) || 0;
    const lastLogin = lastLoginMap.get(uid) || null;
    // If login count is 0 but we have a fallback lastLogin within the period, count as 1
    if (loginCount === 0 && lastLogin && lastLogin >= start && lastLogin <= end) {
      loginCount = 1;
    }
    const completion = completionMap.get(uid) || { completed: 0, total: 0 };
    const completionPercent = completion.total > 0
      ? Math.round((completion.completed / completion.total) * 100)
      : 0;

    return {
      user_id: uid,
      name: profile?.full_name || 'Unknown',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url || null,
      login_count: loginCount,
      last_login: lastLogin,
      content_completion_percent: completionPercent,
      health_status: computeHealthStatus(lastLogin, completionPercent),
    };
  }).sort((a, b) => {
    // Sort: inactive first (needs attention), then at-risk, then active
    const order: Record<string, number> = { inactive: 0, at_risk: 1, active: 2 };
    return (order[a.health_status] ?? 2) - (order[b.health_status] ?? 2);
  });

  // Stat cards
  const loginsThisPeriod = (loginEvents || []).length;
  const activeStudents = students.filter(s => s.health_status === 'active').length;
  const atRiskCount = students.filter(s => s.health_status === 'at_risk').length;
  const avgCompletion = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.content_completion_percent, 0) / students.length)
    : 0;

  // Module asset breakdown
  const typeKeyMap: Record<string, string> = {
    video: 'videos', slides: 'slides', document: 'documents', link: 'links',
  };

  const moduleAssets = (modules || []).map(m => {
    const mod = Array.isArray(m.learning_modules) ? m.learning_modules[0] : m.learning_modules;
    if (!mod) return null;

    const modResources = (moduleResources || []).filter(r => r.module_id === mod.id);
    const assets: Record<string, { completed: number; total: number }> = {
      videos: { completed: 0, total: 0 },
      slides: { completed: 0, total: 0 },
      documents: { completed: 0, total: 0 },
      links: { completed: 0, total: 0 },
    };

    modResources.forEach(r => {
      const key = typeKeyMap[r.content_type || 'other'];
      if (key && assets[key]) {
        assets[key].total++;
        // Count unique students who completed this resource
        const completedCount = (resourceProgress || []).filter(
          rp => rp.resource_id === r.id && rp.is_completed
        ).length;
        assets[key].completed += completedCount;
      }
    });

    return {
      module_id: mod.id,
      module_name: mod.title,
      week_number: mod.week_number,
      ...assets,
    };
  }).filter(Boolean);

  return NextResponse.json({
    logins_this_period: loginsThisPeriod,
    active_students: activeStudents,
    total_students: studentUserIds.length,
    at_risk_count: atRiskCount,
    content_completion_percent: avgCompletion,
    students,
    module_assets: moduleAssets,
  });
}
