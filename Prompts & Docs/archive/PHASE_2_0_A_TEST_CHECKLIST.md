# Phase 2.0-A Test Checklist

## A2: Billable Toggle ✓

### Add Entry Modal
- [true] Open "Add Entry" modal
- [true] Verify billable checkbox is present and checked by default
- [true] Uncheck billable, add entry
- [false] Entry appears in daily log with `-` in Billable column - **entry is still checked with billable tag**

### Edit Existing Entry
- [true] Click "Edit" on any entry
- [true] Verify billable checkbox appears in edit mode
- [true] Toggle billable on/off, click Save
- [false] Verify billable column updates (✓ or -) - **entry is still checked with billable tag**

### Persistence
- [ ] Edit entry and set billable=false
- [ ] Refresh app
- [ ] Verify billable status persists

---

## A1: Delete Entry Guard ✓

### Delete Unlogged Entry
- [ ] Create a manual entry (don't log it)
- [ ] Click Delete button
- [ ] Entry should be deleted successfully

### Delete Logged Entry (Should Fail) - to be finished
- [true] Create a manual entry
- [true] Mark it for logging, click "Log Selected"
- [ ] After logging, try to click Delete
- [ ] Should show notification: "Cannot Delete - This entry has already been logged to Easy Project"
- [ ] Entry remains in the list

### Other Entry Types
- [true] Verify no delete button appears on pomodoro sessions
- [ ] Verify no delete button appears on calendar entries

---

## A3: Finish Pomodoro Early ✓

### Start and Finish Early
- [true] Go to Timer view
- [true] Click "Start Focus Session"
- [true] Wait 5-10 seconds
- [true] Verify "Finish Early" button appears (green, between Pause and Skip)
- [true] Click "Finish Early"
- [false] Verify notification: "X minutes logged. Time for a break!"
- [true] Go to Daily Log
- [false] New entry appears with comment "Finished early (Xm)” - nothing is present only calendar or manually added entries
- [ ] Duration matches actual time (not 25 min)

### Too Short Session
- [true] Start focus session
- [false] Immediately (within 1 second) click "Finish Early"
- [false] Should show notification: "Session Too Short - Sessions must be at least 1 minute to save"
- [ ] No entry added to Daily Log

### Session Count
- [true] Finish early on a session
- [true] Verify session count increments on Timer view

---

## A4: Auto-Merge Entries by Task ID ✓ - to be finished

### Merge Same Task
- [true] Add or create 3 entries with same Task ID (e.g., 643749)
- [true] Go to Daily Log
- [true] Entries should merge into single row
- [true] Duration = sum of all 3 (e.g., 25 + 25 + 25 = 75 minutes)
- [true] Purple badge shows "3 sessions"
- [true] Comments combined with "; " separator

### Don't Merge Different Tasks
- [ ] Create 2 entries with different Task IDs
- [ ] Both should appear separately (no merge)

### Don't Merge Unassigned
- [ ] Create 2 entries without Task IDs
- [ ] Both should appear separately

### Merged Entry Logging
- [true] Create 2 entries with same Task ID
- [false] Mark merged entry for logging - can’t be clicked, nor any other action like edit duration, comments etc
- [ ] Click "Log Selected"
- [ ] Should POST combined duration to API
- [ ] Both source entries marked as logged

---

## Integration Tests - to be finished

### Combined Workflow
- [ ] Start pomodoro with Task ID 643749
- [ ] Finish early after 10 minutes
- [ ] Manually add another entry with same Task ID (15 minutes)
- [ ] Verify entries merge: 10m + 15m = 25m total
- [ ] Edit billable status on merged entry
- [ ] Log the merged entry
- [ ] Try to delete it (should fail - already logged)

### Database Migration
- [ ] Check browser console for migration messages:
  - "Migration complete: pomodoro_sessions.billable"
  - "Migration complete: adhoc_entries.billable"
- [ ] Verify no migration errors

---

## Visual Checks

### Table Columns
- [true] Daily Log table has "Billable?" column between "Type" and "Log?"
- [true] Header alignment looks correct
- [false] Billable shows ✓ (green) or - (gray)

### Timer Controls
- [true] During focus: Pause, Finish Early, Skip, Cancel buttons visible
- [ ] During break: only Pause/Resume, Skip, Cancel (no Finish Early)
- [true] When idle: only "Start Focus Session" button

### Merge Badge - to be finished
- [ ] Purple badge visible on merged entries
- [ ] Badge shows correct count (e.g., "2 sessions", "3 sessions")
- [ ] Badge doesn't appear on single entries

---

## Known Limitations (Expected Behavior)

- ✓ Merged entries show as one row (display-only merge)
- ✓ Individual sessions preserved in database for audit
- ✓ Can't delete pomodoro or calendar entries (only adhoc)
- ✓ Billable defaults to `true` for all new entries
- ✓ Finish early rounds up to nearest minute (23.5s → 1m)

---

## Quick Smoke Test (2 minutes)

1. [false] Add manual entry with billable unchecked → saves correctly
2. [false] Start timer, finish early after 5s → session logged
3. [true] Create 2 entries with same Task ID → merge with badge
4. [false] Try to delete logged entry → blocked with notification - nothing happened, also merged entry was not logged and can’t be deleted

If all 4 pass ✓ - Phase 2.0-A is working!
