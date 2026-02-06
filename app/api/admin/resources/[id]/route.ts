import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// GET: Fetch single resource by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const adminClient = await createAdminClient();

    const { data: resource, error } = await adminClient
      .from('resources')
      .select('*, cohort:cohorts(id, name, tag)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ resource });
  } catch (error) {
    console.error('Error fetching resource:', error);
    return NextResponse.json({ error: 'Failed to fetch resource' }, { status: 500 });
  }
}

// PATCH: Update resource
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const adminClient = await createAdminClient();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.external_url !== undefined) updateData.external_url = body.external_url;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.is_global !== undefined) updateData.is_global = body.is_global;
    if (body.cohort_id !== undefined) updateData.cohort_id = body.cohort_id;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
    }

    const { data: resource, error } = await adminClient
      .from('resources')
      .update(updateData)
      .eq('id', id)
      .select('*, cohort:cohorts(id, name, tag)')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ resource });
  } catch (error) {
    console.error('Error updating resource:', error);
    return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 });
  }
}

// DELETE: Delete resource
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const adminClient = await createAdminClient();

    // First, get the resource to check if it has a file
    const { data: resource, error: fetchError } = await adminClient
      .from('resources')
      .select('file_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }
      throw fetchError;
    }

    // If resource has a file, delete it from storage
    if (resource?.file_path) {
      const { error: storageError } = await adminClient.storage
        .from('resources')
        .remove([resource.file_path]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete the database record
    const { error: deleteError } = await adminClient
      .from('resources')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resource:', error);
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 });
  }
}
