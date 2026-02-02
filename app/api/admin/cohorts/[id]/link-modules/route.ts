import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Zod validation schemas
const linkModulesSchema = z.object({
  source_cohort_id: z.union([z.string().uuid(), z.literal('global')]),
  module_ids: z.array(z.string().uuid()).optional(),
});

const unlinkModulesSchema = z.object({
  module_ids: z.array(z.string().uuid()).min(1).optional(),
  unlink_all: z.boolean().optional(),
  unlink_type: z.enum(['cohort', 'global']).optional(),
}).refine(
  data => data.module_ids || data.unlink_all || data.unlink_type,
  { message: 'One of module_ids, unlink_all, or unlink_type is required' }
);

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
 * POST /api/admin/cohorts/[id]/link-modules
 * Link modules from another cohort or global library to this cohort
 *
 * Request body:
 * - source_cohort_id: UUID of source cohort or 'global' for global library
 * - module_ids: Optional array of specific module IDs to link (null = link all)
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

    // Validate input
    const validation = linkModulesSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { source_cohort_id, module_ids } = validation.data;

    if (!source_cohort_id) {
      return NextResponse.json(
        { error: 'source_cohort_id is required' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Fetch modules to link
    let query = adminClient
      .from('learning_modules')
      .select('id, title, cohort_id, is_global');

    if (source_cohort_id === 'global') {
      // Link global library modules
      query = query.eq('is_global', true);
    } else {
      // Link modules from specific cohort
      query = query.eq('cohort_id', source_cohort_id);
    }

    // If specific module IDs provided, filter to those
    if (module_ids && Array.isArray(module_ids) && module_ids.length > 0) {
      query = query.in('id', module_ids);
    }

    const { data: modules, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!modules || modules.length === 0) {
      return NextResponse.json(
        { message: 'No modules found to link', links_created: 0 },
        { status: 200 }
      );
    }

    // Determine link type
    const linkType = source_cohort_id === 'global' ? 'global' : 'cohort';

    // CRITICAL: Prevent circular links (Cohort A → Cohort B → Cohort A)
    if (linkType === 'cohort') {
      const { data: sourceCohort } = await adminClient
        .from('cohorts')
        .select('id, name, linked_cohort_id')
        .eq('id', source_cohort_id)
        .single();

      if (sourceCohort?.linked_cohort_id === cohortId) {
        return NextResponse.json(
          { error: `Cannot create circular link: ${sourceCohort.name} is already linked to this cohort` },
          { status: 400 }
        );
      }
    }

    // Use atomic PostgreSQL function for transaction safety
    // DELETE + INSERT in single transaction prevents data loss
    const { data: result, error: rpcError } = await adminClient.rpc('atomic_update_cohort_link', {
      p_cohort_id: cohortId,
      p_source_cohort_id: source_cohort_id === 'global' ? null : source_cohort_id,
      p_link_type: linkType,
      p_module_ids: modules.map(m => m.id),
      p_linked_by: auth.userId,
    });

    if (rpcError) {
      throw rpcError;
    }

    // Check function result
    if (!result || !result.success) {
      return NextResponse.json(
        { error: result?.error || 'Failed to link modules' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: `Successfully linked ${result.inserted_count} modules from ${linkType === 'global' ? 'Global Library' : 'source cohort'}`,
      links_created: result.inserted_count,
      deleted_count: result.deleted_count,
      active_source: result.active_link_type || 'own',
      linked_cohort_id: result.linked_cohort_id,
    });

  } catch (error) {
    console.error('Error linking modules:', error);
    return NextResponse.json(
      { error: 'Failed to link modules' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cohorts/[id]/link-modules
 * Unlink modules from this cohort
 *
 * Request body:
 * - module_ids: Array of module IDs to unlink (optional if unlink_all is true)
 * - unlink_all: Boolean flag to unlink all linked modules (optional)
 */
export async function DELETE(
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

    // Validate input
    const validation = unlinkModulesSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { module_ids, unlink_all, unlink_type } = validation.data;

    const adminClient = await createAdminClient();

    // NEW: Handle unlink by type (cohort or global)
    if (unlink_type && (unlink_type === 'cohort' || unlink_type === 'global')) {
      const { data: result, error: rpcError } = await adminClient.rpc('atomic_unlink_by_type', {
        p_cohort_id: cohortId,
        p_link_type: unlink_type,
      });

      if (rpcError) {
        throw rpcError;
      }

      if (!result || !result.success) {
        return NextResponse.json(
          { error: result?.error || 'Failed to unlink modules' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        message: `Successfully unlinked all ${unlink_type} modules`,
        unlinked_count: result.deleted_count,
        active_source: result.active_link_type || 'own',
      });
    }

    // Handle bulk unlink - delete ALL links for this cohort
    if (unlink_all === true) {
      const { data: result, error: rpcError } = await adminClient.rpc('atomic_unlink_all', {
        p_cohort_id: cohortId,
      });

      if (rpcError) {
        throw rpcError;
      }

      if (!result || !result.success) {
        return NextResponse.json(
          { error: result?.error || 'Failed to unlink modules' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        message: `Successfully unlinked all modules`,
        unlinked_count: result.deleted_count,
        active_source: result.active_link_type || 'own',
      });
    }

    // Handle specific module unlink
    if (!module_ids || !Array.isArray(module_ids) || module_ids.length === 0) {
      return NextResponse.json(
        { error: 'module_ids array, unlink_all flag, or unlink_type required' },
        { status: 400 }
      );
    }

    const { error } = await adminClient
      .from('cohort_module_links')
      .delete()
      .eq('cohort_id', cohortId)
      .in('module_id', module_ids);

    if (error) {
      throw error;
    }

    // CRITICAL FIX: Get actual active_link_type from database (not 'linked' which is invalid)
    const { data: cohort } = await adminClient
      .from('cohorts')
      .select('active_link_type')
      .eq('id', cohortId)
      .single();

    return NextResponse.json({
      message: `Successfully unlinked ${module_ids.length} module(s)`,
      unlinked_count: module_ids.length,
      active_source: cohort?.active_link_type || 'own',
    });

  } catch (error) {
    console.error('Error unlinking modules:', error);
    return NextResponse.json(
      { error: 'Failed to unlink modules' },
      { status: 500 }
    );
  }
}
