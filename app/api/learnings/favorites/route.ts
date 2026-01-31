import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: Fetch user's favorited resources
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('resource_favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching favorites:', error);
      return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
    }

    return NextResponse.json({ favorites: data });
  } catch (error) {
    console.error('Error in GET /api/learnings/favorites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Add resource to favorites
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resource_id } = body;

    if (!resource_id) {
      return NextResponse.json({ error: 'resource_id is required' }, { status: 400 });
    }

    // Check if already favorited
    const { data: existing } = await supabase
      .from('resource_favorites')
      .select('*')
      .eq('user_id', user.id)
      .eq('resource_id', resource_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ favorite: existing, message: 'Already favorited' });
    }

    // Add to favorites
    const { data, error } = await supabase
      .from('resource_favorites')
      .insert({
        user_id: user.id,
        resource_id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding favorite:', error);
      return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
    }

    return NextResponse.json({ favorite: data });
  } catch (error) {
    console.error('Error in POST /api/learnings/favorites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove resource from favorites
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resource_id = searchParams.get('resource_id');

    if (!resource_id) {
      return NextResponse.json({ error: 'resource_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('resource_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('resource_id', resource_id);

    if (error) {
      console.error('Error removing favorite:', error);
      return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Favorite removed successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/learnings/favorites:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
