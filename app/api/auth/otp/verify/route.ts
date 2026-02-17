import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/integrations/msg91-otp';
import { validateVerifyOTPRequest } from '@/lib/services/otp-validator';
import { trackLogin } from '@/lib/services/login-tracker';
import {
  logOTPVerification,
  logSessionCreation,
  logUnexpectedError,
  logSecurityEvent,
  logMetric,
} from '@/lib/services/otp-logger';

const MAX_VERIFY_ATTEMPTS = 5;

/**
 * POST /api/auth/otp/verify
 * Verify OTP and create authentication session
 *
 * Request body:
 * {
 *   identifier: string;       // Phone number
 *   identifierType: 'phone';
 *   otp: string;             // 4-digit OTP
 *   loginMode: 'user' | 'admin'; // Optional, default 'user'
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   authUrl: string;
 *   redirectTo: string;
 *   user: object;
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let identifier: string | undefined;
  let userId: string | undefined;

  try {
    // =====================================================
    // Step 1: Validate and sanitize input
    // =====================================================

    const body = await request.json();
    const validated = validateVerifyOTPRequest(body);
    identifier = validated.identifier;
    const { otp, loginMode } = validated;

    const adminClient = await createAdminClient();

    // =====================================================
    // Step 2: Fetch and validate OTP record
    // =====================================================

    const { data: otpRecord, error: fetchError } = await adminClient
      .from('otp_codes')
      .select('*')
      .eq('identifier', identifier)
      .eq('identifier_type', 'phone')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      logOTPVerification({
        identifier,
        identifierType: 'phone',
        success: false,
        error: 'No OTP found',
      });

      return NextResponse.json(
        { error: 'No OTP found. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if already verified
    if (otpRecord.verified) {
      logSecurityEvent({
        event: 'suspicious_activity',
        identifier,
        details: 'Attempted to reuse verified OTP',
      });

      return NextResponse.json(
        { error: 'OTP already used. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      await adminClient.from('otp_codes').delete().eq('id', otpRecord.id);

      logOTPVerification({
        identifier,
        identifierType: 'phone',
        success: false,
        error: 'OTP expired',
      });

      return NextResponse.json(
        { error: 'OTP expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= MAX_VERIFY_ATTEMPTS) {
      await adminClient.from('otp_codes').delete().eq('id', otpRecord.id);

      logSecurityEvent({
        event: 'max_attempts_exceeded',
        identifier,
        details: `Failed ${MAX_VERIFY_ATTEMPTS} verification attempts`,
      });

      logMetric({
        metric: 'otp_failed',
        value: 1,
        tags: { reason: 'max_attempts' },
      });

      return NextResponse.json(
        { error: 'Too many failed attempts. Please request a new OTP.' },
        { status: 400 }
      );
    }

    // =====================================================
    // Step 3: Verify OTP with MSG91
    // =====================================================

    const verifyResult = await verifyOTP(identifier, otp);

    if (!verifyResult.success) {
      // Increment attempt counter
      await adminClient
        .from('otp_codes')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      const remainingAttempts = MAX_VERIFY_ATTEMPTS - (otpRecord.attempts + 1);

      logOTPVerification({
        identifier,
        identifierType: 'phone',
        success: false,
        attemptNumber: otpRecord.attempts + 1,
        error: verifyResult.error || 'Invalid OTP',
      });

      logMetric({
        metric: 'otp_failed',
        value: 1,
        tags: { reason: 'invalid_code' },
      });

      return NextResponse.json(
        {
          error: verifyResult.error || 'Invalid OTP',
          remainingAttempts: Math.max(0, remainingAttempts),
        },
        { status: 400 }
      );
    }

    // =====================================================
    // Step 4: Find user profile
    // =====================================================

    const { data: userProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, email, phone, role, full_name')
      .eq('phone', identifier)
      .single();

    if (profileError || !userProfile) {
      logOTPVerification({
        identifier,
        identifierType: 'phone',
        success: false,
        error: 'User not found',
      });

      return NextResponse.json(
        { error: 'User not found. Please contact your administrator.' },
        { status: 404 }
      );
    }

    userId = userProfile.id;

    // =====================================================
    // Step 5: Check admin authorization (if admin login)
    // =====================================================

    let redirectTo = '/dashboard';
    let isAuthorized = true;

    if (loginMode === 'admin') {
      // Check both legacy role and new role assignments
      const { data: adminAssignment } = await adminClient
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', userProfile.id)
        .in('role', ['admin', 'company_user'])
        .limit(1);

      const isAdmin =
        userProfile.role === 'admin' ||
        userProfile.role === 'company_user' ||
        (adminAssignment && adminAssignment.length > 0);

      if (!isAdmin) {
        isAuthorized = false;

        logSecurityEvent({
          event: 'suspicious_activity',
          identifier,
          details: 'Non-admin attempted admin login',
        });

        return NextResponse.json(
          {
            error:
              'You do not have administrator privileges. Please login as a regular user.',
          },
          { status: 403 }
        );
      }

      redirectTo = '/admin';
    }

    // =====================================================
    // Step 6: Create Supabase session
    // =====================================================

    const { data: authData, error: authError } =
      await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: userProfile.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });

    if (authError || !authData) {
      logSessionCreation({
        userId: userProfile.id,
        identifier,
        loginMode,
        success: false,
        error: authError?.message || 'Unknown error',
      });

      logMetric({
        metric: 'otp_failed',
        value: 1,
        tags: { reason: 'session_creation_failed' },
      });

      return NextResponse.json(
        { error: 'Failed to create authentication session. Please try again.' },
        { status: 500 }
      );
    }

    // Extract token
    const hashedToken = authData.properties?.hashed_token;

    if (!hashedToken) {
      logSessionCreation({
        userId: userProfile.id,
        identifier,
        loginMode,
        success: false,
        error: 'No hashed token in auth data',
      });

      return NextResponse.json(
        { error: 'Failed to create authentication session.' },
        { status: 500 }
      );
    }

    // =====================================================
    // Step 7: Mark OTP as verified
    // =====================================================

    await adminClient
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    await trackLogin(userProfile.id, 'phone_otp');

    // =====================================================
    // Step 8: Log success and return response
    // =====================================================

    logOTPVerification({
      identifier,
      identifierType: 'phone',
      success: true,
      attemptNumber: otpRecord.attempts + 1,
    });

    logSessionCreation({
      userId: userProfile.id,
      identifier,
      loginMode,
      success: true,
    });

    logMetric({ metric: 'otp_verified', value: 1, tags: { loginMode } });

    const duration = Date.now() - startTime;
    console.log(`[OTP Verify] Success in ${duration}ms`);

    // Construct callback URL
    const authUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?token_hash=${hashedToken}&type=magiclink`;

    return NextResponse.json({
      success: true,
      authUrl,
      redirectTo,
      user: {
        email: userProfile.email,
        name: userProfile.full_name,
        role: userProfile.role,
      },
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

    // Handle custom validation errors
    if (error.message && (error.message.includes('phone') || error.message.includes('OTP'))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Log unexpected errors
    logUnexpectedError({
      operation: 'verify_otp',
      error,
      identifier,
    });

    // Log session creation failure if we got this far
    if (userId) {
      logSessionCreation({
        userId,
        identifier: identifier || 'unknown',
        loginMode: 'user',
        success: false,
        error: error.message,
      });
    }

    logMetric({
      metric: 'otp_failed',
      value: 1,
      tags: { reason: 'unexpected_error' },
    });

    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
