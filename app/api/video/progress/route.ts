/**
 * Video Progress API Endpoint
 *
 * Handles saving and loading video progress for authenticated users
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/video/progress?resourceId=xxx
 *
 * Fetch progress for a specific video resource
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get('resourceId');

  if (!resourceId) {
    return NextResponse.json(
      { error: 'Missing resourceId parameter' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { data, error } = await supabase
      .from('video_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('resource_id', resourceId)
      .single();

    if (error) {
      // PGRST116 is "not found" error, which is expected if no progress exists yet
      if (error.code === 'PGRST116') {
        return NextResponse.json({ progress: null });
      }
      throw error;
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    console.error('Error fetching video progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/video/progress
 *
 * Save or update video progress
 *
 * Body: {
 *   resourceId: string;
 *   positionSeconds: number;
 *   watchPercentage: number;
 *   completed?: boolean;
 * }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { resourceId, positionSeconds, watchPercentage, completed } = body;

    if (!resourceId) {
      return NextResponse.json(
        { error: 'Missing resourceId' },
        { status: 400 }
      );
    }

    // Validate numbers
    if (typeof positionSeconds !== 'number' || positionSeconds < 0) {
      return NextResponse.json(
        { error: 'Invalid positionSeconds' },
        { status: 400 }
      );
    }

    if (typeof watchPercentage !== 'number' || watchPercentage < 0 || watchPercentage > 100) {
      return NextResponse.json(
        { error: 'Invalid watchPercentage (must be 0-100)' },
        { status: 400 }
      );
    }

    // Prepare upsert data
    const progressData: any = {
      user_id: user.id,
      resource_id: resourceId,
      last_position_seconds: Math.floor(positionSeconds),
      watch_percentage: Math.round(watchPercentage * 100) / 100,
      last_watched_at: new Date().toISOString(),
    };

    // If explicitly marking as completed
    if (completed === true) {
      progressData.completed = true;
      progressData.completed_at = new Date().toISOString();
      progressData.watch_percentage = 100;
    }

    const { data, error } = await supabase
      .from('video_progress')
      .upsert(progressData, {
        onConflict: 'user_id,resource_id',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      progress: data,
    });
  } catch (error) {
    console.error('Error saving video progress:', error);
    return NextResponse.json(
      { error: 'Failed to save progress' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/video/progress?resourceId=xxx
 *
 * Delete progress for a specific video resource (reset)
 */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get('resourceId');

  if (!resourceId) {
    return NextResponse.json(
      { error: 'Missing resourceId parameter' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { error } = await supabase
      .from('video_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('resource_id', resourceId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting video progress:', error);
    return NextResponse.json(
      { error: 'Failed to delete progress' },
      { status: 500 }
    );
  }
}
