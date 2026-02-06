/**
 * Input sanitization utilities for Supabase PostgREST queries.
 *
 * PostgREST uses special characters in filter syntax:
 *   .  (field separator)
 *   ,  (OR separator in .or() calls)
 *   (  )  (grouping)
 *   %  (LIKE wildcard)
 *   *  (select wildcard)
 *   {  }  (array literals in .cs() / .cd() filters)
 *   "  (quoted identifiers/values)
 *   :  (cast operators)
 *
 * Unsanitized user input in .or() template literals can:
 *   - Break filter parsing (malformed queries)
 *   - Inject additional filter conditions
 *   - Expose unintended data
 */

/**
 * Sanitize a value before using it in a PostgREST .or() or .ilike() filter.
 *
 * Escapes SQL LIKE wildcards (%, _) and PostgREST-special characters
 * that could break or manipulate filter parsing.
 *
 * Usage:
 *   const safe = sanitizeFilterValue(search);
 *   query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`);
 */
export function sanitizeFilterValue(value: string): string {
  return value
    // Escape SQL LIKE wildcards and backslash
    .replace(/[%_\\]/g, '\\$&')
    // Remove PostgREST structural characters that could break .or() parsing
    .replace(/[{}(),.*":]/g, '');
}
