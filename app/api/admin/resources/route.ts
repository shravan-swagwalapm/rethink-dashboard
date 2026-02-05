import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { isAdminRole } from '@/lib/utils/auth';

// GET: List all resources (admin view - no filtering)
export async function GET(request: Request) {
  const supabase = await createClient();

  try {
    // Verify admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!isAdminRole(profile?.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Build query (admin sees ALL resources)
    let query = supabase
      .from('resources')
      .select('*, cohort:cohorts(id, name, tag)')
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search) query = query.or(`name.ilike.%${search}%`);

    const { data: resources, error } = await query;
    if (error) throw error;

    return NextResponse.json({ resources: resources || [] });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 });
  }
}

// POST: Create new resource with file upload
export async function POST(request: Request) {
  const supabase = await createClient();
  const adminClient = await createAdminClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!isAdminRole(profile?.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const isGlobal = formData.get('is_global') === 'true';
    const cohortId = formData.get('cohort_id') as string | null;
    const externalUrl = formData.get('external_url') as string | null;
    const thumbnailUrl = formData.get('thumbnail_url') as string | null;
    const duration = formData.get('duration') as string | null;
    const file = formData.get('file') as File | null;

    if (!name || !category) {
      return NextResponse.json({ error: 'Name and category required' }, { status: 400 });
    }

    let filePath: string | null = null;
    let fileSize: number | null = null;
    let fileType: string | null = null;

    if (file && ['presentation', 'pdf'].includes(category)) {
      if (file.size > 104857600) {
        return NextResponse.json({ error: 'File exceeds 100MB limit' }, { status: 400 });
      }

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const folder = isGlobal ? 'global' : cohortId;
      filePath = `${folder}/${category}/${timestamp}_${sanitizedName}`;

      const { error: uploadError } = await adminClient.storage
        .from('resources')
        .upload(filePath, file);

      if (uploadError) {
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
      }

      fileSize = file.size;
      fileType = file.name.split('.').pop()?.toLowerCase() || null;
    }

    const { data: resource, error: insertError } = await adminClient
      .from('resources')
      .insert({
        name,
        category,
        is_global: isGlobal,
        cohort_id: isGlobal ? null : cohortId,
        external_url: externalUrl,
        thumbnail_url: thumbnailUrl,
        duration: duration,
        file_path: filePath,
        file_size: fileSize,
        file_type: fileType,
        type: file ? 'file' : 'link',
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    console.error('Error creating resource:', error);
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 });
  }
}
