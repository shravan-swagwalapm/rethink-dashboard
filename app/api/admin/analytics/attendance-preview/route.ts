import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET: Preview attendance data for a session before creating a cohort session.
 * Query params: sessionId (required)
 *
 * Returns matched participants (with profile data) and unmatched
 * participants (Zoom emails that couldn't be resolved to a user).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = await createAdminClient();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Fetch all attendance records for this session
    const { data: records, error } = await supabase
      .from('attendance')
      .select('id, user_id, zoom_user_email, attendance_percentage, duration_seconds, join_time, leave_time')
      .eq('session_id', sessionId)
      .order('attendance_percentage', { ascending: false, nullsFirst: false });

    if (error) {
      throw error;
    }

    if (!records || records.length === 0) {
      return NextResponse.json({
        matched: [],
        unmatched: [],
        summary: { total: 0, matched: 0, unmatched: 0, avgPercentage: 0 },
      });
    }

    // Collect user IDs for matched participants
    const userIds = records
      .filter((r) => r.user_id)
      .map((r) => r.user_id as string);

    // Batch-fetch profiles for all matched users
    const profileMap = new Map<string, { full_name: string; email: string; avatar_url: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      for (const p of profiles || []) {
        profileMap.set(p.id, p);
      }
    }

    // Split into matched and unmatched
    const matched: Array<{
      name: string;
      email: string;
      avatarUrl: string | null;
      percentage: number;
      durationMinutes: number;
      joinTime: string | null;
      leaveTime: string | null;
    }> = [];

    const unmatched: Array<{
      zoomEmail: string;
      percentage: number;
      durationMinutes: number;
      joinTime: string | null;
      leaveTime: string | null;
    }> = [];

    let totalPercentage = 0;

    for (const record of records) {
      const percentage = record.attendance_percentage ?? 0;
      const durationMinutes = record.duration_seconds
        ? Math.round(record.duration_seconds / 60)
        : 0;
      totalPercentage += percentage;

      if (record.user_id && profileMap.has(record.user_id)) {
        const profile = profileMap.get(record.user_id)!;
        matched.push({
          name: profile.full_name || 'Unknown',
          email: profile.email || '',
          avatarUrl: profile.avatar_url,
          percentage,
          durationMinutes,
          joinTime: record.join_time,
          leaveTime: record.leave_time,
        });
      } else {
        unmatched.push({
          zoomEmail: record.zoom_user_email || 'Unknown',
          percentage,
          durationMinutes,
          joinTime: record.join_time,
          leaveTime: record.leave_time,
        });
      }
    }

    const total = records.length;
    const avgPercentage = total > 0 ? Math.round(totalPercentage / total) : 0;

    return NextResponse.json({
      matched,
      unmatched,
      summary: {
        total,
        matched: matched.length,
        unmatched: unmatched.length,
        avgPercentage,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance preview:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance preview' },
      { status: 500 }
    );
  }
}
