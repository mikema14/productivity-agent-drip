IMPORTANT — TOKEN EFFICIENCY RULES
----------------------------------
Only apply minimal diffs.
Do NOT rewrite full files.
Reuse existing calendar.ts, logStore.ts, and UI components.
Do NOT modify unrelated Pomodoro or logging logic.
Patch only the parts explicitly mentioned.

GOAL
----
Implement a “Daily-Once Calendar Sync + Manual Refresh” model:

1. Automatically sync calendar ONLY the first time a date is opened that day.
2. Afterwards, use cached proposals for that date.
3. Add a small “Sync Calendar” button in the Today view to refresh manually.
4. Never auto-sync after accept/dismiss/edit actions.
5. StrictMode must NOT trigger multiple syncs due to cache condition.

This replaces the current behavior where calendar sync happens multiple times per day.


====================================================================
CODE CHANGES
====================================================================

------------------------------------
1. calendar.ts — Add date-based cache
------------------------------------

Add (or adjust) a per-date cache:

   const calendarCache = new Map<
      string,  // YYYY-MM-DD
      {
         lastSyncedAt: number,
         proposals: CalendarEventProposal[]
      }
   >();

Modify syncCalendar(date) to:

- Before fetching:
    - If cache exists for date → return cached.proposals.
    - Otherwise → fetch ICS once, store proposals + Date.now() into cache.

- Manual override (next section) will force re-sync.

Do NOT introduce large structural changes.


-----------------------------------------
2. calendar.ts — Add forceSyncCalendar(date)
-----------------------------------------

Add a new function:

   async function forceSyncCalendar(date) {
      // ignore cache
      // fetch ICS, compute proposals, and replace cached entry
   }

Use same logic as syncCalendar() but always hit the network.


------------------------------------------------
3. logStore.ts — Update loadDay() to use new rules
------------------------------------------------

Modify loadDay(date):

- Before calling calendar sync:
    if (calendarCache has entry for that date):
         use cached proposals directly
         DO NOT sync again
    else:
         await syncCalendar(date)  // first load of that date only

- For accept/dismiss/modify operations:
    - NEVER sync calendar again.
    - Only update local proposals.


---------------------------------------------------
4. Today view UI — Add “Sync Calendar” refresh button
---------------------------------------------------

Add a small button:

   [↻ Sync Calendar]

Place it in Today view near the date header.

Button behavior:
   onClick → call forceSyncCalendar(selectedDate)
   then reload the proposals for that date from cache
   show a green toast:
       "Calendar refreshed"

Design hints (reuse existing styling):
- Small blue button
- Right-aligned
- Minimal footprint


----------------------------------------------
5. Prevent redundant syncs in StrictMode
----------------------------------------------

Ensure syncCalendar() is only called when:

   - cache does NOT contain an entry for that date
   AND
   - the user is loading that date for the first time

Implement the check:

   if (calendarCache.has(date)) {
       return cached entry;
   }

This guarantees StrictMode double-render does NOT re-trigger sync.


====================================================================
EXPECTED BEHAVIOR AFTER FIX
====================================================================

1. First time user opens a date → calendar sync happens once.
2. Next loads of same date → instant load, NO network call.
3. Accept/dismiss/modifying entries → NO sync.
4. Manual refresh → fetch once, update cache, UI updates.
5. ICS feed NEVER auto-loads multiple times per day again.


====================================================================
END OF PROMPT
====================================================================