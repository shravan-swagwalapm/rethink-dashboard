/**
 * Zoom Integration
 * Webhook handling for attendance tracking
 */

import crypto from 'crypto';

interface ZoomWebhookEvent {
  event: string;
  payload: {
    object: {
      id: string;
      uuid: string;
      topic: string;
      start_time: string;
      duration: number;
      participant?: {
        user_id: string;
        user_name: string;
        email: string;
        join_time: string;
        leave_time?: string;
        duration?: number;
      };
    };
  };
}

interface ZoomParticipant {
  userId: string;
  email: string;
  name: string;
  joinTime: Date;
  leaveTime?: Date;
  duration?: number;
}

export class ZoomService {
  private apiKey: string;
  private apiSecret: string;
  private webhookSecret: string;

  constructor() {
    this.apiKey = process.env.ZOOM_API_KEY || '';
    this.apiSecret = process.env.ZOOM_API_SECRET || '';
    this.webhookSecret = process.env.ZOOM_WEBHOOK_SECRET || '';
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    if (!this.webhookSecret) {
      console.warn('Zoom webhook secret not configured');
      return false;
    }

    const message = `v0:${timestamp}:${payload}`;
    const expectedSignature = `v0=${crypto
      .createHmac('sha256', this.webhookSecret)
      .update(message)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Handle webhook challenge (URL validation)
   */
  handleChallenge(plainToken: string): string {
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(plainToken)
      .digest('hex');

    return hash;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(event: ZoomWebhookEvent): {
    type: 'participant.joined' | 'participant.left' | 'meeting.ended' | 'unknown';
    meetingId: string;
    participant?: ZoomParticipant;
  } {
    const { event: eventType, payload } = event;

    const result: {
      type: 'participant.joined' | 'participant.left' | 'meeting.ended' | 'unknown';
      meetingId: string;
      participant?: ZoomParticipant;
    } = {
      type: 'unknown',
      meetingId: payload.object.id,
    };

    switch (eventType) {
      case 'meeting.participant_joined':
        result.type = 'participant.joined';
        if (payload.object.participant) {
          result.participant = {
            userId: payload.object.participant.user_id,
            email: payload.object.participant.email,
            name: payload.object.participant.user_name,
            joinTime: new Date(payload.object.participant.join_time),
          };
        }
        break;

      case 'meeting.participant_left':
        result.type = 'participant.left';
        if (payload.object.participant) {
          result.participant = {
            userId: payload.object.participant.user_id,
            email: payload.object.participant.email,
            name: payload.object.participant.user_name,
            joinTime: new Date(payload.object.participant.join_time),
            leaveTime: payload.object.participant.leave_time
              ? new Date(payload.object.participant.leave_time)
              : new Date(),
            duration: payload.object.participant.duration,
          };
        }
        break;

      case 'meeting.ended':
        result.type = 'meeting.ended';
        break;
    }

    return result;
  }

  /**
   * Calculate attendance percentage
   */
  calculateAttendancePercentage(
    joinTime: Date,
    leaveTime: Date,
    meetingDurationMinutes: number
  ): number {
    const attendedDuration = (leaveTime.getTime() - joinTime.getTime()) / 1000 / 60; // in minutes
    const percentage = (attendedDuration / meetingDurationMinutes) * 100;
    return Math.min(100, Math.round(percentage * 100) / 100); // Cap at 100%, round to 2 decimals
  }

  /**
   * Generate JWT for API calls (if needed)
   */
  generateJWT(): string {
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' })
    ).toString('base64url');

    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({
        iss: this.apiKey,
        exp: now + 3600, // 1 hour
      })
    ).toString('base64url');

    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }
}

export const zoomService = new ZoomService();
