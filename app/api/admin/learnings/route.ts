import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'company_user';

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

// Helper to extract Google Drive file ID from various URL formats
function extractGoogleDriveId(url: string): string | null {
  if (!url) return null;

  // Format: https://drive.google.com/file/d/{FILE_ID}/view
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // Format: https://docs.google.com/presentation/d/{FILE_ID}/edit
  const presentationMatch = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (presentationMatch) return presentationMatch[1];

  // Format: https://docs.google.com/document/d/{FILE_ID}/edit
  const documentMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (documentMatch) return documentMatch[1];

  // Format: https://drive.google.com/open?id={FILE_ID}
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];

  return null;
}

// Helper to detect content type from Google Drive URL
function detectContentType(url: string): 'video' | 'slides' | 'document' | 'link' {
  if (!url) return 'link';

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('presentation') || lowerUrl.includes('.ppt')) {
    return 'slides';
  }
  if (lowerUrl.includes('document') || lowerUrl.includes('.doc')) {
    return 'document';
  }
  if (lowerUrl.includes('video') || lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || lowerUrl.includes('.avi')) {
    return 'video';
  }
  // Default Google Drive files to video (most common for recordings)
  if (lowerUrl.includes('drive.google.com/file')) {
    return 'video';
  }

  return 'link';
}

// GET - Fetch learning modules and resources for a cohort
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');
    const moduleId = searchParams.get('module_id');
    const isGlobalFilter = searchParams.get('is_global');

    const adminClient = await createAdminClient();

    // If moduleId provided, fetch just that module with its resources
    if (moduleId) {
      const { data: module, error: moduleError } = await adminClient
        .from('learning_modules')
        .select('*')
        .eq('id', moduleId)
        .single();

      if (moduleError) {
        return NextResponse.json({ error: moduleError.message }, { status: 400 });
      }

      const { data: resources } = await adminClient
        .from('module_resources')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index', { ascending: true });

      return NextResponse.json({
        module,
        resources: resources || [],
      });
    }

    // If is_global filter provided, fetch only global modules
    if (isGlobalFilter === 'true') {
      const { data: modules, error: modulesError } = await adminClient
        .from('learning_modules')
        .select('*')
        .eq('is_global', true)
        .order('week_number', { ascending: true })
        .order('order_index', { ascending: true });

      if (modulesError) {
        return NextResponse.json({ error: modulesError.message }, { status: 400 });
      }

      // Fetch resources for global modules
      const moduleIds = modules?.map(m => m.id) || [];
      const { data: resources } = await adminClient
        .from('module_resources')
        .select('*')
        .in('module_id', moduleIds)
        .order('order_index', { ascending: true });

      // Group resources by module
      const modulesWithResources = modules?.map(module => ({
        ...module,
        resources: resources?.filter(r => r.module_id === module.id) || [],
      }));

      return NextResponse.json({ modules: modulesWithResources || [] });
    }

    // Fetch all modules for cohort (including global and linked modules)
    let modules;
    let modulesError;

    if (cohortId) {
      // For a specific cohort, fetch:
      // 1. Modules directly owned by this cohort
      // 2. Global modules (is_global = true)
      // 3. Modules linked via cohort_module_links

      // First, get linked module IDs
      const { data: linkedModuleIds } = await adminClient
        .from('cohort_module_links')
        .select('module_id')
        .eq('cohort_id', cohortId);

      const linkedIds = linkedModuleIds?.map(link => link.module_id) || [];

      // Build the query with OR conditions
      let modulesQuery = adminClient
        .from('learning_modules')
        .select('*')
        .or(`cohort_id.eq.${cohortId},is_global.eq.true${linkedIds.length > 0 ? `,id.in.(${linkedIds.join(',')})` : ''}`)
        .order('week_number', { ascending: true })
        .order('order_index', { ascending: true });

      const result = await modulesQuery;
      modules = result.data;
      modulesError = result.error;
    } else {
      // No cohort filter - fetch all modules
      const modulesQuery = adminClient
        .from('learning_modules')
        .select('*')
        .order('week_number', { ascending: true })
        .order('order_index', { ascending: true });

      const result = await modulesQuery;
      modules = result.data;
      modulesError = result.error;
    }

    if (modulesError) {
      return NextResponse.json({ error: modulesError.message }, { status: 400 });
    }

    // Fetch all resources for these modules
    const moduleIds = modules?.map(m => m.id) || [];
    const { data: resources } = await adminClient
      .from('module_resources')
      .select('*')
      .in('module_id', moduleIds)
      .order('order_index', { ascending: true });

    // Group resources by module
    const modulesWithResources = modules?.map(module => ({
      ...module,
      resources: resources?.filter(r => r.module_id === module.id) || [],
    }));

    return NextResponse.json({ modules: modulesWithResources || [] });
  } catch (error) {
    console.error('Error fetching learnings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create module or resource
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const adminClient = await createAdminClient();

    // Create a learning module
    if (body.type === 'module') {
      const isGlobal = body.is_global === true;

      const { data: module, error } = await adminClient
        .from('learning_modules')
        .insert({
          title: body.title,
          description: body.description,
          week_number: body.week_number,
          order_index: body.order_index || 0,
          cohort_id: isGlobal ? null : body.cohort_id,
          is_global: isGlobal,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ module });
    }

    // Create a module resource
    if (body.type === 'resource') {
      const googleDriveId = extractGoogleDriveId(body.url);
      const contentType = body.content_type || detectContentType(body.url);

      console.log('Creating resource:', { module_id: body.module_id, title: body.title, contentType, googleDriveId });

      const { data: resource, error } = await adminClient
        .from('module_resources')
        .insert({
          module_id: body.module_id,
          title: body.title,
          content_type: contentType,
          google_drive_id: googleDriveId,
          external_url: body.url,
          duration_seconds: body.duration_seconds,
          order_index: body.order_index || 0,
          session_number: body.session_number || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating resource:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ resource });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error creating:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update module or resource
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const adminClient = await createAdminClient();

    // Update learning module
    if (body.type === 'module') {
      const { data: module, error } = await adminClient
        .from('learning_modules')
        .update({
          title: body.title,
          description: body.description,
          week_number: body.week_number,
          order_index: body.order_index,
        })
        .eq('id', body.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ module });
    }

    // Update module resource
    if (body.type === 'resource') {
      const googleDriveId = body.url ? extractGoogleDriveId(body.url) : undefined;
      const contentType = body.content_type || (body.url ? detectContentType(body.url) : undefined);

      const updateData: Record<string, unknown> = {
        title: body.title,
        order_index: body.order_index,
      };

      if (googleDriveId !== undefined) updateData.google_drive_id = googleDriveId;
      if (contentType !== undefined) updateData.content_type = contentType;
      if (body.url !== undefined) updateData.external_url = body.url;
      if (body.duration_seconds !== undefined) updateData.duration_seconds = body.duration_seconds;
      if (body.session_number !== undefined) updateData.session_number = body.session_number;

      const { data: resource, error } = await adminClient
        .from('module_resources')
        .update(updateData)
        .eq('id', body.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ resource });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Error updating:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete module or resource
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type) {
      return NextResponse.json({ error: 'Missing id or type' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    if (type === 'module') {
      // Deleting module will cascade delete its resources
      const { error } = await adminClient
        .from('learning_modules')
        .delete()
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else if (type === 'resource') {
      const { error } = await adminClient
        .from('module_resources')
        .delete()
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
