import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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
    const showOwn = searchParams.get('show_own'); // For admin management: bypass override logic

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
      // ADMIN MANAGEMENT MODE: If show_own=true, bypass override logic and show cohort's own modules
      if (showOwn === 'true') {
        // Show ONLY own modules (for admin content management)
        const modulesQuery = adminClient
          .from('learning_modules')
          .select('*')
          .eq('cohort_id', cohortId)
          .order('week_number', { ascending: true })
          .order('order_index', { ascending: true });

        const result = await modulesQuery;
        modules = result.data;
        modulesError = result.error;
      } else {
        // OVERRIDE MODEL: Show only highest priority source (for student view preview)
        // Priority: Linked Source (cohort OR global) > Own Modules

        // Step 1: Fetch cohort state to determine active link type
        const { data: cohort } = await adminClient
          .from('cohorts')
          .select('id, active_link_type, linked_cohort_id')
          .eq('id', cohortId)
          .single();

        if (!cohort) {
          return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
        }

        // Step 2: Fetch modules based on active link type (OVERRIDE logic)
        let modulesQuery;

        switch (cohort.active_link_type) {
          case 'global':
            // ONLY global modules (overrides own)
            modulesQuery = adminClient
              .from('learning_modules')
              .select('*')
              .eq('is_global', true)
              .order('week_number', { ascending: true })
              .order('order_index', { ascending: true });
            break;

          case 'cohort':
            // ONLY modules from linked cohort (overrides own)
            if (cohort.linked_cohort_id) {
              modulesQuery = adminClient
                .from('learning_modules')
                .select('*')
                .eq('cohort_id', cohort.linked_cohort_id)
                .order('week_number', { ascending: true })
                .order('order_index', { ascending: true });
            } else {
              // Fallback if linked_cohort_id is missing (shouldn't happen)
              modulesQuery = adminClient
                .from('learning_modules')
                .select('*')
                .eq('cohort_id', cohortId)
                .order('week_number', { ascending: true })
                .order('order_index', { ascending: true });
            }
            break;

          case 'own':
          default:
            // ONLY own modules (default)
            modulesQuery = adminClient
              .from('learning_modules')
              .select('*')
              .eq('cohort_id', cohortId)
              .order('week_number', { ascending: true })
              .order('order_index', { ascending: true });
            break;
        }

        const result = await modulesQuery;
        modules = result.data;
        modulesError = result.error;
      }
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
      const contentType = body.content_type;

      // Build insert data based on content type
      const insertData: Record<string, unknown> = {
        module_id: body.module_id,
        title: body.title,
        content_type: contentType,
        duration_seconds: body.duration_seconds || null,
        order_index: body.order_index || 0,
        session_number: body.session_number || null,
      };

      // For videos: use external_url (YouTube)
      if (contentType === 'video') {
        insertData.external_url = body.external_url || body.url || null;
        insertData.google_drive_id = null;  // Clear legacy field
        insertData.file_path = null;
        insertData.file_type = null;
        insertData.file_size = null;
      } else if (body.file_path) {
        // For PDFs: use file_path from Supabase Storage
        insertData.file_path = body.file_path;
        insertData.file_type = body.file_type || 'pdf';
        insertData.file_size = body.file_size || null;
        insertData.external_url = null;
        insertData.google_drive_id = null;
      } else if (body.url) {
        // Legacy: Google Drive URL support
        const googleDriveId = extractGoogleDriveId(body.url);
        insertData.google_drive_id = googleDriveId;
        insertData.external_url = body.url;
      }

      console.log('Creating resource:', { module_id: body.module_id, title: body.title, contentType, insertData });

      const { data: resource, error } = await adminClient
        .from('module_resources')
        .insert(insertData)
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
      const updateData: Record<string, unknown> = {
        title: body.title,
        order_index: body.order_index,
      };

      // Update content type if provided
      if (body.content_type !== undefined) {
        updateData.content_type = body.content_type;
      }

      // Handle video updates (YouTube URL)
      if (body.external_url !== undefined) {
        updateData.external_url = body.external_url;
        // Clear legacy Google Drive ID when setting YouTube URL
        if (body.external_url) {
          updateData.google_drive_id = null;
        }
      }

      // Handle PDF file updates
      if (body.file_path !== undefined) {
        updateData.file_path = body.file_path;
        updateData.file_type = body.file_type || 'pdf';
        updateData.file_size = body.file_size || null;
        // Clear legacy fields
        updateData.google_drive_id = null;
        updateData.external_url = null;
      }

      // Legacy: Google Drive URL support
      if (body.url !== undefined && !body.external_url && !body.file_path) {
        const googleDriveId = body.url ? extractGoogleDriveId(body.url) : null;
        updateData.google_drive_id = googleDriveId;
        updateData.external_url = body.url;
      }

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
