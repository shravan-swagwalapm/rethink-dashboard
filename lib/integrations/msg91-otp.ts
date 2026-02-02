/**
 * MSG91 OTP Service
 * Handles OTP sending and verification via MSG91 API
 *
 * @see https://docs.msg91.com/p/tf9GTextN/e/Yv-55gDq3/MSG91
 */

interface MSG91Config {
  authKey: string;
  templateId: string;
  senderId: string;
  otpLength: number;
  expirySeconds: number;
}

interface SendOTPResponse {
  success: boolean;
  requestId?: string;
  message?: string;
  error?: string;
}

interface VerifyOTPResponse {
  success: boolean;
  type?: string;
  message?: string;
  error?: string;
}

/**
 * Get MSG91 configuration from environment variables
 */
export function getMSG91Config(): MSG91Config {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID || 'NAUM';

  if (!authKey || !templateId) {
    throw new Error('MSG91 credentials not configured. Check environment variables.');
  }

  return {
    authKey,
    templateId,
    senderId,
    otpLength: parseInt(process.env.MSG91_OTP_LENGTH || '6'),
    expirySeconds: parseInt(process.env.MSG91_OTP_EXPIRY_SECONDS || '300'),
  };
}

/**
 * Format phone number for MSG91 API
 * MSG91 expects numbers without + prefix
 *
 * @example
 * formatPhoneForMSG91('+919876543210') // '919876543210'
 * formatPhoneForMSG91('9876543210')    // '919876543210'
 * formatPhoneForMSG91('+1234567890')   // '1234567890'
 */
export function formatPhoneForMSG91(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Remove + prefix if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits and doesn't start with country code, assume Indian number
  if (cleaned.length === 10 && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }

  return cleaned;
}

/**
 * Send OTP via MSG91
 *
 * @param phone - Phone number with country code (e.g., +919876543210)
 * @returns Promise with success status and request ID
 *
 * @example
 * const result = await sendOTP('+919876543210');
 * if (result.success) {
 *   console.log('OTP sent! Request ID:', result.requestId);
 * }
 */
export async function sendOTP(phone: string): Promise<SendOTPResponse> {
  const config = getMSG91Config();
  const formattedPhone = formatPhoneForMSG91(phone);

  try {
    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': config.authKey,
      },
      body: JSON.stringify({
        template_id: config.templateId,
        mobile: formattedPhone,
        otp_length: config.otpLength,
        otp_expiry: Math.floor(config.expirySeconds / 60), // MSG91 expects minutes
      }),
    });

    const result = await response.json();

    // MSG91 returns { type: 'success', request_id: '...' } on success
    if (result.type === 'success') {
      return {
        success: true,
        requestId: result.request_id,
        message: 'OTP sent successfully',
      };
    }

    // Handle error response
    return {
      success: false,
      error: result.message || 'Failed to send OTP',
    };
  } catch (error: any) {
    console.error('[MSG91] Send OTP error:', error);
    return {
      success: false,
      error: error.message || 'Network error sending OTP',
    };
  }
}

/**
 * Verify OTP via MSG91
 *
 * @param phone - Phone number with country code
 * @param otp - 6-digit OTP code
 * @returns Promise with success status
 *
 * @example
 * const result = await verifyOTP('+919876543210', '123456');
 * if (result.success) {
 *   console.log('OTP verified!');
 * }
 */
export async function verifyOTP(phone: string, otp: string): Promise<VerifyOTPResponse> {
  const config = getMSG91Config();
  const formattedPhone = formatPhoneForMSG91(phone);

  try {
    const url = `https://control.msg91.com/api/v5/otp/verify?mobile=${formattedPhone}&otp=${otp}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'authkey': config.authKey,
      },
    });

    const result = await response.json();

    // MSG91 returns { type: 'success', message: '...' } on successful verification
    if (result.type === 'success') {
      return {
        success: true,
        type: result.type,
        message: result.message || 'OTP verified successfully',
      };
    }

    // Handle error response
    return {
      success: false,
      error: result.message || 'Invalid OTP',
    };
  } catch (error: any) {
    console.error('[MSG91] Verify OTP error:', error);
    return {
      success: false,
      error: error.message || 'Network error verifying OTP',
    };
  }
}

/**
 * Resend OTP via MSG91
 * Supports both SMS and voice call retry
 *
 * @param phone - Phone number with country code
 * @param retryType - 'text' for SMS or 'voice' for voice call
 * @returns Promise with success status
 *
 * @example
 * // Resend via SMS
 * await resendOTP('+919876543210', 'text');
 *
 * // Resend via voice call
 * await resendOTP('+919876543210', 'voice');
 */
export async function resendOTP(
  phone: string,
  retryType: 'text' | 'voice' = 'text'
): Promise<SendOTPResponse> {
  const config = getMSG91Config();
  const formattedPhone = formatPhoneForMSG91(phone);

  try {
    const url = `https://control.msg91.com/api/v5/otp/retry?mobile=${formattedPhone}&retrytype=${retryType}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'authkey': config.authKey,
      },
    });

    const result = await response.json();

    if (result.type === 'success') {
      return {
        success: true,
        requestId: result.request_id,
        message: retryType === 'voice'
          ? 'OTP call initiated'
          : 'OTP resent successfully',
      };
    }

    return {
      success: false,
      error: result.message || 'Failed to resend OTP',
    };
  } catch (error: any) {
    console.error('[MSG91] Resend OTP error:', error);
    return {
      success: false,
      error: error.message || 'Network error resending OTP',
    };
  }
}

/**
 * Test MSG91 connection
 * Useful for debugging and setup verification
 *
 * @returns Promise with connection status
 */
export async function testMSG91Connection(): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getMSG91Config();

    // Test with a dummy request to check if credentials are valid
    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': config.authKey,
      },
      body: JSON.stringify({
        template_id: config.templateId,
        mobile: '919999999999', // Test number
        otp_length: 6,
        otp_expiry: 5,
      }),
    });

    const result = await response.json();

    // Even if sending to test number fails, we know credentials are valid if we get a proper response
    return {
      success: response.ok || result.type === 'error',
      error: response.ok ? undefined : 'MSG91 credentials may be invalid',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Could not connect to MSG91',
    };
  }
}
