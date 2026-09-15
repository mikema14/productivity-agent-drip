import ICAL from 'ical.js';
import type { CalendarProposal } from '../types';
import { v4 as uuidv4 } from 'uuid';

const FEED_TTL_MS = 10 * 60 * 1000;

/** Defensive bounds so a malformed or unbounded RRULE cannot hang the expansion. */
const MAX_OCCURRENCES_PER_SERIES = 2000;
const MAX_EXPANSION_MS = 5 * 365 * 24 * 60 * 60 * 1000;

interface Occurrence {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  isRecurring: boolean;
}

interface ParsedFeed {
  url: string;
  fetchedAt: number;
  index: Map<string, Occurrence[]>;
}

let feedCache: ParsedFeed | null = null;
const feedInFlight = new Map<string, Promise<ParsedFeed | null>>();

/**
 * Run `work` under `key` and publish it in `map` until it settles, so callers
 * can either join it or queue behind it.
 */
function trackInFlight<T>(
  map: Map<string, Promise<T>>,
  key: string,
  work: () => Promise<T>
): Promise<T> {
  const tracked = work().finally(() => {
    if (map.get(key) === tracked) {
      map.delete(key);
    }
  });

  map.set(key, tracked);
  return tracked;
}

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Expand every VEVENT in the feed once and bucket the resulting occurrences by
 * their local date, so looking up a day is a Map lookup instead of a rescan.
 */
function buildIndex(icsData: string): Map<string, Occurrence[]> {
  const comp = new ICAL.Component(ICAL.parse(icsData));

  // Without this, DTSTART;TZID=... parses as a floating time, which makes
  // ical.js compare it against the RRULE's UTC UNTIL unconverted and drop the
  // final occurrence of every bounded series.
  for (const vtimezone of comp.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(vtimezone);
    } catch {
      // Unusable VTIMEZONE - the events fall back to floating times
    }
  }

  const index = new Map<string, Occurrence[]>();

  const add = (occurrence: Occurrence) => {
    const key = localDateKey(occurrence.start);
    const bucket = index.get(key);
    if (bucket) {
      bucket.push(occurrence);
    } else {
      index.set(key, [occurrence]);
    }
  };

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];

  for (const vevent of comp.getAllSubcomponents('vevent')) {
    let event: ICAL.Event;
    try {
      // Passing `exceptions` suppresses ical.js' default auto-relate, which
      // walks the whole VCALENDAR for every event and ignores UIDs while doing
      // it. We relate by UID below instead.
      event = new ICAL.Event(vevent, { strictExceptions: true, exceptions: [] });
    } catch {
      continue;
    }

    if (event.isRecurrenceException()) {
      exceptions.push(event);
    } else if (event.uid) {
      masters.set(event.uid, event);
    }
  }

  const orphans: ICAL.Event[] = [];

  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (!master) {
      orphans.push(exception);
      continue;
    }
    try {
      master.relateException(exception);
    } catch {
      orphans.push(exception);
    }
  }

  const expansionLimit = Date.now() + MAX_EXPANSION_MS;

  for (const master of masters.values()) {
    try {
      if (!master.isRecurring()) {
        add({
          uid: master.uid,
          title: master.summary || 'Untitled Event',
          start: master.startDate.toJSDate(),
          end: master.endDate.toJSDate(),
          isRecurring: false,
        });
        continue;
      }

      const iterator = master.iterator();

      for (let count = 0; count < MAX_OCCURRENCES_PER_SERIES; count++) {
        let next;
        try {
          next = iterator.next();
        } catch {
          break;
        }

        if (!next || next.toJSDate().getTime() > expansionLimit) {
          break;
        }

        // Yields the rescheduled item when this occurrence has an exception.
        const details = master.getOccurrenceDetails(next);

        add({
          uid: master.uid,
          title: details.item.summary || 'Untitled Event',
          start: details.startDate.toJSDate(),
          end: details.endDate.toJSDate(),
          isRecurring: true,
        });
      }
    } catch (eventError) {
      console.debug('[Calendar] Skipped series due to error:', eventError);
    }
  }

  for (const orphan of orphans) {
    add({
      uid: orphan.uid,
      title: orphan.summary || 'Untitled Event',
      start: orphan.startDate.toJSDate(),
      end: orphan.endDate.toJSDate(),
      isRecurring: true,
    });
  }

  return index;
}

/**
 * Download + index the ICS feed at most once per TTL. The feed is ~750 KB and
 * takes seconds to generate server-side, so every date navigation must reuse it.
 */
async function loadFeed(forceRefresh: boolean): Promise<ParsedFeed | null> {
  const icsUrl = await window.timerAPI.getSettings('calendarUrl');

  if (!icsUrl) {
    return null;
  }

  if (!forceRefresh && feedCache && feedCache.url === icsUrl && Date.now() - feedCache.fetchedAt < FEED_TTL_MS) {
    return feedCache;
  }

  // A force refresh joins a download that is already running instead of firing
  // a second one - whatever is in flight is by definition already fresh.
  const running = feedInFlight.get(icsUrl);
  if (running) {
    return running;
  }

  return trackInFlight(feedInFlight, icsUrl, async (): Promise<ParsedFeed | null> => {
    const result = await window.timerAPI.fetchCalendarFeed?.(icsUrl, forceRefresh);

    if (!result?.data) {
      console.warn('[Calendar] No calendar data received');
      return null;
    }

    feedCache = {
      url: icsUrl,
      fetchedAt: result.fetchedAt,
      index: buildIndex(result.data),
    };
    return feedCache;
  });
}

/**
 * Build calendar proposals for a single date from the indexed ICS feed
 */
export async function fetchCalendarEvents(
  date: string,
  forceRefresh: boolean = false
): Promise<CalendarProposal[]> {
  try {
    const feed = await loadFeed(forceRefresh);

    if (!feed) {
      return [];
    }

    const proposals = (feed.index.get(date) ?? []).map(createProposal);
    console.log(`[Calendar] ${date}: ${proposals.length} proposals`);
    return proposals;
  } catch (error) {
    console.error('[Calendar] Failed to build calendar events:', error);
    return [];
  }
}

function createProposal(occurrence: Occurrence): CalendarProposal {
  const durationMinutes = Math.round(
    (occurrence.end.getTime() - occurrence.start.getTime()) / 60000
  );

  return {
    id: uuidv4(),
    event_uid: occurrence.uid,
    // Mark recurring events in the title for visibility
    title: occurrence.isRecurring ? `${occurrence.title} 🔁` : occurrence.title,
    start_at: occurrence.start.toISOString(),
    end_at: occurrence.end.toISOString(),
    duration_minutes: durationMinutes,
    date: localDateKey(occurrence.start),
    accepted: 0,
    dismissed: 0,
    task_id: null,
    comment: null,
    logged: 0,
  };
}

// Date-based cache for daily-once sync
const calendarCache = new Map<
  string,  // YYYY-MM-DD
  {
    lastSyncedAt: number,
    proposals: CalendarProposal[]
  }
>();

/** The app stays open for days; without a cap the cache grows per date visited. */
const MAX_CACHED_DATES = 30;

function rememberSync(date: string, proposals: CalendarProposal[], syncedAt: number): void {
  calendarCache.delete(date);
  calendarCache.set(date, { lastSyncedAt: syncedAt, proposals });

  while (calendarCache.size > MAX_CACHED_DATES) {
    const oldest = calendarCache.keys().next().value;
    if (oldest === undefined) break;
    calendarCache.delete(oldest);
  }
}

const syncInFlight = new Map<string, Promise<void>>();

async function runSync(date: string, forceRefresh: boolean): Promise<void> {
  const proposals = await fetchCalendarEvents(date, forceRefresh);

  // Get existing proposals from database (including dismissed ones to prevent re-adding)
  const existingProposals = await window.logAPI.getCalendarProposals(date, true);

  // Every occurrence of a series shares one UID, so the start time is part of
  // the identity of a proposal.
  const existingMap = new Map(
    existingProposals.map(p => [`${p.event_uid}|${p.start_at}`, p])
  );

  const writes: Array<Promise<unknown> | undefined> = [];

  for (const proposal of proposals) {
    const existing = existingMap.get(`${proposal.event_uid}|${proposal.start_at}`);

    if (existing) {
      // Only update proposals that haven't been accepted or dismissed yet
      // This preserves user changes (task_id, comments, accepted status, etc.)
      if (existing.accepted === 0 && existing.dismissed === 0) {
        if (existing.title !== proposal.title || existing.end_at !== proposal.end_at) {
          writes.push(window.logAPI.updateCalendarProposal?.(existing.id, {
            title: proposal.title,
            end_at: proposal.end_at,
            duration_minutes: proposal.duration_minutes,
          }));
        }
      }
    } else {
      writes.push(window.logAPI.addCalendarProposal?.(proposal));
    }
  }

  await Promise.all(writes);
  rememberSync(date, proposals, Date.now());
}

/**
 * Queue a sync behind any sync already running for the same date. Two syncs
 * running at once would both read the existing rows before either writes them
 * back, and both would insert the same event_uid.
 */
function queueSync(date: string, forceRefresh: boolean): Promise<void> {
  const pending = syncInFlight.get(date);

  return trackInFlight(syncInFlight, date, () =>
    (pending ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => runSync(date, forceRefresh))
  );
}

/**
 * Sync calendar proposals to database
 */
export async function syncCalendarProposals(date: string): Promise<void> {
  if (calendarCache.has(date)) {
    return;
  }

  // The Daily Log triggers loadDay twice per date change (store + effect), so
  // without this the same date would sync concurrently.
  const pending = syncInFlight.get(date);
  if (pending) {
    return pending;
  }

  return queueSync(date, false);
}

/**
 * Force sync calendar proposals (ignores cache, refetches from ICS)
 */
export async function forceSyncCalendar(date: string): Promise<void> {
  console.log(`[Calendar] Force syncing ${date}`);

  calendarCache.delete(date);
  await queueSync(date, true);
}

/**
 * Drop the parsed feed and the per-date sync cache so the next sync rebuilds
 * both. Called when the main process reports a newer feed.
 */
export function invalidateCalendarCache(): void {
  feedCache = null;
  calendarCache.clear();
}

/**
 * Get last sync timestamp for a date
 * @returns timestamp (number) or null if never synced
 */
export function getLastSyncTime(date: string): number | null {
  const cached = calendarCache.get(date);
  return cached ? cached.lastSyncedAt : null;
}
