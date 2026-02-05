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

    // Handle file uploads for presentation and pdf categories
    if (file && ['presentation', 'pdf'].includes(category)) {
      if (file.size > 104857600) {
        return NextResponse.json({ error: 'File exceeds 100MB limit' }, { status: 400 });
      }

      // Validate folder path
      const folder = isGlobal ? 'global' : cohortId;
      if (!folder) {
        return NextResponse.json({ error: 'Cohort ID is required for non-global uploads' }, { status: 400 });
      }

      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      filePath = `${folder}/${category}/${timestamp}_${sanitizedName}`;

      // Convert File to ArrayBuffer for upload (required for Next.js Edge runtime compatibility)
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await adminClient.storage
        .from('resources')
        .upload(filePath, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return NextResponse.json({
          error: `Upload failed: ${uploadError.message || 'Unknown storage error'}`
        }, { status: 500 });
      }

      fileSize = file.size;
      fileType = file.name.split('.').pop()?.toLowerCase() || null;
    } else if (file && !['presentation', 'pdf'].includes(category)) {
      // File provided but category doesn't support file uploads
      return NextResponse.json({
        error: `File uploads not supported for category: ${category}. Use 'presentation' or 'pdf' category.`
      }, { status: 400 });
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

    if (insertError) {
      console.error('Database insert error:', insertError);
      // If file was uploaded, clean it up on database failure
      if (filePath) {
        await adminClient.storage.from('resources').remove([filePath]);
      }
      return NextResponse.json({
        error: `Failed to save resource: ${insertError.message || 'Database error'}`
      }, { status: 500 });
    }

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    console.error('Error creating resource:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to create resource: ${errorMessage}` }, { status: 500 });
  }
}
