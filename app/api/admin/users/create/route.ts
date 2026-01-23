import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  // Check admin role from database only - no domain-based bypass
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

// POST - Create a new user
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { email, full_name, cohort_id } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!cohort_id) {
      return NextResponse.json({ error: 'Cohort is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Check if user already exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingProfile) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true, // Auto-confirm email so they can login immediately
      user_metadata: {
        full_name: full_name || '',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Update the profile with full_name and cohort_id
    // The profile should be auto-created by the database trigger
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update({
        full_name: full_name || null,
        cohort_id: cohort_id,
        role: 'student',
      })
      .eq('id', authData.user.id)
      .select('*, cohort:cohorts!fk_profile_cohort(*)')
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // User was created but profile update failed - still return success
      return NextResponse.json({
        user: authData.user,
        profile: null,
        warning: 'User created but profile update failed',
      });
    }

    return NextResponse.json({
      user: authData.user,
      profile,
      message: 'User created successfully. They can now login via email OTP.',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
