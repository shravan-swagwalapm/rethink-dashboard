import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohort_id'); // optional — omit for community-wide

  const adminClient = await createAdminClient();

  // Get relevant student IDs
  let studentUserIds: string[] = [];
  if (cohortId) {
    const { data: roleAssignments } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student')
      .eq('cohort_id', cohortId);
    studentUserIds = (roleAssignments || []).map(ra => ra.user_id);
  } else {
    const { data: allStudents } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student');
    studentUserIds = (allStudents || []).map(ra => ra.user_id);
  }

  if (studentUserIds.length === 0) {
    return NextResponse.json({ modules: [] });
  }

  type NormalizedModule = { id: string; title: string; week_number: number | null };

  // Get modules (cohort-scoped or all) and normalize inline to avoid union type issues
  const [{ data: moduleResources }, { data: resourceProgress }] = await Promise.all([
    adminClient.from('module_resources').select('id, module_id, content_type'),
    adminClient.from('resource_progress').select('user_id, resource_id, is_completed').in('user_id', studentUserIds),
  ]);

  let modules: NormalizedModule[] = [];
  if (cohortId) {
    const { data: cohortModulesData } = await adminClient
      .from('cohort_module_links')
      .select('module_id, learning_modules(id, title, week_number)')
      .eq('cohort_id', cohortId);
    modules = (cohortModulesData || []).flatMap(m => {
      const mod = Array.isArray(m.learning_modules) ? m.learning_modules[0] : m.learning_modules;
      return mod ? [{ id: mod.id, title: mod.title, week_number: mod.week_number }] : [];
    });
  } else {
    const { data: allModulesData } = await adminClient
      .from('learning_modules')
      .select('id, title, week_number');
    modules = (allModulesData || []).map(m => ({ id: m.id, title: m.title, week_number: m.week_number }));
  }

  const typeKeyMap: Record<string, string> = {
    video: 'videos', slides: 'slides', document: 'documents', link: 'links',
  };

  // Build completion count per resource
  const completionCountMap = new Map<string, number>();
  (resourceProgress || []).forEach(rp => {
    if (rp.is_completed) {
      completionCountMap.set(rp.resource_id, (completionCountMap.get(rp.resource_id) || 0) + 1);
    }
  });

  const result = modules.map(mod => {
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
        assets[key].completed += completionCountMap.get(r.id) || 0;
      }
    });

    return {
      module_id: mod.id,
      module_name: mod.title,
      week_number: mod.week_number,
      ...assets,
    };
  }).sort((a, b) => (a.week_number || 0) - (b.week_number || 0));

  return NextResponse.json({ modules: result });
}
