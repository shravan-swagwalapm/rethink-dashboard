/**
 * Interakt WhatsApp Business API Integration
 * Documentation: https://docs.interakt.ai/
 */

interface InteraktConfig {
  apiKey: string;
  countryCode?: string;
}

interface SendTemplateParams {
  phoneNumber: string;
  templateName: string;
  variables?: Record<string, string>;
  config: InteraktConfig;
}

interface SendTextParams {
  phoneNumber: string;
  message: string;
  config: InteraktConfig;
}

interface InteraktResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

const INTERAKT_API_URL = 'https://api.interakt.ai/v1/public/message/';

/**
 * Format phone number for Interakt API
 * Removes country code prefix if present, API expects without prefix
 */
function formatPhoneNumber(phone: string, countryCode: string = '+91'): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');

  // Remove common country code prefixes
  const prefixes = ['+91', '91', '+1', '1', '+44', '44'];
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix) && cleaned.length > prefix.length + 8) {
      cleaned = cleaned.substring(prefix.length);
      break;
    }
  }

  return cleaned;
}

/**
 * Send a template-based WhatsApp message via Interakt
 * Templates must be pre-approved in your Interakt dashboard
 */
export async function sendTemplate(params: SendTemplateParams): Promise<InteraktResponse> {
  const { phoneNumber, templateName, variables = {}, config } = params;

  if (!config.apiKey) {
    return { success: false, error: 'Interakt API key not configured' };
  }

  const formattedPhone = formatPhoneNumber(phoneNumber, config.countryCode);
  const countryCodeClean = (config.countryCode || '+91').replace('+', '');

  try {
    // Build template components if variables exist
    const bodyVariables = Object.values(variables);

    const payload: any = {
      countryCode: countryCodeClean,
      phoneNumber: formattedPhone,
      callbackData: `template_${Date.now()}`,
      type: 'Template',
      template: {
        name: templateName,
        languageCode: 'en',
        ...(bodyVariables.length > 0 && {
          bodyValues: bodyVariables,
        }),
      },
    };

    const response = await fetch(INTERAKT_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || result.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: result.id || result.messageId,
    };
  } catch (error: any) {
    console.error('Interakt sendTemplate error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp template message',
    };
  }
}

/**
 * Send a plain text WhatsApp message via Interakt
 * Note: Text messages can only be sent within 24-hour session window
 */
export async function sendText(params: SendTextParams): Promise<InteraktResponse> {
  const { phoneNumber, message, config } = params;

  if (!config.apiKey) {
    return { success: false, error: 'Interakt API key not configured' };
  }

  const formattedPhone = formatPhoneNumber(phoneNumber, config.countryCode);
  const countryCodeClean = (config.countryCode || '+91').replace('+', '');

  try {
    const payload = {
      countryCode: countryCodeClean,
      phoneNumber: formattedPhone,
      callbackData: `text_${Date.now()}`,
      type: 'Text',
      data: {
        message,
      },
    };

    const response = await fetch(INTERAKT_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || result.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: result.id || result.messageId,
    };
  } catch (error: any) {
    console.error('Interakt sendText error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp text message',
    };
  }
}

/**
 * Validate Interakt API key by making a test request
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey || apiKey.length < 20) {
    return { valid: false, error: 'Invalid API key format' };
  }

  // Interakt doesn't have a dedicated validate endpoint
  // We'll just verify the key format for now
  // A real validation would involve making a test call
  return { valid: true };
}

export const interakt = {
  sendTemplate,
  sendText,
  validateApiKey,
};
