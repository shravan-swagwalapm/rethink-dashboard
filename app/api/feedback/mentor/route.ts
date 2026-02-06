import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - List feedback given by the current mentor
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const type = searchParams.get('type');
    const subgroupId = searchParams.get('subgroup_id');

    let query = supabase
      .from('mentor_feedback')
      .select('*, student:profiles!mentor_feedback_student_id_fkey(id, full_name, email, avatar_url), subgroup:subgroups(id, name)')
      .eq('mentor_id', user.id)
      .order('feedback_date', { ascending: false });

    if (studentId) query = query.eq('student_id', studentId);
    if (type) query = query.eq('type', type);
    if (subgroupId) query = query.eq('subgroup_id', subgroupId);

    const { data, error } = await query.limit(100);
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching mentor feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

// POST - Submit daily/weekly feedback
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { student_id, subgroup_id, type, rating, comment, week_number } = body;

    if (!student_id || !subgroup_id || !type || !rating) {
      return NextResponse.json({ error: 'student_id, subgroup_id, type, and rating are required' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    if (!['daily', 'weekly'].includes(type)) {
      return NextResponse.json({ error: 'Type must be daily or weekly' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mentor_feedback')
      .upsert({
        mentor_id: user.id,
        student_id,
        subgroup_id,
        type,
        rating,
        comment: comment || null,
        week_number: week_number || null,
        feedback_date: new Date().toISOString().split('T')[0],
      }, {
        onConflict: 'mentor_id,student_id,type,feedback_date',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error submitting mentor feedback:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
