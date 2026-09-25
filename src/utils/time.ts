/**
 * Format seconds to MM:SS display format
 * @param seconds Total seconds
 * @returns Formatted time string (e.g., "25:00", "05:30")
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Format Date object to YYYY-MM-DD
 * @param date Date object
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns Today's date string
 */
export function getCurrentDate(): string {
  return formatDate(new Date());
}

/**
 * Format Date object to ISO datetime string
 * @param date Date object
 * @returns ISO datetime string
 */
export function formatDateTime(date: Date): string {
  return date.toISOString();
}

/**
 * Parse YYYY-MM-DD string to Date object
 * @param dateStr Date string in YYYY-MM-DD format
 * @returns Date object
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Convert minutes to hours (decimal)
 * @param minutes Number of minutes
 * @returns Hours as decimal (e.g., 30 minutes = 0.5 hours)
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100; // Round to 2 decimals
}

/**
 * Convert hours to minutes
 * @param hours Number of hours (can be decimal)
 * @returns Minutes as integer
 */
export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

/**
 * Check if two dates are the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns True if same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return formatDate(date1) === formatDate(date2);
}

/**
 * Add days to a date
 * @param date Starting date
 * @param days Number of days to add
 * @returns New date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format time for tray display (shorter format)
 * @param seconds Total seconds
 * @returns Formatted time for tray (e.g., "25:00" or "5:30")
 */
export function formatTrayTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 10) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return formatTime(seconds);
}

/**
 * Parse a timestamp as stored in SQLite into epoch milliseconds.
 *
 * The DB mixes three shapes: ISO strings from JS (`2026-09-25T08:00:00.000Z`),
 * SQLite `datetime('now')` values (`2026-09-25 08:00:00`, UTC but without a
 * zone marker, which `new Date()` would wrongly read as local time), and bare
 * dates (`2026-09-25`, read as local noon). Returns NaN if unparseable.
 */
export function parseDbTimestamp(value: string): number {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T12:00:00`).getTime();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)) {
    return new Date(`${v.replace(' ', 'T')}Z`).getTime();
  }
  return new Date(v).getTime();
}

/**
 * Compact age of a timestamp: "Just now", "3h", "Yesterday", "4d".
 */
export function relativeTime(dateStr: string, now: number = Date.now()): string {
  const then = parseDbTimestamp(dateStr);
  if (Number.isNaN(then)) return '';
  const diffMs = Math.max(0, now - then);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h`;
  if (diffD === 1) return 'Yesterday';
  return `${diffD}d`;
}

/**
 * Format a minute count as "25m", "1h", "1h 15m".
 */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}
