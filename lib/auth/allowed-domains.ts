// Allowed email domains for authentication
// Users can only login if their email domain is in this list
// Start with Gmail only, extend later for other providers

export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'naum.systems', // Company domain - bypasses whitelist but NOT auto-admin
  // Future domains to add:
  // 'yahoo.com',
  // 'yahoo.co.in',
  // 'rediffmail.com',
  // 'rediff.com',
  // 'outlook.com',
  // 'hotmail.com',
  // 'live.com',
];

// Domains that bypass the whitelist/invite check
// Users from these domains can login without being invited
// NOTE: This does NOT grant admin access - admin role must be set in database
export const WHITELIST_BYPASS_DOMAINS = [
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

// Check if email bypasses whitelist check (can login without being invited)
// NOTE: This does NOT grant admin access - admin role must be set in database
export function bypassesWhitelist(email: string): boolean {
  const domain = getEmailDomain(email);
  return domain ? WHITELIST_BYPASS_DOMAINS.includes(domain) : false;
}
