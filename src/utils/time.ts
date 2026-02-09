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
