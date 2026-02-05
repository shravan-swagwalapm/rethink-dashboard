import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user profile to determine cohort
    const { data: profile } = await supabase
      .from('profiles')
      .select('cohort_id')
      .eq('id', user.id)
      .single();

    if (!profile?.cohort_id) {
      return NextResponse.json(
        { error: 'User not assigned to a cohort' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category'); // Filter by category
    const search = searchParams.get('search'); // Text search

    // CRITICAL LOGIC: Check if there are any global resources for this category
    let hasGlobalResources = false;

    const { count: globalCount } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .eq('is_global', true)
      .eq('category', category || '');

    hasGlobalResources = (globalCount || 0) > 0;

    // Build query based on global override logic
    let query = supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });

    if (hasGlobalResources) {
      // Show ONLY global resources (override cohort-specific)
      query = query.eq('is_global', true);
    } else {
      // Show cohort-specific resources
      query = query
        .eq('cohort_id', profile.cohort_id)
        .eq('is_global', false);
    }

    // Apply category filter if provided
    if (category) {
      query = query.eq('category', category);
    }

    // Apply text search if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,keywords.cs.{${search}}`);
    }

    const { data: resources, error } = await query;

    if (error) throw error;

    // Generate signed URLs for file resources
    const resourcesWithUrls = await Promise.all(
      (resources || []).map(async (resource) => {
        if (resource.file_path) {
          const { data: signedUrl } = await supabase.storage
            .from('resources')
            .createSignedUrl(resource.file_path, 3600); // 1 hour expiry

          return {
            ...resource,
            signed_url: signedUrl?.signedUrl || null,
          };
        }
        return resource;
      })
    );

    return NextResponse.json({
      resources: resourcesWithUrls,
      has_global_override: hasGlobalResources,
    });

  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}
