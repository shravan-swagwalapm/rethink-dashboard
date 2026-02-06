import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Aggregate ratings received by a student from mentors
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: feedback } = await supabase
      .from('mentor_feedback')
      .select('rating, week_number, type')
      .eq('student_id', user.id);

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
    console.error('Error fetching student ratings:', error);
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
  }
}
