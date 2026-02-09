import ICAL from 'ical.js';
import type { CalendarProposal } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fetch and parse calendar events from Outlook ICS feed
 */
export async function fetchCalendarEvents(date: string): Promise<CalendarProposal[]> {
  // Get ICS URL from settings
  const icsUrl = await window.timerAPI.getSettings('calendarUrl');

  if (!icsUrl) {
    console.log('No calendar URL configured');
    return [];
  }

  try {
    console.log('Fetching calendar from:', icsUrl);

    // Use IPC to fetch the ICS feed (to avoid CORS)
    const icsData = await window.timerAPI.fetchCalendarFeed?.(icsUrl);

    if (!icsData) {
      console.warn('No calendar data received');
      return [];
    }

    // Parse ICS data
    const jcal = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcal);
    const vevents = comp.getAllSubcomponents('vevent');

    // Parse target date at midnight local time
    const [year, month, day] = date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    const targetDateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);

    const proposals: CalendarProposal[] = [];

    console.log(`Processing ${vevents.length} calendar events for ${date}`);
    console.log('Target date range:', targetDate, 'to', targetDateEnd);
    console.log('User timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);

    let skippedBefore = 0;
    let skippedAfter = 0;
    let processedNonRecurring = 0;
    let processedRecurring = 0;

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);

        // Get event dates
        const startDate = event.startDate.toJSDate();
        const endDate = event.endDate.toJSDate();

        // Debug: Log first few events to see what we're dealing with
        if (proposals.length < 5) {
          console.log(`Event: "${event.summary}" | Start: ${startDate.toISOString()} | End: ${endDate.toISOString()} | Recurring: ${event.isRecurring()}`);
        }

        // Skip events that ended before the target date
        if (endDate < targetDate) {
          skippedBefore++;
          continue;
        }

        // Skip events that start after the target date
        if (startDate > targetDateEnd) {
          skippedAfter++;
          continue;
        }

        // Check if non-recurring event occurs on target date
        if (!event.isRecurring()) {
          processedNonRecurring++;
          // Check if event overlaps with target date (not just starts on it)
          if (startDate <= targetDateEnd && endDate >= targetDate) {
            console.log(`✓ Matched non-recurring: "${event.summary}" on ${startDate.toISOString()}`);
            proposals.push(createProposal(event, startDate, endDate, date, false));
          }
        } else {
          processedRecurring++;
          // Handle recurring events
          try {
            // Always start from the original event's start date, not the target date
            // This preserves the recurrence pattern integrity
            const iterator = event.iterator(event.startDate);

            console.log(`[Recurring] Iterating "${event.summary}" from ${event.startDate.toString()} to find ${date}`);

            // Calculate end of target day for boundary check
            const targetDayEnd = ICAL.Time.fromJSDate(targetDateEnd, false);

            let occurrenceCount = 0;
            let foundOccurrence = false;

            console.log(`[Recurring] Searching for "${event.summary}" on ${date}...`);

            while (!foundOccurrence) {
              let next;
              try {
                next = iterator.next();
              } catch (iterError) {
                console.log(`[Recurring] Iterator ended for "${event.summary}": ${iterError.message}`);
                break;
              }

              if (!next) {
                console.log(`[Recurring] No more occurrences for "${event.summary}"`);
                break;
              }

              occurrenceCount++;

              // Convert to JS Date for comparison
              const occurrenceDate = next.toJSDate();

              // Debug every 10th occurrence when searching far ahead
              if (occurrenceCount % 10 === 0) {
                console.log(`[Recurring] Checked ${occurrenceCount} occurrences, currently at ${occurrenceDate.toISOString().split('T')[0]}`);
              }

              // Stop if we've passed the target day
              if (next.compare(targetDayEnd) > 0) {
                console.log(`[Recurring] Passed target date for "${event.summary}" (reached ${occurrenceDate.toISOString().split('T')[0]})`);
                break;
              }

              // Check if this occurrence is on the target day
              if (isSameDay(occurrenceDate, targetDate)) {
                // Calculate end time safely
                let occurrenceEnd: Date;

                if (event.duration && event.duration.toSeconds) {
                  const durationMs = event.duration.toSeconds() * 1000;
                  occurrenceEnd = new Date(occurrenceDate.getTime() + durationMs);
                } else {
                  // Fallback: use original event's duration
                  const originalDuration = event.endDate.toJSDate().getTime() - event.startDate.toJSDate().getTime();
                  occurrenceEnd = new Date(occurrenceDate.getTime() + originalDuration);
                  console.log(`[Recurring] Using fallback duration for "${event.summary}": ${originalDuration / 60000} minutes`);
                }

                console.log(`✓ Matched recurring: "${event.summary}" on ${occurrenceDate.toISOString()}`);
                proposals.push(createProposal(event, occurrenceDate, occurrenceEnd, date, true));
                foundOccurrence = true;
              }
            }

            if (!foundOccurrence && occurrenceCount > 0) {
              console.log(`[Recurring] "${event.summary}" does not occur on ${date} (checked ${occurrenceCount} occurrences)`);
            }
          } catch (recurError) {
            console.error(`[Recurring] Failed to process "${event.summary}":`, recurError);
            console.error(`[Recurring] Event details:`, {
              summary: event.summary,
              uid: event.uid,
              startDate: event.startDate.toString(),
              isRecurring: event.isRecurring(),
              rrule: event.component.getFirstPropertyValue('rrule')?.toString()
            });
          }
        }
      } catch (eventError) {
        // Skip individual events that fail to process
        console.debug('Skipped event due to error:', eventError);
      }
    }

    const recurringMatched = proposals.filter(p => p.title.includes('🔁')).length;
    const nonRecurringMatched = proposals.length - recurringMatched;

    console.log(`=== Calendar Sync Summary for ${date} ===`);
    console.log(`Total events in ICS: ${vevents.length}`);
    console.log(`Skipped (before target): ${skippedBefore}`);
    console.log(`Skipped (after target): ${skippedAfter}`);
    console.log(`Processed non-recurring: ${processedNonRecurring} → matched: ${nonRecurringMatched}`);
    console.log(`Processed recurring: ${processedRecurring} → matched: ${recurringMatched}`);
    console.log(`Total proposals added: ${proposals.length}`);
    console.log(`=====================================`);
    return proposals;
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return [];
  }
}

/**
 * Create a calendar proposal from an iCal event
 */
function createProposal(
  event: ICAL.Event,
  startDate: Date,
  endDate: Date,
  date: string,
  isRecurring: boolean = false
): CalendarProposal {
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  // Mark recurring events in the title for visibility
  const title = isRecurring
    ? `${event.summary || 'Untitled Event'} 🔁`
    : event.summary || 'Untitled Event';

  return {
    id: uuidv4(),
    event_uid: event.uid,
    title: title,
    start_at: startDate.toISOString(),
    end_at: endDate.toISOString(),
    duration_minutes: durationMinutes,
    date: date,
    accepted: 0,
    dismissed: 0,
    task_id: null,
    comment: null,
  };
}

/**
 * Check if two dates are on the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Add years to a date
 */
function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

// Date-based cache for daily-once sync
const calendarCache = new Map<
  string,  // YYYY-MM-DD
  {
    lastSyncedAt: number,
    proposals: CalendarProposal[]
  }
>();

/**
 * Sync calendar proposals to database
 */
export async function syncCalendarProposals(date: string): Promise<void> {
  // Check cache - return if already synced for this date
  if (calendarCache.has(date)) {
    console.log(`[Calendar] Using cached proposals for ${date}`);
    return;
  }

  const proposals = await fetchCalendarEvents(date);

  // Get existing proposals from database (including dismissed ones to prevent re-adding)
  const existingProposals = await window.logAPI.getCalendarProposals(date, true);

  // Create a map of existing proposals by event_uid
  const existingMap = new Map(
    existingProposals.map(p => [p.event_uid, p])
  );

  // Add or update proposals
  for (const proposal of proposals) {
    const existing = existingMap.get(proposal.event_uid);

    if (existing) {
      // Only update proposals that haven't been accepted or dismissed yet
      // This preserves user changes (task_id, comments, accepted status, etc.)
      if (existing.accepted === 0 && existing.dismissed === 0) {
        // Update if changed
        if (
          existing.title !== proposal.title ||
          existing.start_at !== proposal.start_at ||
          existing.end_at !== proposal.end_at
        ) {
          await window.logAPI.updateCalendarProposal?.(existing.id, {
            title: proposal.title,
            start_at: proposal.start_at,
            end_at: proposal.end_at,
            duration_minutes: proposal.duration_minutes,
          });
        }
      }
      // If accepted or dismissed, skip updating - preserve user's changes
    } else {
      // Add new proposal
      await window.logAPI.addCalendarProposal?.(proposal);
    }
  }

  // Update cache with proposals
  const now = Date.now();
  calendarCache.set(date, {
    lastSyncedAt: now,
    proposals: proposals
  });
  console.log(`[Calendar] Cached proposals for ${date}`);

  // Show sync timestamp notification
  const syncTime = new Date(now);
  const timeStr = syncTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = date;  // Already in YYYY-MM-DD format
  window.timerAPI.showNotification(
    'Calendar Synced',
    `Synced at: ${timeStr} on ${dateStr}`
  );
}

/**
 * Force sync calendar proposals (ignores cache, refetches from ICS)
 */
export async function forceSyncCalendar(date: string): Promise<void> {
  console.log(`[Calendar] Force syncing ${date}`);

  // Clear cache entry for this date
  calendarCache.delete(date);

  // Re-sync (will fetch from network)
  await syncCalendarProposals(date);
}

/**
 * Get last sync timestamp for a date
 * @returns timestamp (number) or null if never synced
 */
export function getLastSyncTime(date: string): number | null {
  const cached = calendarCache.get(date);
  return cached ? cached.lastSyncedAt : null;
}
