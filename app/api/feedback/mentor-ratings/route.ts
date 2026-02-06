import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Aggregate ratings for a mentor (visible to mentor themselves)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = await createAdminClient();

    const { data: feedback } = await adminClient
      .from('student_feedback')
      .select('rating, week_number, student_id')
      .eq('target_type', 'mentor')
      .eq('target_id', user.id);

    if (!feedback || feedback.length === 0) {
      return NextResponse.json({ data: { average_rating: 0, total_count: 0, by_week: [] } });
    }

    const total = feedback.reduce((sum, f) => sum + f.rating, 0);
    const average = total / feedback.length;

    const weekMap = new Map<number, { sum: number; count: number }>();
    for (const f of feedback) {
      if (f.week_number != null) {
        const w = weekMap.get(f.week_number) || { sum: 0, count: 0 };
        w.sum += f.rating;
        w.count++;
        weekMap.set(f.week_number, w);
      }
    }

    const byWeek = [...weekMap.entries()]
      .map(([week_number, { sum, count }]) => ({
        week_number,
        average_rating: Math.round((sum / count) * 10) / 10,
        count,
      }))
      .sort((a, b) => a.week_number - b.week_number);

    return NextResponse.json({
      data: {
        average_rating: Math.round(average * 10) / 10,
        total_count: feedback.length,
        by_week: byWeek,
      },
    });
  } catch (error) {
    console.error('Error fetching mentor ratings:', error);
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
  }
}
