import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');
    const type = searchParams.get('type'); // 'mentor_to_student' or 'student_to_mentor'

    const adminClient = await createAdminClient();

    if (type === 'student_to_mentor') {
      const query = adminClient
        .from('student_feedback')
        .select('*, student:profiles!student_feedback_student_id_fkey(id, full_name, email)')
        .eq('target_type', 'mentor')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json({ data: data || [] });
    }

    // Default: mentor_to_student feedback
    const query = adminClient
      .from('mentor_feedback')
      .select('*, mentor:profiles!mentor_feedback_mentor_id_fkey(id, full_name, email), student:profiles!mentor_feedback_student_id_fkey(id, full_name, email), subgroup:subgroups(id, name, cohort_id)')
      .order('feedback_date', { ascending: false })
      .limit(200);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by cohort if specified
    let filtered = data || [];
    if (cohortId) {
      filtered = filtered.filter((f: any) => f.subgroup?.cohort_id === cohortId);
    }

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error('Error fetching admin feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
