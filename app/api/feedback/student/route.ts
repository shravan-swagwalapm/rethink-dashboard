import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - List feedback given by the current student
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('target_type');

    let query = supabase
      .from('student_feedback')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (targetType) query = query.eq('target_type', targetType);

    const { data, error } = await query.limit(100);
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching student feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

// POST - Submit mentor/session feedback
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { target_type, target_id, rating, comment, week_number } = body;

    if (!target_type || !target_id || !rating) {
      return NextResponse.json({ error: 'target_type, target_id, and rating are required' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('student_feedback')
      .upsert({
        student_id: user.id,
        target_type,
        target_id,
        rating,
        comment: comment || null,
        week_number: week_number || null,
      }, {
        onConflict: 'student_id,target_type,target_id,week_number',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error submitting student feedback:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
