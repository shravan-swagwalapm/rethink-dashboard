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
} as const;

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
      // Fail open - allow request if we can't check rate limit
      return { allowed: true };
    }

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
        return { allowed: true }; // Fail open
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
        return { allowed: true }; // Fail open
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
        return { allowed: true }; // Fail open
      }

      return {
        allowed: true,
        remainingAttempts: RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_WINDOW - 1,
      };
    }
  } catch (error) {
    console.error('[RateLimit] Unexpected error:', error);
    // Fail open on unexpected errors to prevent service disruption
    return { allowed: true };
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
