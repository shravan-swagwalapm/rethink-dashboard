import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendOTP } from '@/lib/integrations/msg91-otp';
import { isEmailWhitelisted } from '@/lib/auth/whitelist';
import { checkRateLimit } from '@/lib/services/otp-rate-limiter';
import { validateSendOTPRequest } from '@/lib/services/otp-validator';
import {
  logOTPSent,
  logRateLimitTriggered,
  logMSG91Error,
  logUnexpectedError,
  logMetric,
} from '@/lib/services/otp-logger';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes

/**
 * POST /api/auth/otp/send
 * Send OTP to phone number via MSG91
 *
 * Request body:
 * {
 *   identifier: string;    // Phone number
 *   identifierType: 'phone';
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   message: string;
 *   expiresIn: number;
 *   requestId?: string;
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let identifier: string | undefined;

  try {
    // =====================================================
    // Step 1: Validate and sanitize input
    // =====================================================

    const body = await request.json();
    const validated = validateSendOTPRequest(body);
    identifier = validated.identifier;

    // =====================================================
    // Step 2: Check rate limits
    // =====================================================

    const supabase = await createAdminClient();
    const rateLimitResult = await checkRateLimit(
      supabase,
      identifier,
      'phone'
    );

    if (!rateLimitResult.allowed) {
      logRateLimitTriggered({
        identifier,
        identifierType: 'phone',
        requestCount: 0, // TODO: Get from rate limit result
        blockedUntil: rateLimitResult.blockedUntil,
      });

      logMetric({ metric: 'rate_limited', value: 1, tags: { type: 'phone' } });

      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      );
    }

    // =====================================================
    // Step 3: Verify user exists in system
    // =====================================================

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, phone, full_name, role')
      .eq('phone', identifier)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        {
          error: 'Phone number not registered. Please contact your administrator for access.',
        },
        { status: 404 }
      );
    }

    // =====================================================
    // Step 4: Invalidate existing OTPs for this identifier
    // =====================================================

    const { error: deleteError } = await supabase
      .from('otp_codes')
      .delete()
      .eq('identifier', identifier)
      .eq('identifier_type', 'phone');

    if (deleteError) {
      console.error('[OTP Send] Error deleting old OTPs:', deleteError);
      // Continue anyway - not critical
    }

    // =====================================================
    // Step 5: Send OTP via MSG91
    // =====================================================

    const result = await sendOTP(identifier);

    if (!result.success) {
      logMSG91Error({
        operation: 'send',
        identifier,
        error: result.error || 'Unknown error',
      });

      logMetric({ metric: 'otp_failed', value: 1, tags: { reason: 'msg91_error' } });

      return NextResponse.json(
        { error: result.error || 'Failed to send OTP. Please try again.' },
        { status: 500 }
      );
    }

    // =====================================================
    // Step 6: Store OTP record for tracking
    // =====================================================

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

    const { error: insertError } = await supabase.from('otp_codes').insert({
      identifier,
      identifier_type: 'phone',
      code: 'MSG91_MANAGED', // MSG91 manages the actual code
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      console.error('[OTP Send] Error storing OTP record:', insertError);
      // Continue anyway - OTP was sent successfully
    }

    // =====================================================
    // Step 7: Log success and return response
    // =====================================================

    logOTPSent({
      identifier,
      identifierType: 'phone',
      requestId: result.requestId,
      expiresIn: OTP_EXPIRY_SECONDS,
    });

    logMetric({ metric: 'otp_sent', value: 1, tags: { type: 'phone' } });

    const duration = Date.now() - startTime;
    console.log(`[OTP Send] Success in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your phone number',
      expiresIn: OTP_EXPIRY_SECONDS,
      requestId: result.requestId,
    });
  } catch (error: any) {
    // Handle validation errors
    if (error.name === 'ZodError') {
      const firstError = error.errors?.[0];
      return NextResponse.json(
        { error: firstError?.message || 'Invalid request data' },
        { status: 400 }
      );
    }

    // Handle custom validation errors (from sanitization)
    if (error.message && error.message.includes('phone')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log unexpected errors
    logUnexpectedError({
      operation: 'send_otp',
      error,
      identifier,
    });

    logMetric({ metric: 'otp_failed', value: 1, tags: { reason: 'unexpected_error' } });

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
