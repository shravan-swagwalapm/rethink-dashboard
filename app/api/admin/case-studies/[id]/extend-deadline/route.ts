import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * PUT /api/admin/case-studies/[id]/extend-deadline
 *
 * Extend deadline at cohort level OR per-subgroup.
 * Body: { due_date: ISO string, subgroup_id?: UUID }
 *
 * If subgroup_id provided: sets deadline_override on that submission.
 * If not: updates the case study's due_date for all subgroups.
 */
export async function PUT(
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
    const { due_date, subgroup_id } = body;

    if (!due_date) {
      return NextResponse.json({ error: 'due_date is required' }, { status: 400 });
    }

    // Validate date format
    const parsedDate = new Date(due_date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format for due_date' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    if (subgroup_id) {
      // Verify subgroup exists and belongs to this case study's cohort
      const { data: cs } = await adminClient
        .from('case_studies')
        .select('cohort_id')
        .eq('id', caseStudyId)
        .single();
      if (cs) {
        const { data: sg } = await adminClient
          .from('subgroups')
          .select('id')
          .eq('id', subgroup_id)
          .eq('cohort_id', cs.cohort_id)
          .maybeSingle();
        if (!sg) {
          return NextResponse.json({ error: 'Subgroup not found in this cohort' }, { status: 404 });
        }
      }
      // Per-subgroup extension
      const { data: submission } = await adminClient
        .from('case_study_submissions')
        .select('id, visibility')
        .eq('case_study_id', caseStudyId)
        .eq('subgroup_id', subgroup_id)
        .maybeSingle();

      if (submission) {
        // Only extend if not already reviewed
        const reviewed = ['admin_reviewed', 'mentor_visible', 'subgroup_published', 'cohort_published'];
        const alreadyReviewed = reviewed.includes(submission.visibility);

        await adminClient
          .from('case_study_submissions')
          .update({
            deadline_override: due_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', submission.id);

        return NextResponse.json({
          success: true,
          already_reviewed: alreadyReviewed,
          message: alreadyReviewed
            ? 'Deadline extended, but this submission is already reviewed'
            : 'Deadline extended for subgroup',
        });
      } else {
        // Create a draft submission with the override
        await adminClient
          .from('case_study_submissions')
          .insert({
            case_study_id: caseStudyId,
            subgroup_id,
            deadline_override: due_date,
            visibility: 'draft',
          });

        return NextResponse.json({ success: true, message: 'Deadline set for subgroup' });
      }
    } else {
      // Cohort-level extension — update case study due_date
      // First check how many are already reviewed
      const { data: submissions } = await adminClient
        .from('case_study_submissions')
        .select('id, visibility')
        .eq('case_study_id', caseStudyId);

      const reviewed = ['admin_reviewed', 'mentor_visible', 'subgroup_published', 'cohort_published'];
      const reviewedCount = (submissions || []).filter(s => reviewed.includes(s.visibility)).length;

      const { error } = await adminClient
        .from('case_studies')
        .update({ due_date })
        .eq('id', caseStudyId);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        reviewed_count: reviewedCount,
        total_submissions: (submissions || []).length,
        message: reviewedCount > 0
          ? `Deadline extended. ${reviewedCount} submission(s) already reviewed — extension only affects unreviewed.`
          : 'Deadline extended for all subgroups',
      });
    }
  } catch (error) {
    console.error('Error extending deadline:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
