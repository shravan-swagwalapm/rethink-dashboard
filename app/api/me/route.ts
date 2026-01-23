import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ user: null, profile: null });
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ user, profile: null });
    }

    return NextResponse.json({ user, profile });
  } catch (error) {
    console.error('Error in /api/me:', error);
    return NextResponse.json({ user: null, profile: null }, { status: 500 });
  }
}
