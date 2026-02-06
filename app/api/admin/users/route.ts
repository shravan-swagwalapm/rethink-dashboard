import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { sanitizeFilterValue } from '@/lib/api/sanitize';
import { sendCalendarInvitesToNewMember, removeCalendarInvitesFromOldCohort } from '@/lib/services/calendar-helpers';

// GET - Fetch users and cohorts
// Supports ?search= query param for RecipientSelector component
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    // Check for search parameter (used by RecipientSelector in notifications)
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // If search parameter exists, return filtered users in { data: [...] } format
    if (search !== null) {
      let query = adminClient
        .from('profiles')
        .select('id, email, full_name, phone')
        .order('full_name', { ascending: true });

      if (search.length >= 2) {
        const safeSearch = sanitizeFilterValue(search);
        query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
      }

      const { data, error } = await query.limit(50);

      if (error) {
        console.error('Error searching users:', error);
        return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
      }

      return NextResponse.json({ data: data || [] });
    }

    // Full user list for admin user management page

    const [{ data: users }, { data: cohorts }, { data: roleAssignments }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('*, cohort:cohorts!fk_profile_cohort(*)')
        .order('created_at', { ascending: false }),
      adminClient
        .from('cohorts')
        .select('*')
        .order('name', { ascending: true }),
      adminClient
        .from('user_role_assignments')
        .select('*, cohort:cohorts(*)'),
    ]);

    // Attach role assignments to each user
    const usersWithRoles = (users || []).map(user => ({
      ...user,
      role_assignments: (roleAssignments || []).filter(ra => ra.user_id === user.id),
    }));

    // Also fetch master users (guests) for session guest selection
    const masterUsers = usersWithRoles.filter(u =>
      u.role === 'master' ||
      u.role_assignments?.some((ra: { role: string }) => ra.role === 'master')
    );

    return NextResponse.json({
      users: usersWithRoles,
      cohorts: cohorts || [],
      masterUsers: masterUsers,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

interface RoleAssignment {
  role: string;
  cohort_id: string | null;
}

// PUT - Update user (role, cohort, or role_assignments)
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, role, cohort_id, role_assignments } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get current user data and role assignments BEFORE update
    const { data: currentUser } = await adminClient
      .from('profiles')
      .select('email, cohort_id')
      .eq('id', id)
      .single();

    const { data: currentAssignments } = await adminClient
      .from('user_role_assignments')
      .select('*')
      .eq('user_id', id);

    const oldCohortId = currentUser?.cohort_id;
    const oldCohortIds = new Set((currentAssignments || []).map(a => a.cohort_id).filter(Boolean));

    // Handle role_assignments update (new multi-role mode)
    if (role_assignments !== undefined && Array.isArray(role_assignments)) {
      // Delete existing assignments
      await adminClient
        .from('user_role_assignments')
        .delete()
        .eq('user_id', id);

      // Insert new assignments
      if (role_assignments.length > 0) {
        const assignmentsToInsert = (role_assignments as RoleAssignment[]).map(ra => ({
          user_id: id,
          role: ra.role,
          cohort_id: ra.cohort_id,
        }));

        await adminClient
          .from('user_role_assignments')
          .insert(assignmentsToInsert);

        // Update legacy profile fields with first assignment
        const firstAssignment = role_assignments[0] as RoleAssignment;
        await adminClient
          .from('profiles')
          .update({
            role: firstAssignment.role,
            cohort_id: firstAssignment.cohort_id,
          })
          .eq('id', id);
      }

      // Handle calendar invite changes
      const newCohortIds = new Set(
        (role_assignments as RoleAssignment[])
          .map(ra => ra.cohort_id)
          .filter(Boolean) as string[]
      );

      if (currentUser?.email) {
        // Remove invites for cohorts no longer assigned
        for (const oldCid of oldCohortIds) {
          if (!newCohortIds.has(oldCid)) {
            try {
              await removeCalendarInvitesFromOldCohort(currentUser.email, oldCid, auth.userId!);
            } catch (e) {
              console.error('Failed to remove calendar invites:', e);
            }
          }
        }

        // Add invites for newly assigned cohorts
        for (const newCid of newCohortIds) {
          if (!oldCohortIds.has(newCid)) {
            try {
              await sendCalendarInvitesToNewMember(currentUser.email, newCid, auth.userId!);
            } catch (e) {
              console.error('Failed to send calendar invites:', e);
            }
          }
        }
      }
    } else {
      // Legacy mode: update role and/or cohort_id directly
      const updateData: { role?: string; cohort_id?: string | null } = {};
      if (role !== undefined) updateData.role = role;
      if (cohort_id !== undefined) updateData.cohort_id = cohort_id || null;

      if (Object.keys(updateData).length > 0) {
        const { error } = await adminClient
          .from('profiles')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;
      }

      // Handle cohort change - remove from old, add to new
      if (cohort_id !== undefined && currentUser?.email) {
        const newCohortId = cohort_id || null;

        if (oldCohortId && oldCohortId !== newCohortId) {
          try {
            await removeCalendarInvitesFromOldCohort(currentUser.email, oldCohortId, auth.userId!);
          } catch (calendarError) {
            console.error('Failed to remove old calendar invites:', calendarError);
          }
        }

        if (newCohortId && newCohortId !== oldCohortId) {
          try {
            await sendCalendarInvitesToNewMember(currentUser.email, newCohortId, auth.userId!);
          } catch (calendarError) {
            console.error('Failed to send new calendar invites:', calendarError);
          }
        }

        // Also update the role assignment table
        if (newCohortId !== oldCohortId) {
          // Update or insert role assignment
          await adminClient
            .from('user_role_assignments')
            .upsert({
              user_id: id,
              role: role || 'student',
              cohort_id: newCohortId,
            }, {
              onConflict: 'user_id,role,cohort_id',
            });
        }
      }
    }

    // Fetch updated user with role assignments
    const { data: updatedUser } = await adminClient
      .from('profiles')
      .select('*, cohort:cohorts!fk_profile_cohort(*)')
      .eq('id', id)
      .single();

    const { data: updatedAssignments } = await adminClient
      .from('user_role_assignments')
      .select('*, cohort:cohorts(*)')
      .eq('user_id', id);

    return NextResponse.json({
      ...updatedUser,
      role_assignments: updatedAssignments || [],
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
