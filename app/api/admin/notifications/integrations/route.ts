import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper to verify admin access
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

// GET - Fetch all integration settings
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    const { data: integrations, error } = await adminClient
      .from('notification_integrations')
      .select('*')
      .order('channel', { ascending: true });

    if (error) throw error;

    // Mask sensitive data (API keys)
    const maskedIntegrations = (integrations || []).map(integration => ({
      ...integration,
      config: maskSensitiveConfig(integration.config),
    }));

    return NextResponse.json({ data: maskedIntegrations });
  } catch (error: any) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}

// PATCH - Update integration settings
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { channel, provider, is_active, config, test_mode } = body;

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel is required' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // First, get existing config to preserve sensitive data
    const { data: existing } = await adminClient
      .from('notification_integrations')
      .select('config')
      .eq('channel', channel)
      .single();

    // Merge new config with existing, preserving API keys if not provided
    let finalConfig = config || {};
    if (existing?.config) {
      finalConfig = {
        ...existing.config,
        ...config,
      };

      // If api_key is masked (ends with ***), keep the original
      if (finalConfig.api_key && finalConfig.api_key.includes('***')) {
        finalConfig.api_key = existing.config.api_key;
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (provider !== undefined) updateData.provider = provider;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (config !== undefined) updateData.config = finalConfig;
    if (test_mode !== undefined) updateData.test_mode = test_mode;

    // Upsert the integration
    const { data: integration, error } = await adminClient
      .from('notification_integrations')
      .upsert(
        {
          channel,
          ...updateData,
          created_by: auth.userId,
        },
        { onConflict: 'channel' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      data: {
        ...integration,
        config: maskSensitiveConfig(integration.config),
      },
    });
  } catch (error: any) {
    console.error('Error updating integration:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update integration' },
      { status: 500 }
    );
  }
}

// POST - Test integration connection
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { channel, test_recipient } = body;

    if (!channel) {
      return NextResponse.json(
        { error: 'Channel is required' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Get integration config
    const { data: integration, error: fetchError } = await adminClient
      .from('notification_integrations')
      .select('*')
      .eq('channel', channel)
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      );
    }

    let testResult = { success: false, message: '' };

    // Test based on channel
    if (channel === 'email') {
      testResult = await testEmailIntegration(integration, test_recipient);
    } else if (channel === 'sms') {
      testResult = await testSmsIntegration(integration, test_recipient);
    } else if (channel === 'whatsapp') {
      testResult = await testWhatsAppIntegration(integration, test_recipient);
    }

    // Update test status in database
    await adminClient
      .from('notification_integrations')
      .update({
        last_tested_at: new Date().toISOString(),
        test_status: testResult.success ? 'success' : 'failed',
      })
      .eq('channel', channel);

    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
    });
  } catch (error: any) {
    console.error('Error testing integration:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to test integration' },
      { status: 500 }
    );
  }
}

// Helper to mask sensitive data
function maskSensitiveConfig(config: any): any {
  if (!config) return {};

  const masked = { ...config };
  const sensitiveKeys = ['api_key', 'auth_token', 'secret', 'password', 'account_sid'];

  for (const key of sensitiveKeys) {
    if (masked[key]) {
      const value = masked[key];
      if (typeof value === 'string' && value.length > 8) {
        masked[key] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
      } else if (typeof value === 'string') {
        masked[key] = '********';
      }
    }
  }

  return masked;
}

// Test Email Integration
async function testEmailIntegration(
  integration: any,
  testRecipient?: string
): Promise<{ success: boolean; message: string }> {
  const provider = integration.config?.provider || integration.provider || 'resend';
  const config = integration.config || {};

  // Use custom API key if provided, otherwise fall back to env var for default provider
  const isDefaultProvider = provider === 'resend';
  const apiKey = config.api_key || (isDefaultProvider ? process.env.RESEND_API_KEY : null);

  if (!apiKey) {
    return {
      success: false,
      message: isDefaultProvider
        ? 'No API key configured. Set one in Settings or via RESEND_API_KEY environment variable.'
        : `No API key configured for ${provider}. Please enter your API key in Settings.`,
    };
  }

  try {
    // Currently only Resend is fully implemented
    if (provider === 'resend') {
      // Test API key validity by fetching domains
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: `Resend API error: ${error.message || 'Invalid API key'}`,
        };
      }

      // Optionally send a test email
      if (testRecipient) {
        const fromEmail = config.from_email || 'notifications@rethink.com';
        const fromName = config.from_name || 'Rethink Systems';

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: testRecipient,
            subject: 'Test Email from Rethink Notifications',
            html: '<h1>Test Email</h1><p>This is a test email from your notification system. If you received this, your email integration is working correctly!</p>',
          }),
        });

        if (!emailResponse.ok) {
          const error = await emailResponse.json();
          return {
            success: false,
            message: `Failed to send test email: ${error.message || 'Unknown error'}`,
          };
        }

        return {
          success: true,
          message: `Email integration working! Test email sent to ${testRecipient}`,
        };
      }

      return {
        success: true,
        message: 'Email integration configured correctly (Resend API key valid)',
      };
    }

    // Other providers - just verify API key is provided
    return {
      success: true,
      message: `${provider} configured with API key. Full testing not yet implemented - send a real email to verify.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Email test failed: ${error.message}`,
    };
  }
}

// Test SMS Integration
async function testSmsIntegration(
  integration: any,
  testRecipient?: string
): Promise<{ success: boolean; message: string }> {
  const config = integration.config || {};
  const provider = config.provider || integration.provider || 'twilio';
  const isDefaultProvider = provider === 'twilio';

  if (provider === 'twilio' || provider === 'vonage' || provider === 'plivo') {
    // Use custom credentials if provided, otherwise fall back to env vars for default provider
    const accountSid = config.account_sid || (isDefaultProvider ? process.env.TWILIO_ACCOUNT_SID : null);
    const authToken = config.auth_token || (isDefaultProvider ? process.env.TWILIO_AUTH_TOKEN : null);

    if (!accountSid || !authToken) {
      return {
        success: false,
        message: isDefaultProvider
          ? 'No credentials configured. Set them in Settings or via TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.'
          : `No credentials configured for ${provider}. Please enter your Account SID and Auth Token in Settings.`,
      };
    }

    try {
      if (provider === 'twilio') {
        // Test credentials by fetching account info
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            },
          }
        );

        if (!response.ok) {
          return {
            success: false,
            message: 'Invalid Twilio credentials',
          };
        }

        return {
          success: true,
          message: 'Twilio integration configured correctly',
        };
      }

      // Other providers - just verify credentials are provided
      return {
        success: true,
        message: `${provider} configured with credentials. Full testing not yet implemented.`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `${provider} test failed: ${error.message}`,
      };
    }
  }

  if (provider === 'msg91') {
    const authKey = config.auth_key;
    if (!authKey) {
      return {
        success: false,
        message: 'MSG91 auth key not configured. Please enter your auth key in Settings.',
      };
    }
    return {
      success: true,
      message: 'MSG91 configured with auth key. Full testing not yet implemented.',
    };
  }

  if (provider === 'sns') {
    const accessKey = config.access_key;
    const secretKey = config.secret_key;
    if (!accessKey || !secretKey) {
      return {
        success: false,
        message: 'AWS SNS credentials not configured. Please enter your AWS credentials in Settings.',
      };
    }
    return {
      success: true,
      message: 'AWS SNS configured with credentials. Full testing not yet implemented.',
    };
  }

  return {
    success: false,
    message: `SMS provider "${provider}" not yet supported`,
  };
}

// Test WhatsApp Integration
async function testWhatsAppIntegration(
  integration: any,
  testRecipient?: string
): Promise<{ success: boolean; message: string }> {
  const config = integration.config || {};
  const provider = config.provider || integration.provider || 'interakt';
  const isDefaultProvider = provider === 'interakt';

  // Use custom API key if provided, otherwise fall back to env var for default provider
  const apiKey = config.api_key || (isDefaultProvider ? process.env.INTERAKT_API_KEY : null);

  if (!apiKey) {
    return {
      success: false,
      message: isDefaultProvider
        ? 'No API key configured. Set one in Settings or via INTERAKT_API_KEY environment variable.'
        : `No API key configured for ${provider}. Please enter your API key in Settings.`,
    };
  }

  try {
    if (provider === 'interakt') {
      // Test API key by verifying format
      if (apiKey.length < 20) {
        return {
          success: false,
          message: 'Invalid Interakt API key format',
        };
      }

      // If test recipient provided, send a test message
      if (testRecipient) {
        const countryCode = config.country_code || '+91';
        const response = await fetch('https://api.interakt.ai/v1/public/message/', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            countryCode: countryCode.replace('+', ''),
            phoneNumber: testRecipient.replace(/^\+\d+/, ''),
            callbackData: 'test',
            type: 'Text',
            data: {
              message: 'Test message from Rethink Notifications',
            },
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return {
            success: false,
            message: `Interakt API error: ${error.message || 'Failed to send test message'}`,
          };
        }

        return {
          success: true,
          message: `WhatsApp integration working! Test message sent to ${testRecipient}`,
        };
      }

      return {
        success: true,
        message: 'Interakt API key configured (send test message to verify fully)',
      };
    }

    if (provider === 'twilio_wa') {
      const accountSid = config.account_sid;
      const authToken = config.auth_token;

      if (!accountSid || !authToken) {
        return {
          success: false,
          message: 'Twilio WhatsApp credentials not configured. Please enter Account SID and Auth Token.',
        };
      }

      // Verify Twilio credentials
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          message: 'Invalid Twilio credentials',
        };
      }

      return {
        success: true,
        message: 'Twilio WhatsApp integration configured correctly',
      };
    }

    // Other providers - just verify API key is provided
    return {
      success: true,
      message: `${provider} configured with API key. Full testing not yet implemented.`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `WhatsApp test failed: ${error.message}`,
    };
  }
}
