import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// GET - List solutions for a case study
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: caseStudyId } = await params;
    const adminClient = await createAdminClient();

    const { data: solutions, error } = await adminClient
      .from('case_study_solutions')
      .select('*, subgroups(name)')
      .eq('case_study_id', caseStudyId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    // Flatten subgroup_name
    const mapped = (solutions || []).map((sol) => {
      const { subgroups, ...rest } = sol as Record<string, unknown> & { subgroups?: { name: string } | null };
      return {
        ...rest,
        subgroup_name: subgroups?.name || null,
      };
    });

    return NextResponse.json({ solutions: mapped });
  } catch (error) {
    console.error('Error fetching solutions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new solution for a case study
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: caseStudyId } = await params;
    const body = await request.json();
    const { title, file_path, file_size, subgroup_id, order_index } = body;

    if (!title || !file_path) {
      return NextResponse.json(
        { error: 'title and file_path are required' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Verify the case study exists
    const { data: caseStudy, error: csError } = await adminClient
      .from('case_studies')
      .select('id')
      .eq('id', caseStudyId)
      .single();

    if (csError || !caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    const { data: solution, error } = await adminClient
      .from('case_study_solutions')
      .insert({
        case_study_id: caseStudyId,
        title,
        file_path,
        file_size: file_size || null,
        subgroup_id: subgroup_id || null,
        order_index: order_index || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ solution });
  } catch (error) {
    console.error('Error creating solution:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a solution's title or subgroup
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await params; // consume params even if not used directly
    const body = await request.json();
    const { solution_id, title, subgroup_id } = body;

    if (!solution_id) {
      return NextResponse.json({ error: 'solution_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (subgroup_id !== undefined) updateData.subgroup_id = subgroup_id;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: solution, error } = await adminClient
      .from('case_study_solutions')
      .update(updateData)
      .eq('id', solution_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ solution });
  } catch (error) {
    console.error('Error updating solution:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a solution and clean up its storage file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await params; // consume params
    const { searchParams } = new URL(request.url);
    const solutionId = searchParams.get('solution_id');

    if (!solutionId) {
      return NextResponse.json({ error: 'solution_id query param is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Fetch the solution's file_path before deleting
    const { data: solution, error: fetchError } = await adminClient
      .from('case_study_solutions')
      .select('file_path')
      .eq('id', solutionId)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
    }

    // Delete the file from storage
    if (solution?.file_path) {
      const { error: storageError } = await adminClient.storage
        .from('resources')
        .remove([solution.file_path]);

      if (storageError) {
        console.error('Error deleting solution file from storage:', storageError);
        // Continue with DB deletion
      }
    }

    // Delete the solution record
    const { error } = await adminClient
      .from('case_study_solutions')
      .delete()
      .eq('id', solutionId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting solution:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
