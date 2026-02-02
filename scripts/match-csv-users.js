#!/usr/bin/env node

/**
 * Script to match CSV users with database users and generate SQL UPDATE statements
 * Only generates updates for users that exist in both CSV and database
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
    // Remove quotes if present
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
  console.log('🔍 Fetching all users from database...\n');

  // Fetch all users from profiles table
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, phone, full_name')
    .order('email');

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    process.exit(1);
  }

  console.log(`✅ Found ${profiles.length} users in database\n`);

  // Read CSV file
  const csvPath = '/Users/shravantickoo/Downloads/Cohort Alumini - Sheet1.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV (skip header)
  const lines = csvContent.split('\n').slice(1).filter(line => line.trim());

  const csvUsers = [];
  for (const line of lines) {
    // Parse CSV line (handle quoted fields with commas)
    const matches = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
    if (!matches) continue;

    const fields = matches.map(m => {
      let field = m.replace(/^,/, ''); // Remove leading comma
      if (field.startsWith('"') && field.endsWith('"')) {
        field = field.slice(1, -1).replace(/""/g, '"'); // Unquote and unescape
      }
      return field.trim();
    });

    const email = fields[4]?.toLowerCase().trim();
    let phone = fields[5]?.trim();

    // Skip if missing email or phone
    if (!email || !phone) continue;

    // Clean phone number (remove invisible Unicode characters)
    phone = phone.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '');

    // Skip if phone doesn't start with +
    if (!phone.startsWith('+')) continue;

    csvUsers.push({ email, phone });
  }

  console.log(`📄 Parsed ${csvUsers.length} valid users from CSV\n`);

  // Create email lookup map for database users
  const dbEmailMap = new Map();
  for (const profile of profiles) {
    if (profile.email) {
      dbEmailMap.set(profile.email.toLowerCase(), profile);
    }
  }

  // Match CSV users with database users
  const matched = [];
  const notFound = [];
  const alreadyHavePhone = [];

  for (const csvUser of csvUsers) {
    const dbUser = dbEmailMap.get(csvUser.email);

    if (!dbUser) {
      notFound.push(csvUser);
    } else if (dbUser.phone && dbUser.phone.trim() !== '') {
      alreadyHavePhone.push({ ...csvUser, existingPhone: dbUser.phone });
    } else {
      matched.push({
        ...csvUser,
        id: dbUser.id,
        fullName: dbUser.full_name
      });
    }
  }

  // Print results
  console.log('📊 MATCHING RESULTS:');
  console.log('='.repeat(60));
  console.log(`✅ Users to update (in DB, no phone): ${matched.length}`);
  console.log(`⚠️  Users already have phone: ${alreadyHavePhone.length}`);
  console.log(`❌ Users not in database: ${notFound.length}`);
  console.log('='.repeat(60));
  console.log('');

  // Show first 10 matched users
  if (matched.length > 0) {
    console.log('👥 FIRST 10 USERS TO UPDATE:');
    console.log('-'.repeat(60));
    matched.slice(0, 10).forEach((user, i) => {
      console.log(`${i + 1}. ${user.email}`);
      console.log(`   Phone: ${user.phone}`);
      console.log(`   Name: ${user.fullName || '(no name)'}`);
      console.log('');
    });
  }

  // Show users already with phones
  if (alreadyHavePhone.length > 0) {
    console.log('⚠️  USERS ALREADY HAVE PHONE (first 5):');
    console.log('-'.repeat(60));
    alreadyHavePhone.slice(0, 5).forEach((user, i) => {
      console.log(`${i + 1}. ${user.email}`);
      console.log(`   Existing: ${user.existingPhone}`);
      console.log(`   CSV has: ${user.phone}`);
      console.log('');
    });
  }

  // Show users not found
  if (notFound.length > 0) {
    console.log('❌ USERS NOT IN DATABASE (first 10):');
    console.log('-'.repeat(60));
    notFound.slice(0, 10).forEach((user, i) => {
      console.log(`${i + 1}. ${user.email} → ${user.phone}`);
    });
    console.log('');
  }

  // Generate SQL UPDATE statements
  if (matched.length > 0) {
    console.log('📝 GENERATING SQL UPDATE STATEMENTS...\n');

    const sqlStatements = matched.map(user =>
      `UPDATE profiles SET phone = '${user.phone}' WHERE email = '${user.email}';`
    );

    const sqlFilePath = path.join(__dirname, 'update_phone_numbers.sql');
    fs.writeFileSync(sqlFilePath, sqlStatements.join('\n'));

    console.log(`✅ SQL file saved: ${sqlFilePath}`);
    console.log(`📊 Total statements: ${sqlStatements.length}`);
    console.log('');
    console.log('🔍 PREVIEW (first 5 statements):');
    console.log('-'.repeat(60));
    sqlStatements.slice(0, 5).forEach(stmt => console.log(stmt));
    console.log('');
    console.log('✅ You can review the full SQL file and run it in Supabase SQL Editor');
  }
}

main().catch(console.error);
