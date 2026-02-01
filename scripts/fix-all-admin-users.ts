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

async function fixAllAdminUsers() {
  console.log(`\n🔧 Fixing all @naum.systems users to have admin role...\n`);

  // Fetch all users with @naum.systems email
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .ilike('email', '%@naum.systems');

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('No @naum.systems users found.');
    return;
  }

  console.log(`Found ${profiles.length} @naum.systems user(s)\n`);

  let fixedCount = 0;
  let alreadyCorrect = 0;

  for (const profile of profiles) {
    const needsFix = profile.role !== 'admin' && profile.role !== 'company_user';

    if (needsFix) {
      console.log(`🔧 Fixing: ${profile.email} (${profile.full_name})`);

      // Update profiles.role to admin
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', profile.id);

      if (updateError) {
        console.error(`   ❌ Error updating: ${updateError.message}`);
      } else {
        console.log(`   ✅ Updated profiles.role to 'admin'`);
        fixedCount++;
      }

      // Ensure admin role assignment exists
      const { data: adminAssignment } = await supabase
        .from('user_role_assignments')
        .select('id')
        .eq('user_id', profile.id)
        .eq('role', 'admin')
        .is('cohort_id', null)
        .single();

      if (!adminAssignment) {
        const { error: insertError } = await supabase
          .from('user_role_assignments')
          .insert({
            user_id: profile.id,
            role: 'admin',
            cohort_id: null,
          });

        if (insertError) {
          console.error(`   ❌ Error creating admin assignment: ${insertError.message}`);
        } else {
          console.log(`   ✅ Created admin role assignment`);
        }
      }

      console.log('');
    } else {
      console.log(`✓ Already correct: ${profile.email} (${profile.full_name})`);
      alreadyCorrect++;
    }
  }

  console.log('\n📊 Final Summary:');
  console.log(`   ✅ Fixed: ${fixedCount}`);
  console.log(`   ✓ Already correct: ${alreadyCorrect}`);
  console.log(`   Total: ${profiles.length}`);

  if (fixedCount > 0) {
    console.log(`\n⚠️  Users who were fixed must:`);
    console.log(`   1. Clear localStorage: localStorage.removeItem('active_role_assignment_id')`);
    console.log(`   2. Logout and login again`);
  }

  console.log(`\n✅ All @naum.systems users now have admin role!`);
}

fixAllAdminUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
