/**
 * SMS Integration Service
 * Supports multiple providers: Twilio, MSG91
 */

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

interface MSG91Config {
  authKey: string;
  senderId: string;
}

interface SmsConfig {
  provider: 'twilio' | 'msg91';
  twilio?: TwilioConfig;
  msg91?: MSG91Config;
}

interface SendSmsParams {
  to: string;
  message: string;
  config: SmsConfig;
}

interface SmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Format phone number for SMS providers
 * Ensures proper E.164 format for international numbers
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '').replace(/\(/g, '').replace(/\)/g, '');

  // Add + prefix if not present and starts with country code
  if (!cleaned.startsWith('+') && cleaned.length >= 11) {
    cleaned = '+' + cleaned;
  }

  // Default to India country code if no prefix
  if (!cleaned.startsWith('+') && cleaned.length === 10) {
    cleaned = '+91' + cleaned;
  }

  return cleaned;
}

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(to: string, message: string, config: TwilioConfig): Promise<SmsResponse> {
  const { accountSid, authToken, phoneNumber } = config;

  if (!accountSid || !authToken || !phoneNumber) {
    return { success: false, error: 'Twilio credentials not configured' };
  }

  try {
    const formattedTo = formatPhoneNumber(to);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: phoneNumber,
        Body: message,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || `Twilio error: ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error: any) {
    console.error('Twilio send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send SMS via Twilio',
    };
  }
}

/**
 * Send SMS via MSG91
 */
async function sendViaMSG91(to: string, message: string, config: MSG91Config): Promise<SmsResponse> {
  const { authKey, senderId } = config;

  if (!authKey || !senderId) {
    return { success: false, error: 'MSG91 credentials not configured' };
  }

  try {
    const formattedTo = formatPhoneNumber(to);
    // Remove + for MSG91
    const mobileNumber = formattedTo.replace('+', '');

    const url = 'https://api.msg91.com/api/v5/flow/';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authkey: authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: senderId,
        route: '4', // Transactional
        country: '91',
        sms: [
          {
            message,
            to: [mobileNumber],
          },
        ],
      }),
    });

    const result = await response.json();

    if (!response.ok || result.type === 'error') {
      return {
        success: false,
        error: result.message || `MSG91 error: ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: result.request_id,
    };
  } catch (error: any) {
    console.error('MSG91 send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send SMS via MSG91',
    };
  }
}

/**
 * Send SMS using configured provider
 */
export async function sendSms(params: SendSmsParams): Promise<SmsResponse> {
  const { to, message, config } = params;

  if (config.provider === 'twilio' && config.twilio) {
    return sendViaTwilio(to, message, config.twilio);
  }

  if (config.provider === 'msg91' && config.msg91) {
    return sendViaMSG91(to, message, config.msg91);
  }

  return {
    success: false,
    error: `SMS provider "${config.provider}" not configured`,
  };
}

/**
 * Validate Twilio credentials
 */
export async function validateTwilio(config: TwilioConfig): Promise<{ valid: boolean; error?: string }> {
  const { accountSid, authToken } = config;

  if (!accountSid || !authToken) {
    return { valid: false, error: 'Missing credentials' };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
      }
    );

    if (!response.ok) {
      return { valid: false, error: 'Invalid Twilio credentials' };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

export const sms = {
  send: sendSms,
  validateTwilio,
};
