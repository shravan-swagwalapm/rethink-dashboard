import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Fetch recently viewed resources (filtered by cohort)
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    const cohort_id = searchParams.get('cohort_id');

    // Fetch recent progress records with resource AND module details
    const { data: progressData, error: progressError } = await supabase
      .from('resource_progress')
      .select(`
        *,
        module_resources(
          *,
          learning_modules(cohort_id, is_global)
        )
      `)
      .eq('user_id', user.id)
      .not('last_viewed_at', 'is', null)
      .order('last_viewed_at', { ascending: false })
      .limit(limit * 3); // Fetch more than needed for filtering

    if (progressError) {
      console.error('Error fetching recent activity:', progressError);
      return NextResponse.json({ error: 'Failed to fetch recent activity' }, { status: 500 });
    }

    // Filter by cohort if provided
    let filteredProgress = progressData || [];

    if (cohort_id) {
      filteredProgress = filteredProgress.filter(p => {
        const module = p.module_resources?.learning_modules;
        if (!module) return false;

        // Include if module belongs to the active cohort
        if (module.cohort_id === cohort_id) return true;

        // Also include global modules (is_global = true)
        if (module.is_global) return true;

        return false;
      });
    }

    // Limit to requested amount after filtering
    filteredProgress = filteredProgress.slice(0, limit);

    // Transform data to include resource details
    const recentResources = filteredProgress.map(p => ({
      ...p.module_resources,
      progress: {
        is_completed: p.is_completed,
        progress_seconds: p.progress_seconds,
        last_viewed_at: p.last_viewed_at,
      }
    }));

    return NextResponse.json({ recent: recentResources });
  } catch (error) {
    console.error('Error in GET /api/learnings/recent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update last viewed timestamp
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resource_id } = body;

    if (!resource_id) {
      return NextResponse.json({ error: 'resource_id is required' }, { status: 400 });
    }

    // Upsert to update last_viewed_at
    const { data, error } = await supabase
      .from('resource_progress')
      .upsert({
        user_id: user.id,
        resource_id,
        last_viewed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,resource_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating last viewed:', error);
      return NextResponse.json({ error: 'Failed to update last viewed' }, { status: 500 });
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    console.error('Error in POST /api/learnings/recent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
