import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Fetch user's progress for all resources
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('resource_progress')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching progress:', error);
      return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 });
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    console.error('Error in GET /api/learnings/progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Toggle resource completion or update progress
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resource_id, is_completed, progress_seconds } = body;

    if (!resource_id) {
      return NextResponse.json({ error: 'resource_id is required' }, { status: 400 });
    }

    // Check if progress record exists
    const { data: existing } = await supabase
      .from('resource_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('resource_id', resource_id)
      .maybeSingle();

    if (existing) {
      // Update existing record
      const updateData: any = {
        last_viewed_at: new Date().toISOString(),
      };

      if (typeof is_completed === 'boolean') {
        updateData.is_completed = is_completed;
      }

      if (typeof progress_seconds === 'number') {
        updateData.progress_seconds = progress_seconds;
      }

      const { data, error } = await supabase
        .from('resource_progress')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating progress:', error);
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
      }

      return NextResponse.json({ progress: data });
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('resource_progress')
        .insert({
          user_id: user.id,
          resource_id,
          is_completed: is_completed ?? false,
          progress_seconds: progress_seconds ?? 0,
          last_viewed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating progress:', error);
        return NextResponse.json({ error: 'Failed to create progress' }, { status: 500 });
      }

      return NextResponse.json({ progress: data });
    }
  } catch (error) {
    console.error('Error in POST /api/learnings/progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update video progress (current timestamp)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resource_id, progress_seconds } = body;

    if (!resource_id || typeof progress_seconds !== 'number') {
      return NextResponse.json(
        { error: 'resource_id and progress_seconds are required' },
        { status: 400 }
      );
    }

    // Upsert progress
    const { data, error } = await supabase
      .from('resource_progress')
      .upsert({
        user_id: user.id,
        resource_id,
        progress_seconds,
        last_viewed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,resource_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating video progress:', error);
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    console.error('Error in PATCH /api/learnings/progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
