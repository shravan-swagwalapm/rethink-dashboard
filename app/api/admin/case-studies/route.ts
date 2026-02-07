import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// GET - List case studies with solutions
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

    const csList = caseStudies || [];

    // Fetch solutions for all returned case studies
    if (csList.length > 0) {
      const ids = csList.map((cs) => cs.id);

      const { data: solutions, error: solError } = await adminClient
        .from('case_study_solutions')
        .select('*, subgroups(name)')
        .in('case_study_id', ids)
        .order('order_index', { ascending: true });

      if (solError) {
        console.error('Error fetching solutions:', solError);
      }

      // Flatten subgroup_name and group solutions by case_study_id
      const solutionsByCs: Record<string, Array<Record<string, unknown>>> = {};
      for (const sol of solutions || []) {
        const { subgroups, ...rest } = sol as Record<string, unknown> & { subgroups?: { name: string } | null };
        const mapped = {
          ...rest,
          subgroup_name: subgroups?.name || null,
        };
        const csId = rest.case_study_id as string;
        if (!solutionsByCs[csId]) solutionsByCs[csId] = [];
        solutionsByCs[csId].push(mapped);
      }

      // Attach solutions to each case study
      const enriched = csList.map((cs) => ({
        ...cs,
        solutions: solutionsByCs[cs.id] || [],
      }));

      return NextResponse.json({ caseStudies: enriched });
    }

    return NextResponse.json({ caseStudies: [] });
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
      problem_file_path,
      problem_file_size,
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
        problem_file_path: problem_file_path || null,
        problem_file_size: problem_file_size || null,
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
    if (updates.problem_file_path !== undefined) updateData.problem_file_path = updates.problem_file_path;
    if (updates.problem_file_size !== undefined) updateData.problem_file_size = updates.problem_file_size;
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

// DELETE - Delete case study and clean up storage files
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

    // Fetch case study's problem file path
    const { data: caseStudy, error: csError } = await adminClient
      .from('case_studies')
      .select('problem_file_path')
      .eq('id', id)
      .single();

    if (csError) throw csError;

    // Fetch all solution file paths for this case study
    const { data: solutions, error: solError } = await adminClient
      .from('case_study_solutions')
      .select('file_path')
      .eq('case_study_id', id);

    if (solError) {
      console.error('Error fetching solutions for deletion:', solError);
    }

    // Collect all files to delete from storage
    const filesToDelete: string[] = [];

    if (caseStudy?.problem_file_path) {
      filesToDelete.push(caseStudy.problem_file_path);
    }

    if (solutions) {
      for (const sol of solutions) {
        if (sol.file_path) {
          filesToDelete.push(sol.file_path);
        }
      }
    }

    // Delete files from Supabase Storage
    if (filesToDelete.length > 0) {
      const { error: storageError } = await adminClient.storage
        .from('resources')
        .remove(filesToDelete);

      if (storageError) {
        console.error('Error deleting storage files:', storageError);
        // Continue with DB deletion even if storage cleanup fails
      }
    }

    // Delete the case study (cascades to solutions via FK)
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
