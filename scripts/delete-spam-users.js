#!/usr/bin/env node

/**
 * Script to delete spam/test users from the database
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables manually from .env.local
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const spamEmails = [
  'aaaaabc@gmail.com',
  'aaabc@gmail.com',
  'aabc@gmail.com'
];

async function main() {
  console.log('🗑️  Deleting spam users...\n');

  for (const email of spamEmails) {
    console.log(`Processing: ${email}`);

    // Get user ID first
    const { data: user, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      console.log(`  ⚠️  User not found: ${email}\n`);
      continue;
    }

    console.log(`  Found: ${user.full_name || 'Unknown'} (${user.id})`);

    // Delete from user_role_assignments first (foreign key constraint)
    const { error: roleError } = await supabase
      .from('user_role_assignments')
      .delete()
      .eq('user_id', user.id);

    if (roleError) {
      console.error(`  ❌ Failed to delete role assignments: ${roleError.message}`);
    } else {
      console.log(`  ✅ Deleted role assignments`);
    }

    // Delete from profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('email', email);

    if (profileError) {
      console.error(`  ❌ Failed to delete profile: ${profileError.message}`);
    } else {
      console.log(`  ✅ Deleted profile`);
    }

    // Delete from auth.users (Supabase Auth)
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

    if (authError) {
      console.error(`  ❌ Failed to delete auth user: ${authError.message}`);
    } else {
      console.log(`  ✅ Deleted auth user`);
    }

    console.log('');
  }

  console.log('✅ Spam user deletion complete!');
}

main().catch(console.error);
