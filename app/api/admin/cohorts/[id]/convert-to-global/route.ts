import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401, userId: null };
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403, userId: null };
  }

  return { authorized: true, userId: user.id };
}

/**
 * POST /api/admin/cohorts/[id]/convert-to-global
 * Convert cohort's own modules to global (orphaned) modules
 *
 * Request body:
 * - make_global: boolean (default: false) - Set is_global=true and cohort_id=null
 *
 * Response:
 * - message: Success message
 * - converted_count: Number of modules converted
 * - modules: Array of converted module objects
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { make_global = false } = body;

    const adminClient = await createAdminClient();

    // First, fetch own modules to get count
    const { data: ownModules, error: fetchError } = await adminClient
      .from('learning_modules')
      .select('id, title')
      .eq('cohort_id', cohortId)
      .eq('is_global', false);

    if (fetchError) {
      console.error('Error fetching own modules:', fetchError);
      throw fetchError;
    }

    if (!ownModules || ownModules.length === 0) {
      return NextResponse.json({
        message: 'No own modules to convert',
        converted_count: 0,
      });
    }

    // Convert modules: set cohort_id to null and optionally is_global to true
    const updateData: Record<string, unknown> = {
      cohort_id: null,
    };

    if (make_global) {
      updateData.is_global = true;
    }

    const { data: updatedModules, error: updateError } = await adminClient
      .from('learning_modules')
      .update(updateData)
      .eq('cohort_id', cohortId)
      .eq('is_global', false)
      .select();

    if (updateError) {
      console.error('Error converting modules:', updateError);
      throw updateError;
    }

    return NextResponse.json({
      message: `Successfully converted ${updatedModules?.length || 0} modules to ${make_global ? 'global' : 'orphaned'}`,
      converted_count: updatedModules?.length || 0,
      modules: updatedModules,
    });

  } catch (error) {
    console.error('Error converting modules to global:', error);
    return NextResponse.json(
      { error: 'Failed to convert modules' },
      { status: 500 }
    );
  }
}
