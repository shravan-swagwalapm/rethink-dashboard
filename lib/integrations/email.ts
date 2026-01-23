/**
 * Email Service Integration
 * Using Resend for transactional emails
 */

interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private config: EmailConfig;
  private baseUrl = 'https://api.resend.com';

  constructor() {
    this.config = {
      apiKey: process.env.RESEND_API_KEY || '',
      fromEmail: 'noreply@rethink.systems',
      fromName: 'Rethink Systems',
    };
  }

  /**
   * Send email via Resend API
   */
  async send(options: SendEmailOptions): Promise<{ id: string }> {
    if (!this.config.apiKey) {
      console.warn('Resend API key not configured, email not sent');
      return { id: 'mock-email-id' };
    }

    const response = await fetch(`${this.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send email');
    }

    return response.json();
  }

  /**
   * Generate invite email template
   */
  generateInviteEmail(data: {
    name: string;
    cohortName?: string;
    loginUrl: string;
  }): EmailTemplate {
    const { name, cohortName, loginUrl } = data;

    const subject = `Welcome to Rethink Systems${cohortName ? ` - ${cohortName}` : ''}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f14; color: #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <tr>
              <td style="text-align: center; padding-bottom: 32px;">
                <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); border-radius: 16px; line-height: 64px; font-size: 32px;">
                  ✨
                </div>
                <h1 style="margin: 16px 0 0; font-size: 24px; font-weight: 600; background: linear-gradient(135deg, #8b5cf6, #06b6d4); -webkit-background-clip: text; background-clip: text; color: transparent;">
                  Rethink Systems
                </h1>
              </td>
            </tr>
            <tr>
              <td style="background: #1a1a24; border-radius: 16px; padding: 32px;">
                <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #ffffff;">
                  Welcome, ${name}! 🎉
                </h2>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #a3a3a3;">
                  You've been invited to join Rethink Systems${cohortName ? ` as part of ${cohortName}` : ''}. Your journey to mastering product management starts here.
                </p>
                <a href="${loginUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Complete Your Registration
                </a>
                <p style="margin: 24px 0 0; font-size: 14px; color: #666666;">
                  This link expires in 24 hours. If you didn't request this, please ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="text-align: center; padding-top: 32px;">
                <p style="margin: 0; font-size: 14px; color: #666666;">
                  Need help? Contact us at <a href="mailto:support@rethink.systems" style="color: #8b5cf6;">support@rethink.systems</a>
                </p>
                <p style="margin: 16px 0 0; font-size: 12px; color: #444444;">
                  © ${new Date().getFullYear()} Rethink Systems. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Welcome to Rethink Systems${cohortName ? ` - ${cohortName}` : ''}

Hi ${name},

You've been invited to join Rethink Systems${cohortName ? ` as part of ${cohortName}` : ''}. Your journey to mastering product management starts here.

Complete your registration: ${loginUrl}

This link expires in 24 hours.

Need help? Contact us at support@rethink.systems

© ${new Date().getFullYear()} Rethink Systems. All rights reserved.
    `;

    return { subject, html, text };
  }

  /**
   * Generate session reminder email template
   */
  generateSessionReminderEmail(data: {
    name: string;
    sessionTitle: string;
    sessionDate: string;
    sessionTime: string;
    zoomLink?: string;
  }): EmailTemplate {
    const { name, sessionTitle, sessionDate, sessionTime, zoomLink } = data;

    const subject = `Reminder: ${sessionTitle} - Starting Soon`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f0f14; color: #e5e5e5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <tr>
              <td style="text-align: center; padding-bottom: 32px;">
                <div style="display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); border-radius: 16px; line-height: 64px; font-size: 32px;">
                  📅
                </div>
              </td>
            </tr>
            <tr>
              <td style="background: #1a1a24; border-radius: 16px; padding: 32px;">
                <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #ffffff;">
                  Hi ${name}, your session is starting soon!
                </h2>
                <div style="background: #0f0f14; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <h3 style="margin: 0 0 12px; font-size: 18px; color: #8b5cf6;">
                    ${sessionTitle}
                  </h3>
                  <p style="margin: 0 0 8px; font-size: 14px; color: #a3a3a3;">
                    📆 ${sessionDate}
                  </p>
                  <p style="margin: 0; font-size: 14px; color: #a3a3a3;">
                    🕐 ${sessionTime}
                  </p>
                </div>
                ${
                  zoomLink
                    ? `<a href="${zoomLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Join Zoom Meeting
                  </a>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="text-align: center; padding-top: 32px;">
                <p style="margin: 0; font-size: 12px; color: #444444;">
                  © ${new Date().getFullYear()} Rethink Systems. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Session Reminder: ${sessionTitle}

Hi ${name},

Your session is starting soon!

${sessionTitle}
Date: ${sessionDate}
Time: ${sessionTime}

${zoomLink ? `Join Zoom: ${zoomLink}` : ''}

© ${new Date().getFullYear()} Rethink Systems.
    `;

    return { subject, html, text };
  }

  /**
   * Send invite email
   */
  async sendInvite(to: string, name: string, loginUrl: string, cohortName?: string) {
    const template = this.generateInviteEmail({ name, cohortName, loginUrl });
    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send session reminder
   */
  async sendSessionReminder(
    to: string,
    name: string,
    sessionTitle: string,
    sessionDate: string,
    sessionTime: string,
    zoomLink?: string
  ) {
    const template = this.generateSessionReminderEmail({
      name,
      sessionTitle,
      sessionDate,
      sessionTime,
      zoomLink,
    });
    return this.send({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }
}

export const emailService = new EmailService();
