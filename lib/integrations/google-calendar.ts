/**
 * Google Calendar Integration
 * Two-way sync for session management
 */

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  conferenceData?: {
    entryPoints?: {
      entryPointType: string;
      uri: string;
    }[];
  };
}

interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleCalendarService {
  private config: GoogleCalendarConfig;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor() {
    this.config = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`,
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Failed to exchange code');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }

  /**
   * Create calendar event
   */
  async createEvent(
    accessToken: string,
    event: CalendarEvent,
    calendarId = 'primary'
  ): Promise<CalendarEvent> {
    const response = await fetch(
      `${this.baseUrl}/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create event');
    }

    return response.json();
  }

  /**
   * Update calendar event
   */
  async updateEvent(
    accessToken: string,
    eventId: string,
    event: Partial<CalendarEvent>,
    calendarId = 'primary'
  ): Promise<CalendarEvent> {
    const response = await fetch(
      `${this.baseUrl}/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update event');
    }

    return response.json();
  }

  /**
   * Delete calendar event
   */
  async deleteEvent(
    accessToken: string,
    eventId: string,
    calendarId = 'primary'
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete event');
    }
  }

  /**
   * List calendar events
   */
  async listEvents(
    accessToken: string,
    params: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
    },
    calendarId = 'primary'
  ): Promise<CalendarEvent[]> {
    const searchParams = new URLSearchParams({
      ...(params.timeMin && { timeMin: params.timeMin }),
      ...(params.timeMax && { timeMax: params.timeMax }),
      ...(params.maxResults && { maxResults: params.maxResults.toString() }),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const response = await fetch(
      `${this.baseUrl}/calendars/${calendarId}/events?${searchParams}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to list events');
    }

    const data = await response.json();
    return data.items || [];
  }
}

export const googleCalendar = new GoogleCalendarService();
