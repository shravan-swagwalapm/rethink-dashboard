/**
 * OTP Rate Limiting Service
 *
 * Extracted from API routes for better testability and maintainability.
 * Handles rate limiting logic with clear separation of concerns.
 *
 * @module otp-rate-limiter
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Configuration constants
export const RATE_LIMIT_CONFIG = {
  WINDOW_MINUTES: 15,
  MAX_REQUESTS_PER_WINDOW: 5,
  BLOCK_DURATION_MINUTES: 30,
  /** Number of consecutive DB failures before we deny requests (fail-closed) */
  MAX_DB_FAILURES_BEFORE_DENY: 2,
  /** Time-to-live for in-memory fallback entries (ms) */
  FALLBACK_TTL_MS: 15 * 60 * 1000, // 15 minutes
} as const;

// ---------------------------------------------------------------------------
// In-memory fallback: tracks per-identifier request counts and consecutive
// DB errors so that a sustained database outage cannot be exploited to
// bypass rate limiting entirely (fail-closed after threshold).
// ---------------------------------------------------------------------------

interface FallbackEntry {
  /** Consecutive DB failures for this identifier */
  dbFailures: number;
  /** Total requests tracked while DB is down */
  requestCount: number;
  /** Timestamp of first request in the current in-memory window */
  windowStart: number;
}

const fallbackStore = new Map<string, FallbackEntry>();

function getFallbackKey(identifier: string, identifierType: string): string {
  return `${identifierType}:${identifier}`;
}

/** Clean up stale entries older than the TTL */
function pruneStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of fallbackStore) {
    if (now - entry.windowStart > RATE_LIMIT_CONFIG.FALLBACK_TTL_MS) {
      fallbackStore.delete(key);
    }
  }
}

/**
 * Record a DB failure for the given identifier. Returns the current
 * consecutive failure count.
 */
function recordDbFailure(identifier: string, identifierType: string): number {
  pruneStaleEntries();
  const key = getFallbackKey(identifier, identifierType);
  const existing = fallbackStore.get(key);
  if (existing) {
    existing.dbFailures += 1;
    existing.requestCount += 1;
    return existing.dbFailures;
  }
  fallbackStore.set(key, { dbFailures: 1, requestCount: 1, windowStart: Date.now() });
  return 1;
}

/**
 * Reset the DB failure counter on a successful DB interaction, keeping
 * the entry for request-count tracking.
 */
function resetDbFailures(identifier: string, identifierType: string): void {
  const key = getFallbackKey(identifier, identifierType);
  const existing = fallbackStore.get(key);
  if (existing) {
    existing.dbFailures = 0;
  }
}

/**
 * Check the in-memory fallback. Returns a RateLimitResult when the
 * request should be denied, or `null` if the fallback allows it.
 */
function checkFallback(identifier: string, identifierType: string): RateLimitResult | null {
  pruneStaleEntries();
  const key = getFallbackKey(identifier, identifierType);
  const entry = fallbackStore.get(key);
  if (!entry) return null;

  // If the in-memory counter already exceeds the per-window max, deny
  if (entry.requestCount >= RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      error: 'Too many OTP requests. Please try again later.',
    };
  }
  return null;
}

/**
 * Evaluate a DB error and decide whether to allow the request.
 * Returns `{ allowed: true }` only when consecutive failures are below
 * the threshold; returns `{ allowed: false }` once the threshold is met.
 */
function handleDbError(
  identifier: string,
  identifierType: string,
  context: string
): RateLimitResult {
  const failures = recordDbFailure(identifier, identifierType);
  if (failures >= RATE_LIMIT_CONFIG.MAX_DB_FAILURES_BEFORE_DENY) {
    console.error(
      `[RateLimit] ${context}: ${failures} consecutive DB failures for ${identifierType}:${identifier} – denying request (fail-closed)`
    );
    return {
      allowed: false,
      error: 'Service temporarily unavailable. Please try again later.',
    };
  }
  // First transient failure – allow but log a warning
  console.warn(
    `[RateLimit] ${context}: transient DB failure (${failures}/${RATE_LIMIT_CONFIG.MAX_DB_FAILURES_BEFORE_DENY}) – allowing request`
  );
  return { allowed: true };
}

export interface RateLimitResult {
  allowed: boolean;
  error?: string;
  remainingAttempts?: number;
  blockedUntil?: Date;
}

export interface RateLimitRecord {
  id: string;
  identifier: string;
  identifier_type: 'phone' | 'email';
  request_count: number;
  window_start: string;
  blocked_until: string | null;
}

/**
 * Check and update rate limit for an identifier
 *
 * @param supabase - Supabase admin client
 * @param identifier - Phone number or email
 * @param identifierType - Type of identifier
 * @returns Rate limit result with allowed status
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  identifierType: 'phone' | 'email'
): Promise<RateLimitResult> {
  try {
    // Check in-memory fallback first (catches abuse during DB outages)
    const fallbackDeny = checkFallback(identifier, identifierType);
    if (fallbackDeny) {
      return fallbackDeny;
    }

    // Fetch existing rate limit record
    const { data: rateLimit, error: fetchError } = await supabase
      .from('otp_rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('identifier_type', identifierType)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = not found, which is okay
      console.error('[RateLimit] Error fetching rate limit:', fetchError);
      return handleDbError(identifier, identifierType, 'Error fetching rate limit');
    }

    // DB read succeeded – reset failure counter
    resetDbFailures(identifier, identifierType);

    // No existing record - create new one
    if (!rateLimit) {
      const { error: insertError } = await supabase
        .from('otp_rate_limits')
        .insert({
          identifier,
          identifier_type: identifierType,
          request_count: 1,
          window_start: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[RateLimit] Error creating rate limit record:', insertError);
        return handleDbError(identifier, identifierType, 'Error creating rate limit record');
      }

      return {
        allowed: true,
        remainingAttempts: RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_WINDOW - 1,
      };
    }

    // Check if currently blocked
    if (rateLimit.blocked_until) {
      const blockedUntil = new Date(rateLimit.blocked_until);
      if (blockedUntil > new Date()) {
        const remainingMinutes = Math.ceil(
          (blockedUntil.getTime() - Date.now()) / 60000
        );
        return {
          allowed: false,
          error: `Too many OTP requests. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
          blockedUntil,
        };
      }
    }

    // Check if within rate limit window
    const windowStart = new Date(rateLimit.window_start);
    const windowEnd = new Date(
      windowStart.getTime() + RATE_LIMIT_CONFIG.WINDOW_MINUTES * 60000
    );
    const now = new Date();

    if (now < windowEnd) {
      // Still in current window
      if (rateLimit.request_count >= RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_WINDOW) {
        // Block the user
        const blockedUntil = new Date(
          Date.now() + RATE_LIMIT_CONFIG.BLOCK_DURATION_MINUTES * 60000
        );

        const { error: updateError } = await supabase
          .from('otp_rate_limits')
          .update({ blocked_until: blockedUntil.toISOString() })
          .eq('id', rateLimit.id);

        if (updateError) {
          console.error('[RateLimit] Error blocking user:', updateError);
          // Still deny – we know the limit was exceeded from the DB read
        }

        return {
          allowed: false,
          error: `Too many OTP requests. You have been temporarily blocked for ${RATE_LIMIT_CONFIG.BLOCK_DURATION_MINUTES} minutes.`,
          blockedUntil,
        };
      }

      // Increment counter
      const { error: updateError } = await supabase
        .from('otp_rate_limits')
        .update({ request_count: rateLimit.request_count + 1 })
        .eq('id', rateLimit.id);

      if (updateError) {
        console.error('[RateLimit] Error incrementing counter:', updateError);
        return handleDbError(identifier, identifierType, 'Error incrementing counter');
      }

      return {
        allowed: true,
        remainingAttempts:
          RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_WINDOW - (rateLimit.request_count + 1),
      };
    } else {
      // Window expired - reset counter
      const { error: updateError } = await supabase
        .from('otp_rate_limits')
        .update({
          request_count: 1,
          window_start: now.toISOString(),
          blocked_until: null,
        })
        .eq('id', rateLimit.id);

      if (updateError) {
        console.error('[RateLimit] Error resetting window:', updateError);
        return handleDbError(identifier, identifierType, 'Error resetting window');
      }

      return {
        allowed: true,
        remainingAttempts: RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_WINDOW - 1,
      };
    }
  } catch (error) {
    console.error('[RateLimit] Unexpected error:', error);
    return handleDbError(identifier, identifierType, 'Unexpected error');
  }
}

/**
 * Reset rate limit for an identifier (admin operation)
 *
 * @param supabase - Supabase admin client
 * @param identifier - Phone number or email
 * @param identifierType - Type of identifier
 */
export async function resetRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  identifierType: 'phone' | 'email'
): Promise<void> {
  await supabase
    .from('otp_rate_limits')
    .delete()
    .eq('identifier', identifier)
    .eq('identifier_type', identifierType);
}

/**
 * Get rate limit status for an identifier (monitoring/debugging)
 *
 * @param supabase - Supabase admin client
 * @param identifier - Phone number or email
 * @param identifierType - Type of identifier
 */
export async function getRateLimitStatus(
  supabase: SupabaseClient,
  identifier: string,
  identifierType: 'phone' | 'email'
): Promise<RateLimitRecord | null> {
  const { data } = await supabase
    .from('otp_rate_limits')
    .select('*')
    .eq('identifier', identifier)
    .eq('identifier_type', identifierType)
    .single();

  return data;
}
