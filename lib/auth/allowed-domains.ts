// Allowed email domains for authentication
// Users can only login if their email domain is in this list
// Start with Gmail only, extend later for other providers

export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'naum.systems', // Superuser domain - auto-admin access
  // Future domains to add:
  // 'yahoo.com',
  // 'yahoo.co.in',
  // 'rediffmail.com',
  // 'rediff.com',
  // 'outlook.com',
  // 'hotmail.com',
  // 'live.com',
];

// Superuser domains - all emails from these domains get auto-admin access
// No need to be in invites table, bypasses whitelist check
export const SUPERUSER_DOMAINS = [
  'naum.systems',
];

export function isEmailDomainAllowed(email: string): boolean {
  if (!email || !email.includes('@')) {
    return false;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

export function getEmailDomain(email: string): string | null {
  if (!email || !email.includes('@')) {
    return null;
  }
  return email.split('@')[1]?.toLowerCase() || null;
}

// Check if email is from a superuser domain
// Superuser domains bypass whitelist check and get auto-admin access
export function isSuperuserDomain(email: string): boolean {
  const domain = getEmailDomain(email);
  return domain ? SUPERUSER_DOMAINS.includes(domain) : false;
}
