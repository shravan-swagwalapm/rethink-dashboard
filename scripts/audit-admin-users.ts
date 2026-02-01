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

async function auditAdminUsers() {
  console.log(`\n🔍 Auditing all @naum.systems users...\n`);

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

  console.log(`Found ${profiles.length} @naum.systems user(s):\n`);

  const needsFix: string[] = [];
  const allCorrect: string[] = [];

  for (const profile of profiles) {
    // Check role assignments for this user
    const { data: assignments } = await supabase
      .from('user_role_assignments')
      .select('role')
      .eq('user_id', profile.id);

    const hasAdminRole = profile.role === 'admin' || profile.role === 'company_user';
    const hasAdminAssignment = assignments?.some(a => a.role === 'admin' || a.role === 'company_user');

    const status = hasAdminRole ? '✅ Correct' : '❌ NEEDS FIX';
    const roles = assignments?.map(a => a.role).join(', ') || 'None';

    console.log(`${status} ${profile.email}`);
    console.log(`   Name: ${profile.full_name || 'N/A'}`);
    console.log(`   profiles.role: ${profile.role}`);
    console.log(`   user_role_assignments: ${roles}`);
    console.log('');

    if (!hasAdminRole) {
      needsFix.push(profile.email);
    } else {
      allCorrect.push(profile.email);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Correct: ${allCorrect.length}`);
  console.log(`   ❌ Need Fix: ${needsFix.length}`);

  if (needsFix.length > 0) {
    console.log(`\n⚠️  Users that need fixing:`);
    needsFix.forEach(email => console.log(`   - ${email}`));
    console.log(`\n💡 To fix all @naum.systems users at once, run:`);
    console.log(`   npx tsx scripts/fix-all-admin-users.ts`);
  } else {
    console.log(`\n🎉 All @naum.systems users have correct admin role!`);
  }
}

auditAdminUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
