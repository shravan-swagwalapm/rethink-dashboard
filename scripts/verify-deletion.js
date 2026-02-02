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
  console.log('🔍 Verifying spam user deletion...\n');

  const spamEmails = ['aaaabc@gmail.com', 'aaabc@gmail.com', 'aabc@gmail.com'];

  for (const email of spamEmails) {
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (data) {
      console.log(`❌ ${email} - Still exists!`);
    } else {
      console.log(`✅ ${email} - Deleted`);
    }
  }

  // Get total user count
  const { count } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total users in database: ${count}`);
}

main().catch(console.error);
