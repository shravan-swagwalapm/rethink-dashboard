import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'company_user';

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

// Helper to extract Google Drive ID from URL
function extractGoogleDriveId(url: string): string | null {
  if (!url) return null;

  // Match patterns like /d/{ID}/ or id={ID}
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /folders\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// GET - List case studies
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');
    const weekNumber = searchParams.get('week_number');

    const adminClient = await createAdminClient();

    let query = adminClient
      .from('case_studies')
      .select('*')
      .order('week_number', { ascending: true })
      .order('order_index', { ascending: true });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (weekNumber) {
      query = query.eq('week_number', parseInt(weekNumber));
    }

    const { data: caseStudies, error } = await query;

    if (error) throw error;

    return NextResponse.json({ caseStudies: caseStudies || [] });
  } catch (error) {
    console.error('Error fetching case studies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create case study
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const {
      cohort_id,
      week_number,
      title,
      description,
      problem_doc_url,
      solution_doc_url,
      solution_visible,
      due_date,
      order_index,
    } = body;

    if (!cohort_id || !week_number || !title) {
      return NextResponse.json(
        { error: 'cohort_id, week_number, and title are required' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    const { data: caseStudy, error } = await adminClient
      .from('case_studies')
      .insert({
        cohort_id,
        week_number,
        title,
        description: description || null,
        problem_doc_id: extractGoogleDriveId(problem_doc_url),
        problem_doc_url: problem_doc_url || null,
        solution_doc_id: extractGoogleDriveId(solution_doc_url),
        solution_doc_url: solution_doc_url || null,
        solution_visible: solution_visible || false,
        due_date: due_date || null,
        order_index: order_index || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ caseStudy });
  } catch (error) {
    console.error('Error creating case study:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update case study
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Case study ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.week_number !== undefined) updateData.week_number = updates.week_number;
    if (updates.problem_doc_url !== undefined) {
      updateData.problem_doc_url = updates.problem_doc_url;
      updateData.problem_doc_id = extractGoogleDriveId(updates.problem_doc_url);
    }
    if (updates.solution_doc_url !== undefined) {
      updateData.solution_doc_url = updates.solution_doc_url;
      updateData.solution_doc_id = extractGoogleDriveId(updates.solution_doc_url);
    }
    if (updates.solution_visible !== undefined) updateData.solution_visible = updates.solution_visible;
    if (updates.due_date !== undefined) updateData.due_date = updates.due_date;
    if (updates.order_index !== undefined) updateData.order_index = updates.order_index;

    const { data: caseStudy, error } = await adminClient
      .from('case_studies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ caseStudy });
  } catch (error) {
    console.error('Error updating case study:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete case study
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Case study ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('case_studies')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting case study:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
