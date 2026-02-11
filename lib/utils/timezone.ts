/**
 * Timezone conversion helpers for external API integrations.
 *
 * The database stores UTC timestamps. External APIs (Zoom, Google Calendar)
 * need local-time strings so meetings appear at the intended time.
 */

import { formatInTimeZone } from 'date-fns-tz';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Convert a UTC ISO string to a timezone-naive local datetime for Zoom.
 *
 * Zoom treats `start_time` as local time in the accompanying `timezone` param,
 * so we must strip the offset — otherwise Zoom double-converts and the meeting
 * shows up at the wrong hour.
 *
 * @example toZoomLocalTime("2026-02-14T05:30:00.000Z") → "2026-02-14T11:00:00"
 */
export function toZoomLocalTime(
  utcIso: string,
  tz: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(utcIso, tz, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Convert a UTC ISO string to an offset-aware RFC 3339 local datetime
 * for Google Calendar.
 *
 * Including the explicit offset (+05:30) makes the time unambiguous,
 * regardless of how different calendar clients interpret the `timeZone` param.
 *
 * @example toCalendarLocalTime("2026-02-14T05:30:00.000Z") → "2026-02-14T11:00:00+05:30"
 */
export function toCalendarLocalTime(
  utcIso: string,
  tz: string = DEFAULT_TIMEZONE,
): string {
  return formatInTimeZone(utcIso, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
