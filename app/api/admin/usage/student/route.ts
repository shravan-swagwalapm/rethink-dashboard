import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import type { StudentHealthStatus } from '@/types';

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
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const adminClient = await createAdminClient();

  // Parallel queries
  const [
    { data: profile },
    { data: roleAssignment },
    { data: loginHistory },
    { data: resourceProgress },
    { data: moduleResources },
    { data: recentViewed },
  ] = await Promise.all([
    // Profile
    adminClient
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', userId)
      .single(),
    // Cohort from role assignment
    adminClient
      .from('user_role_assignments')
      .select('cohort_id, cohorts(id, name)')
      .eq('user_id', userId)
      .eq('role', 'student')
      .maybeSingle(),
    // Login history (last 50)
    adminClient
      .from('login_events')
      .select('created_at, login_method')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    // Resource progress
    adminClient
      .from('resource_progress')
      .select('resource_id, is_completed, last_viewed_at')
      .eq('user_id', userId),
    // All module resources with module info
    adminClient
      .from('module_resources')
      .select('id, title, module_id, resource_type, learning_modules(id, title, week_number)')
      .order('created_at', { ascending: false }),
    // Recent activity (last 20 viewed resources)
    adminClient
      .from('resource_progress')
      .select('resource_id, is_completed, last_viewed_at')
      .eq('user_id', userId)
      .not('last_viewed_at', 'is', null)
      .order('last_viewed_at', { ascending: false })
      .limit(20),
  ]);

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const cohortRaw = roleAssignment?.cohorts as { name: string } | { name: string }[] | null | undefined;
  const cohortName = Array.isArray(cohortRaw) ? cohortRaw[0]?.name : cohortRaw?.name;

  // Total logins
  const totalLogins = (loginHistory || []).length;
  const lastLogin = loginHistory?.[0]?.created_at || null;

  // Module engagement
  const resourceMap = new Map((moduleResources || []).map(r => [r.id, r]));
  const progressMap = new Map((resourceProgress || []).map(rp => [rp.resource_id, rp]));

  const moduleMap = new Map<string, { id: string; title: string; week_number: number | null; completed: number; total: number }>();
  (moduleResources || []).forEach(r => {
    const mod = Array.isArray(r.learning_modules) ? r.learning_modules[0] : r.learning_modules;
    if (!mod) return;

    if (!moduleMap.has(mod.id)) {
      moduleMap.set(mod.id, { id: mod.id, title: mod.title, week_number: mod.week_number, completed: 0, total: 0 });
    }
    const entry = moduleMap.get(mod.id)!;
    entry.total++;
    const progress = progressMap.get(r.id);
    if (progress?.is_completed) {
      entry.completed++;
    }
  });

  const moduleEngagement = Array.from(moduleMap.values()).map(m => ({
    module_id: m.id,
    module_name: m.title,
    week_number: m.week_number,
    completed: m.completed,
    total: m.total,
    percent: m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0,
  })).sort((a, b) => (a.week_number || 0) - (b.week_number || 0));

  // Content completion
  const totalResources = moduleMap.size > 0
    ? Array.from(moduleMap.values()).reduce((sum, m) => sum + m.total, 0)
    : 0;
  const totalCompleted = moduleMap.size > 0
    ? Array.from(moduleMap.values()).reduce((sum, m) => sum + m.completed, 0)
    : 0;
  const contentCompletionPercent = totalResources > 0
    ? Math.round((totalCompleted / totalResources) * 100)
    : 0;

  // Recent activity
  const typeDisplayMap: Record<string, string> = {
    video: 'video_watched',
    case_study: 'case_study_opened',
    presentation: 'presentation_viewed',
    pdf: 'pdf_opened',
  };

  const recentActivity = (recentViewed || []).map(rv => {
    const resource = resourceMap.get(rv.resource_id);
    const resourceType = resource?.resource_type || 'other';
    return {
      type: rv.is_completed ? 'resource_completed' : (typeDisplayMap[resourceType] || 'pdf_opened'),
      title: resource?.title || 'Unknown Resource',
      timestamp: rv.last_viewed_at,
      detail: rv.is_completed ? 'Completed' : undefined,
    };
  });

  return NextResponse.json({
    user_id: userId,
    name: profile.full_name || 'Unknown',
    email: profile.email || '',
    avatar_url: profile.avatar_url || null,
    cohort_name: cohortName || 'No cohort',
    last_login: lastLogin,
    total_logins: totalLogins,
    content_completion_percent: contentCompletionPercent,
    health_status: computeHealthStatus(lastLogin, contentCompletionPercent),
    login_history: (loginHistory || []).map(l => ({
      created_at: l.created_at,
      login_method: l.login_method,
    })),
    module_engagement: moduleEngagement,
    recent_activity: recentActivity,
  });
}
