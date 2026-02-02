#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const email = 'aaaabc@gmail.com';
  console.log(`🗑️  Deleting spam user: ${email}\n`);

  // Get user ID
  const { data: user, error: fetchError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('email', email)
    .single();

  if (fetchError || !user) {
    console.log(`❌ User not found`);
    return;
  }

  console.log(`Found: ${user.full_name || 'Unknown'} (${user.id})`);

  // Delete role assignments
  const { error: roleError } = await supabase
    .from('user_role_assignments')
    .delete()
    .eq('user_id', user.id);

  if (roleError) {
    console.error(`❌ Failed to delete role assignments: ${roleError.message}`);
  } else {
    console.log(`✅ Deleted role assignments`);
  }

  // Delete profile
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('email', email);

  if (profileError) {
    console.error(`❌ Failed to delete profile: ${profileError.message}`);
  } else {
    console.log(`✅ Deleted profile`);
  }

  // Delete auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

  if (authError) {
    console.error(`❌ Failed to delete auth user: ${authError.message}`);
  } else {
    console.log(`✅ Deleted auth user`);
  }

  console.log('\n✅ Spam user deleted successfully!');
}

main().catch(console.error);
