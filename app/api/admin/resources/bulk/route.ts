import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// PATCH: Bulk update resources
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { resource_ids, updates } = body;

    if (!Array.isArray(resource_ids) || resource_ids.length === 0) {
      return NextResponse.json({ error: 'resource_ids array required' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates object required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Build update object with only allowed fields
    const updateData: Record<string, unknown> = {};

    if (updates.is_global !== undefined) updateData.is_global = updates.is_global;
    if (updates.cohort_id !== undefined) updateData.cohort_id = updates.cohort_id;
    if (updates.category !== undefined) updateData.category = updates.category;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
    }

    const { data: resources, error } = await adminClient
      .from('resources')
      .update(updateData)
      .in('id', resource_ids)
      .select('id');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      updated_count: resources?.length || 0,
    });
  } catch (error) {
    console.error('Error bulk updating resources:', error);
    return NextResponse.json({ error: 'Failed to update resources' }, { status: 500 });
  }
}

// DELETE: Bulk delete resources
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { resource_ids } = body;

    if (!Array.isArray(resource_ids) || resource_ids.length === 0) {
      return NextResponse.json({ error: 'resource_ids array required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // First, get all resources to find their file paths
    const { data: resources, error: fetchError } = await adminClient
      .from('resources')
      .select('id, file_path')
      .in('id', resource_ids);

    if (fetchError) throw fetchError;

    // Collect file paths to delete from storage
    const filePaths = resources
      ?.filter(r => r.file_path)
      .map(r => r.file_path as string) || [];

    // Delete files from storage (if any)
    if (filePaths.length > 0) {
      const { error: storageError } = await adminClient.storage
        .from('resources')
        .remove(filePaths);

      if (storageError) {
        console.error('Error deleting files from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete database records
    const { error: deleteError } = await adminClient
      .from('resources')
      .delete()
      .in('id', resource_ids);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      deleted_count: resource_ids.length,
    });
  } catch (error) {
    console.error('Error bulk deleting resources:', error);
    return NextResponse.json({ error: 'Failed to delete resources' }, { status: 500 });
  }
}
