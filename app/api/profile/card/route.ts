import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';

// GET: Fetch user's active profile card
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: card, error } = await supabase
      .from('profile_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile card:', error);
      return NextResponse.json({ error: 'Failed to fetch profile card' }, { status: 500 });
    }

    return NextResponse.json({ card });
  } catch (error) {
    console.error('Error in GET /api/profile/card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Generate new profile card (or return existing)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has an active card
    const { data: existingCard } = await supabase
      .from('profile_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existingCard) {
      return NextResponse.json({
        card: existingCard,
        message: 'Profile card already exists'
      });
    }

    // Generate unique slug using RPC function
    const { data: slugData, error: slugError } = await supabase
      .rpc('generate_profile_slug');

    if (slugError || !slugData) {
      console.error('Error generating slug:', slugError);
      return NextResponse.json({ error: 'Failed to generate unique URL' }, { status: 500 });
    }

    // Create new profile card
    const { data: newCard, error: insertError } = await supabase
      .from('profile_cards')
      .insert({
        user_id: user.id,
        slug: slugData,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating profile card:', insertError);
      return NextResponse.json({ error: 'Failed to create profile card' }, { status: 500 });
    }

    return NextResponse.json({
      card: newCard,
      message: 'Profile card generated successfully'
    });
  } catch (error) {
    console.error('Error in POST /api/profile/card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Regenerate profile card (deactivate old, create new)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Deactivate all existing active cards for user
    const { error: deactivateError } = await supabase
      .from('profile_cards')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('Error deactivating existing cards:', deactivateError);
      return NextResponse.json({ error: 'Failed to deactivate existing cards' }, { status: 500 });
    }

    // Generate new slug using RPC function
    const { data: slugData, error: slugError } = await supabase
      .rpc('generate_profile_slug');

    if (slugError || !slugData) {
      console.error('Error generating slug:', slugError);
      return NextResponse.json({ error: 'Failed to generate unique URL' }, { status: 500 });
    }

    // Create new active profile card
    const { data: newCard, error: insertError } = await supabase
      .from('profile_cards')
      .insert({
        user_id: user.id,
        slug: slugData,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating profile card:', insertError);
      return NextResponse.json({ error: 'Failed to create profile card' }, { status: 500 });
    }

    return NextResponse.json({
      card: newCard,
      message: 'Profile card regenerated successfully'
    });
  } catch (error) {
    console.error('Error in PATCH /api/profile/card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Deactivate user's active profile card
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('profile_cards')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) {
      console.error('Error deactivating profile card:', error);
      return NextResponse.json({ error: 'Failed to deactivate profile card' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Profile card deactivated successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/profile/card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
