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
  console.log('🔍 Finding users with emails starting with "aa"...\n');

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at')
    .ilike('email', 'aa%')
    .order('email');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${users.length} users:\n`);
  users.forEach((user, i) => {
    console.log(`${i + 1}. ${user.email}`);
    console.log(`   Name: ${user.full_name || 'Unknown'}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
    console.log('');
  });
}

main().catch(console.error);
