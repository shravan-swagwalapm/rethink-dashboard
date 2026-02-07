/**
 * Zoom Integration
 * Server-to-Server OAuth, meeting management, and webhook handling
 */

import crypto from 'crypto';

// Environment variables for Server-to-Server OAuth
const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID || '';
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID || '';
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET || '';
const ZOOM_WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET || '';

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

export interface ZoomParticipant {
  userId: string;
  email: string;
  name: string;
  joinTime: Date;
  leaveTime?: Date;
  duration?: number;
}

export interface ZoomMeeting {
  id: number;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  join_url: string;
  start_url: string;
  password?: string;
}

export interface ZoomMeetingListItem {
  id: number;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  total_minutes: number;
  participants_count: number;
}

export interface ZoomPastParticipant {
  id: string;
  user_id: string;
  name: string;
  user_email: string;
  join_time: string;
  leave_time: string;
  duration: number;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

export class ZoomService {
  private webhookSecret: string;
  private tokenCache: TokenCache | null = null;

  constructor() {
    this.webhookSecret = ZOOM_WEBHOOK_SECRET;
  }

  /**
   * Check if Zoom is configured
   */
  isConfigured(): boolean {
    return !!(ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET);
  }

  /**
   * Get Server-to-Server OAuth access token
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 min buffer)
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 300000) {
      return this.tokenCache.token;
    }

    if (!this.isConfigured()) {
      throw new Error('Zoom credentials not configured');
    }

    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: ZOOM_ACCOUNT_ID,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get Zoom access token: ${error}`);
    }

    const data = await response.json();

    // Cache the token
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    return data.access_token;
  }

  /**
   * Create a Zoom meeting
   */
  async createMeeting(options: {
    topic: string;
    startTime: string; // ISO 8601 format
    duration: number; // in minutes
    timezone?: string;
    agenda?: string;
  }): Promise<ZoomMeeting> {
    const token = await this.getAccessToken();

    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: options.topic,
        type: 2, // Scheduled meeting
        start_time: options.startTime,
        duration: options.duration,
        timezone: options.timezone || 'Asia/Kolkata',
        agenda: options.agenda || '',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: true,
          waiting_room: false,
          auto_recording: 'cloud',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create Zoom meeting: ${error}`);
    }

    return response.json();
  }

  /**
   * Update a Zoom meeting
   */
  async updateMeeting(meetingId: string, options: {
    topic?: string;
    startTime?: string;
    duration?: number;
    agenda?: string;
  }): Promise<void> {
    const token = await this.getAccessToken();

    const body: Record<string, unknown> = {};
    if (options.topic) body.topic = options.topic;
    if (options.startTime) body.start_time = options.startTime;
    if (options.duration) body.duration = options.duration;
    if (options.agenda) body.agenda = options.agenda;

    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update Zoom meeting: ${error}`);
    }
  }

  /**
   * Delete a Zoom meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    const token = await this.getAccessToken();

    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      throw new Error(`Failed to delete Zoom meeting: ${error}`);
    }
  }

  /**
   * List past meetings (for import)
   */
  async listPastMeetings(options: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
    pageSize?: number;
    nextPageToken?: string;
  }): Promise<{
    meetings: ZoomMeetingListItem[];
    nextPageToken?: string;
  }> {
    const token = await this.getAccessToken();

    // Reports API requires a real user ID (not "me"), so resolve it first
    const userId = await this.resolveUserId(token);

    const params = new URLSearchParams({
      from: options.from,
      to: options.to,
      page_size: String(options.pageSize || 30),
      type: 'past',
    });

    if (options.nextPageToken) {
      params.set('next_page_token', options.nextPageToken);
    }

    // Use Reports API — supports from/to date range and returns participants_count
    const response = await fetch(
      `https://api.zoom.us/v2/report/users/${userId}/meetings?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list past meetings: ${error}`);
    }

    const data = await response.json();
    return {
      meetings: data.meetings || [],
      nextPageToken: data.next_page_token,
    };
  }

  /**
   * Resolve "me" to an actual Zoom user ID (needed for Reports API)
   */
  private async resolveUserId(token: string): Promise<string> {
    const response = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to resolve Zoom user: ${error}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Get past meeting participants (for attendance import)
   */
  async getPastMeetingParticipants(meetingUuid: string): Promise<ZoomPastParticipant[]> {
    const token = await this.getAccessToken();

    // Double-encode UUID if it starts with / or contains //
    const encodedUuid = meetingUuid.startsWith('/') || meetingUuid.includes('//')
      ? encodeURIComponent(encodeURIComponent(meetingUuid))
      : encodeURIComponent(meetingUuid);

    const response = await fetch(
      `https://api.zoom.us/v2/past_meetings/${encodedUuid}/participants?page_size=300`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get meeting participants: ${error}`);
    }

    const data = await response.json();
    return data.participants || [];
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<ZoomMeeting | null> {
    const token = await this.getAccessToken();

    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      const error = await response.text();
      throw new Error(`Failed to get meeting: ${error}`);
    }

    return response.json();
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

}

export const zoomService = new ZoomService();
