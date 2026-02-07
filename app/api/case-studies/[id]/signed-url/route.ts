import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/case-studies/[id]/signed-url?type=problem
 * GET /api/case-studies/[id]/signed-url?type=solution&solutionId=xxx
 *
 * Generates signed URLs for case study PDFs.
 * Admin users bypass cohort membership and solution_visible checks.
 * Students must belong to the case study's cohort.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth via user-scoped client
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseStudyId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'problem' or 'solution'
    const solutionId = searchParams.get('solutionId');

    if (!type || !['problem', 'solution'].includes(type)) {
      return NextResponse.json(
        { error: 'type query param must be "problem" or "solution"' },
        { status: 400 }
      );
    }

    // Data operations via admin client (bypasses RLS)
    const adminClient = await createAdminClient();

    // Fetch the case study
    const { data: caseStudy, error: csError } = await adminClient
      .from('case_studies')
      .select('id, cohort_id, problem_file_path, solution_visible')
      .eq('id', caseStudyId)
      .single();

    if (csError || !caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    // Check if user is an admin — admins skip the cohort membership check
    const { data: adminRole } = await adminClient
      .from('user_role_assignments')
      .select('id')
      .eq('user_id', user.id)
      .in('role', ['admin', 'company_user'])
      .limit(1)
      .maybeSingle();

    let isAdmin = !!adminRole;

    if (!isAdmin) {
      // Fallback: check legacy profiles.role
      const { data: adminProfile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (adminProfile?.role === 'admin' || adminProfile?.role === 'company_user') {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      // Verify user belongs to the case study's cohort via user_role_assignments
      const { data: roleAssignment } = await adminClient
        .from('user_role_assignments')
        .select('id')
        .eq('user_id', user.id)
        .eq('cohort_id', caseStudy.cohort_id)
        .limit(1)
        .maybeSingle();

      if (!roleAssignment) {
        // Fallback: check legacy profiles.cohort_id
        const { data: profile } = await adminClient
          .from('profiles')
          .select('cohort_id')
          .eq('id', user.id)
          .single();

        if (!profile?.cohort_id || profile.cohort_id !== caseStudy.cohort_id) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    let filePath: string | null = null;

    if (type === 'problem') {
      filePath = caseStudy.problem_file_path;

      if (!filePath) {
        return NextResponse.json({ error: 'No problem file uploaded' }, { status: 404 });
      }
    } else if (type === 'solution') {
      // Check that solutions are visible (admins can always access)
      if (!isAdmin && !caseStudy.solution_visible) {
        return NextResponse.json(
          { error: 'Solutions are not yet available' },
          { status: 403 }
        );
      }

      if (!solutionId) {
        return NextResponse.json(
          { error: 'solutionId query param is required for type=solution' },
          { status: 400 }
        );
      }

      // Fetch the solution record
      const { data: solution, error: solError } = await adminClient
        .from('case_study_solutions')
        .select('file_path')
        .eq('id', solutionId)
        .eq('case_study_id', caseStudyId)
        .single();

      if (solError || !solution) {
        return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
      }

      filePath = solution.file_path;

      if (!filePath) {
        return NextResponse.json({ error: 'No solution file uploaded' }, { status: 404 });
      }
    }

    // Generate signed URL (60 minutes for PDFs)
    const { data: signedUrl, error: signedError } = await adminClient.storage
      .from('resources')
      .createSignedUrl(filePath!, 3600);

    if (signedError || !signedUrl) {
      console.error('[CaseStudy SignedURL] Failed to generate:', signedError);
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: signedUrl.signedUrl });
  } catch (error) {
    console.error('Error generating case study signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
