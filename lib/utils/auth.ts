/**
 * Centralized authentication and authorization utilities
 */

export const ADMIN_ROLES = ['admin', 'super_admin', 'company_user'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role as AdminRole);
}

/**
 * Verify that a user has admin privileges
 * Throws error with appropriate message if not authorized
 */
export function requireAdminRole(role: string | null | undefined, customMessage?: string): void {
  if (!isAdminRole(role)) {
    throw new Error(customMessage || 'Forbidden: Admin access required');
  }
}
