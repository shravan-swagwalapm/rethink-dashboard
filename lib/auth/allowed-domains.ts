// Email domain validation for authentication
//
// POLICY: Allow all Google-verified emails (GSuite, Gmail, any domain)
// The whitelist check in /lib/auth/whitelist.ts ensures only registered
// users can sign in, so domain restriction is not needed for security.
//
// This file only blocks obviously invalid emails and provides utility functions.

// Domains that bypass the whitelist/invite check
// Users from these domains can login without being invited
// NOTE: This does NOT grant admin access - admin role must be set in database
export const WHITELIST_BYPASS_DOMAINS = [
  'naum.systems',
];

// Check if email is valid and from Google OAuth
// We allow ALL domains since Google verifies the email
// The whitelist check handles authorization (only registered users can sign in)
export function isEmailDomainAllowed(email: string): boolean {
  if (!email || !email.includes('@')) {
    return false;
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  // Allow all valid email domains
  // Google OAuth verifies the email, whitelist check handles authorization
  return true;
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
