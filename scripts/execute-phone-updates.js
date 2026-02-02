#!/usr/bin/env node

/**
 * Script to execute phone number updates in Supabase
 * Handles duplicates and runs updates in batches
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

async function main() {
  console.log('🚀 Starting phone number updates...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, 'update_phone_numbers.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
  const statements = sqlContent.split('\n').filter(line => line.trim() !== '');

  console.log(`📊 Total statements to execute: ${statements.length}\n`);

  // Parse statements into updates (handle duplicates)
  const updates = new Map(); // email -> phone (last one wins)

  for (const statement of statements) {
    const match = statement.match(/UPDATE profiles SET phone = '([^']+)' WHERE email = '([^']+)';/);
    if (match) {
      const [, phone, email] = match;
      updates.set(email, phone);
    }
  }

  console.log(`✅ Unique emails to update: ${updates.size}\n`);

  // Execute updates in batches
  const batchSize = 50;
  const emails = Array.from(updates.keys());
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emails.length / batchSize)} (${batch.length} updates)...`);

    for (const email of batch) {
      const phone = updates.get(email);

      try {
        const { error } = await supabase
          .from('profiles')
          .update({ phone })
          .eq('email', email);

        if (error) {
          errorCount++;
          errors.push({ email, phone, error: error.message });
          console.error(`  ❌ Failed: ${email} - ${error.message}`);
        } else {
          successCount++;
          process.stdout.write('.');
        }
      } catch (err) {
        errorCount++;
        errors.push({ email, phone, error: err.message });
        console.error(`  ❌ Exception: ${email} - ${err.message}`);
      }
    }

    console.log(''); // New line after batch
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 UPDATE SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successful updates: ${successCount}`);
  console.log(`❌ Failed updates: ${errorCount}`);
  console.log(`📈 Success rate: ${((successCount / updates.size) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.email} → ${err.phone}`);
      console.log(`   Error: ${err.error}`);
    });
  }

  // Verify a few random updates
  console.log('\n🔍 VERIFYING RANDOM UPDATES...');
  const randomEmails = emails.sort(() => Math.random() - 0.5).slice(0, 5);

  for (const email of randomEmails) {
    const { data, error } = await supabase
      .from('profiles')
      .select('email, phone, full_name')
      .eq('email', email)
      .single();

    if (!error && data) {
      const expectedPhone = updates.get(email);
      const match = data.phone === expectedPhone ? '✅' : '❌';
      console.log(`${match} ${data.full_name || 'Unknown'} (${email})`);
      console.log(`   Expected: ${expectedPhone}`);
      console.log(`   Got: ${data.phone}`);
    }
  }

  console.log('\n✅ Phone number updates complete!');
  console.log('💡 Students can now login using their phone numbers via OTP\n');
}

main().catch(console.error);
