import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { sendCalendarInvitesToNewMember } from '@/lib/services/calendar-helpers';

interface RoleAssignment {
  role: string;
  cohort_id: string | null;
}

// POST - Create a new user
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { email, full_name, cohort_id, role_assignments } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Support both legacy (cohort_id) and new (role_assignments) modes
    const hasRoleAssignments = role_assignments && Array.isArray(role_assignments) && role_assignments.length > 0;

    if (!hasRoleAssignments && !cohort_id) {
      return NextResponse.json({ error: 'Either cohort or role assignments are required' }, { status: 400 });
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

    // Determine primary role and cohort for legacy profile fields
    let primaryRole = 'student';
    let primaryCohortId = cohort_id || null;

    if (hasRoleAssignments) {
      // Use first role assignment as primary
      const firstAssignment = role_assignments[0] as RoleAssignment;
      primaryRole = firstAssignment.role;
      primaryCohortId = firstAssignment.cohort_id;
    }

    // Update the profile with full_name and primary role/cohort
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update({
        full_name: full_name || null,
        cohort_id: primaryCohortId,
        role: primaryRole,
      })
      .eq('id', authData.user.id)
      .select('*, cohort:cohorts!fk_profile_cohort(*)')
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      return NextResponse.json({
        user: authData.user,
        profile: null,
        warning: 'User created but profile update failed',
      });
    }

    // Insert role assignments if provided
    if (hasRoleAssignments) {
      const assignmentsToInsert = (role_assignments as RoleAssignment[]).map(ra => ({
        user_id: authData.user!.id,
        role: ra.role,
        cohort_id: ra.cohort_id,
      }));

      const { error: assignmentError } = await adminClient
        .from('user_role_assignments')
        .insert(assignmentsToInsert);

      if (assignmentError) {
        console.error('Error creating role assignments:', assignmentError);
        // Don't fail - user was created successfully
      }
    } else if (cohort_id) {
      // Legacy mode: create single role assignment
      await adminClient
        .from('user_role_assignments')
        .insert({
          user_id: authData.user.id,
          role: 'student',
          cohort_id: cohort_id,
        });
    }

    // Collect all cohort IDs for calendar invites
    const cohortIds: string[] = [];
    if (hasRoleAssignments) {
      for (const ra of role_assignments as RoleAssignment[]) {
        if (ra.cohort_id) cohortIds.push(ra.cohort_id);
      }
    } else if (cohort_id) {
      cohortIds.push(cohort_id);
    }

    // Send calendar invites for future sessions in all assigned cohorts
    if (cohortIds.length > 0 && profile?.email) {
      for (const cid of cohortIds) {
        try {
          const result = await sendCalendarInvitesToNewMember(profile.email, cid, auth.userId!);
          if (result.sent > 0) {
            console.log(`Sent ${result.sent} calendar invites to new user ${profile.email} for cohort ${cid}`);
          }
        } catch (calendarError) {
          console.error('Failed to send calendar invites:', calendarError);
        }
      }
    }

    // Fetch role assignments for response
    const { data: createdAssignments } = await adminClient
      .from('user_role_assignments')
      .select('*, cohort:cohorts(*)')
      .eq('user_id', authData.user.id);

    return NextResponse.json({
      user: authData.user,
      profile: { ...profile, role_assignments: createdAssignments || [] },
      message: 'User created successfully. They can now login via email OTP.',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
