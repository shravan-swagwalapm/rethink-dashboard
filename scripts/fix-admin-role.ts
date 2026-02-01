import { createClient } from '@supabase/supabase-js';

// Supabase credentials (from .env.local)
const supabaseUrl = 'https://isethhyihdbhquozlabl.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZXRoaHlpaGRiaHF1b3psYWJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE2NjE2NCwiZXhwIjoyMDg0NzQyMTY0fQ.bawWBTIjRwS-mDzlfEkjR1oRBYKygdxkihc87pmnSGk';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixAdminRole(email: string) {
  console.log(`\n🔍 Checking role status for: ${email}\n`);

  // Step 1: Check current role status
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, full_name')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    console.error('❌ Error fetching profile:', profileError);
    return;
  }

  console.log('📋 Current Profile Data:');
  console.log(`   ID: ${profile.id}`);
  console.log(`   Email: ${profile.email}`);
  console.log(`   Name: ${profile.full_name}`);
  console.log(`   Role (profiles.role): ${profile.role}`);

  // Check role assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('user_role_assignments')
    .select('id, role, cohort_id')
    .eq('user_id', profile.id);

  console.log(`\n📋 Current Role Assignments:`);
  if (assignments && assignments.length > 0) {
    assignments.forEach(a => {
      console.log(`   - ${a.role} (ID: ${a.id}, Cohort: ${a.cohort_id || 'NULL'})`);
    });
  } else {
    console.log(`   (No role assignments found)`);
  }

  // Step 2: Fix profile.role if needed
  if (profile.role !== 'admin') {
    console.log(`\n🔧 Updating profiles.role from '${profile.role}' to 'admin'...`);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', profile.id);

    if (updateError) {
      console.error('❌ Error updating profile role:', updateError);
    } else {
      console.log('✅ Profile role updated to admin');
    }
  } else {
    console.log(`\n✓ Profile role is already 'admin'`);
  }

  // Step 3: Ensure admin role assignment exists
  const hasAdminAssignment = assignments?.some(a => a.role === 'admin');

  if (!hasAdminAssignment) {
    console.log(`\n🔧 Adding admin role assignment...`);
    const { error: insertError } = await supabase
      .from('user_role_assignments')
      .insert({
        user_id: profile.id,
        role: 'admin',
        cohort_id: null,
      });

    if (insertError) {
      console.error('❌ Error inserting admin role assignment:', insertError);
    } else {
      console.log('✅ Admin role assignment added');
    }
  } else {
    console.log(`\n✓ Admin role assignment already exists`);
  }

  // Step 4: Verify final state
  console.log(`\n🔍 Verifying final state...\n`);

  const { data: finalProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', profile.id)
    .single();

  const { data: finalAssignments } = await supabase
    .from('user_role_assignments')
    .select('role')
    .eq('user_id', profile.id);

  console.log('✅ Final State:');
  console.log(`   profiles.role: ${finalProfile?.role}`);
  console.log(`   user_role_assignments: ${finalAssignments?.map(a => a.role).join(', ') || 'None'}`);

  console.log(`\n✅ Role fix complete for ${email}`);
  console.log(`\n⚠️  User must:`);
  console.log(`   1. Clear localStorage: localStorage.removeItem('active_role_assignment_id')`);
  console.log(`   2. Logout and login again`);
}

// Run for attharv@naum.systems
fixAdminRole('attharv@naum.systems')
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
