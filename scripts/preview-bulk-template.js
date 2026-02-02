#!/usr/bin/env node

/**
 * Preview the bulk user upload template
 */

console.log('\n📋 BULK USER UPLOAD TEMPLATE PREVIEW\n');
console.log('=' .repeat(120));
console.log('');

// Template headers and sample data
const headers = ['Email', 'Full Name', 'Phone Number', 'Cohort Tag'];
const sampleData = [
  ['john.doe@example.com', 'John Doe', '+919876543210', 'BATCH2025'],
  ['jane.smith@example.com', 'Jane Smith', '+919876543211', 'BATCH2025'],
  ['user@company.com', 'User Name', '+919876543212', 'BATCH2025'],
];

// Calculate column widths
const colWidths = [30, 25, 18, 15];

// Print header
let headerRow = '| ';
headers.forEach((header, i) => {
  headerRow += header.padEnd(colWidths[i]) + ' | ';
});
console.log(headerRow);
console.log('|' + '-'.repeat(118) + '|');

// Print sample rows
sampleData.forEach((row) => {
  let dataRow = '| ';
  row.forEach((cell, i) => {
    dataRow += cell.padEnd(colWidths[i]) + ' | ';
  });
  console.log(dataRow);
});

console.log('=' .repeat(120));
console.log('');
console.log('📝 TEMPLATE INSTRUCTIONS:');
console.log('');
console.log('1. Email (Required): User\'s email address - used for login');
console.log('2. Full Name (Optional): User\'s full name - displayed in the dashboard');
console.log('3. Phone Number (Optional): User\'s phone with country code (e.g., +919876543210)');
console.log('   • Format: +[country_code][number]');
console.log('   • Example: +919876543210 for India');
console.log('   • If provided, user can login via OTP SMS');
console.log('4. Cohort Tag (Required): Cohort identifier (e.g., BATCH2025, BATCH1, etc.)');
console.log('   • Must match an existing cohort tag in the system');
console.log('');
console.log('💡 NOTES:');
console.log('• All users will be created as "Student" role by default');
console.log('• Users receive calendar invites for future sessions in their cohort');
console.log('• Duplicate emails are automatically skipped');
console.log('• Invalid cohort tags will fail with error message');
console.log('• Phone numbers enable SMS OTP login');
console.log('');
console.log('📊 FILE FORMAT:');
console.log('• Supported: .xlsx, .xls, .csv');
console.log('• Download template from "Bulk Upload" section in User Management');
console.log('');
