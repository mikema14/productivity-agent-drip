IMPORTANT — TOKEN EFFICIENCY RULES
----------------------------------
Only apply minimal diffs.  
Do NOT rewrite entire files.  
Reuse existing toast notification component.  
Patch only calendar.ts, Today view header, or toast area.

GOAL
----
After a calendar sync (auto or manual), show a small info toast:
   "Synced at: {HH:mm} on {YYYY-MM-DD}"

This should appear ONLY after:
   - syncCalendar(date) completes (first load)
   - forceSyncCalendar(date) completes (manual refresh)

Do NOT show when using cached proposals.

CHANGES REQUIRED
----------------

1. In calendar.ts (or wherever syncCalendar/forceSyncCalendar resolves):
   - After successful network fetch AND updating the cache:
        call showToastInfo(`Synced at: ${format(now, 'HH:mm')} on ${date}`)

   Use existing toast system (info-style, blue/neutral).  
   Keep it non-blocking.  
   Auto-dismiss as existing toasts do.

2. In loadDay() or Today view:
   - NO additional changes required.  
   - Ensure notification only appears immediately after a real network sync.

EXPECTED UX
-----------
When user opens a date for the first time:
   [toast] Synced at: 08:43 on 2025-12-02

When clicking “Sync Calendar” button:
   [toast] Synced at: 11:02 on 2025-12-02

When navigating or editing:
   NO toast (cached).

END OF PROMPT