import { NextRequest, NextResponse } from 'next/server';
import { resendOTP } from '@/lib/integrations/msg91-otp';
import { checkRateLimit } from '@/lib/services/otp-rate-limiter';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Validation schema
const resendOTPSchema = z.object({
  identifier: z.string().min(1, 'Phone number required'),
  identifierType: z.enum(['phone', 'email']),
  retryType: z.enum(['text', 'voice']).optional().default('text'),
});

/**
 * POST /api/auth/otp/resend
 * Resend OTP via SMS or voice call
 *
 * Request body:
 * {
 *   identifier: string;       // Phone number
 *   identifierType: 'phone';  // Only phone supported for resend
 *   retryType: 'text' | 'voice'; // Optional, default 'text'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = resendOTPSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid request data' },
        { status: 400 }
      );
    }

    const { identifier, identifierType, retryType } = validation.data;
    const normalizedIdentifier = identifier.toLowerCase().trim();

    // Only support phone resend (email uses magic link which can be re-requested via send endpoint)
    if (identifierType !== 'phone') {
      return NextResponse.json(
        { error: 'Resend is only available for phone numbers. For email, please request a new login link.' },
        { status: 400 }
      );
    }

    // =====================================================
    // Check rate limits
    // =====================================================

    const supabase = await createAdminClient();
    const rateLimitResult = await checkRateLimit(
      supabase,
      normalizedIdentifier,
      'phone'
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: rateLimitResult.error },
        { status: 429 }
      );
    }

    // =====================================================
    // Resend OTP via MSG91
    // =====================================================

    const result = await resendOTP(normalizedIdentifier, retryType);

    if (!result.success) {
      console.error('[OTP Resend] MSG91 error:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to resend OTP. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || (retryType === 'voice' ? 'OTP call initiated' : 'OTP resent successfully'),
      requestId: result.requestId,
    });
  } catch (error: any) {
    console.error('[OTP Resend] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
