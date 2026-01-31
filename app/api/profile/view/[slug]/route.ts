import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const supabase = await createClient();
  const { slug } = await params;

  try {
    // Increment view count
    const { error } = await supabase
      .rpc('increment_profile_card_views', { card_slug: slug });

    if (error) {
      console.error('Error incrementing view count:', error);
      // Don't fail the request if view tracking fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/profile/view:', error);
    return NextResponse.json({ success: false });
  }
}
