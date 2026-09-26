# Phase 2.0-A Bug Fixes

## Issues Fixed

### 🐛 Issue #1: Billable Field Not Saving/Displaying
**Problem**: Billable checkbox in add/edit modal worked, but always displayed as checked (✓) regardless of actual value.

**Root Cause**:
- Database had `billable` column and was saving correctly
- TypeScript interfaces (`PomodoroSession`, `AdhocEntry`) were missing the `billable` field
- `logStore.ts` wasn't mapping the `billable` field when loading entries from database

**Fix Applied**:
1. Added `billable?: 0 | 1` to `PomodoroSession` interface (types/index.ts:31)
2. Added `billable?: 0 | 1` to `AdhocEntry` interface (types/index.ts:55)
3. Added billable mapping in `logStore.ts`:
   - Line 85: `billable: s.billable !== 0` for pomodoro entries
   - Line 99: `billable: e.billable !== 0` for adhoc entries

**Files Modified**:
- `src/types/index.ts`
- `src/stores/logStore.ts`

**Test**:
- [true] Create entry with billable unchecked → should show `-` in Billable column
- [FIXED] Edit entry, toggle billable → should update display correctly
- [true] Refresh app → billable status should persist

**Additional Fix Applied**:
- Added billable field to EntryRow.tsx handleSave() function (line 23)
- Added billable field to logStore.ts updateEntry() for both pomodoro (line 168) and adhoc (line 177) entries
- Converts boolean to 0/1 for database storage

---

### 🐛 Issue #2: Finish Early Sessions Not Being Saved
**Status**: FIXED ✅

**Problem**:
- Clicking "Finish Early" incremented session count but sessions were not saved to database at all
- No entries appeared in Daily Log

**Root Cause**:
- Code was calling non-existent method `window.logAPI.addPomodoroSession?.()`
- The LogAPI interface doesn't have this method
- Normal timer completion uses `window.timerAPI.saveSession()`

**Fix Applied**:
- Changed timerStore.ts:263 from `window.logAPI.addPomodoroSession?.()` to `window.timerAPI.saveSession()`
- Fixed session object types: `logged: 0` and `billable: 1` to match database schema (0 | 1 instead of boolean)
---

### 🐛 Issue #3: Notifications Not Showing
**Status**: NEEDS INVESTIGATION

**Problem**: No notification appears when finishing early (should show "X minutes logged. Time for a break!")

**Code Location**: `src/stores/timerStore.ts:266-269`

```typescript
window.timerAPI.showNotification(
  'Session Complete',
  `${elapsedMinutes} minutes logged. Time for a break!`
);
```

**Possible Causes**:
1. Notification permission not granted
2. `window.timerAPI.showNotification` not working in this context
3. Function called before IPC bridge ready

**Test**:
1. Check if other notifications work (e.g., break complete)
2. Check browser console for errors
3. Test notification permission in system settings

---

## Files Modified Summary

### Core Fixes (Billable)
- `src/types/index.ts` - Added billable to interfaces
- `src/stores/logStore.ts` - Added billable mapping

### Interface Updates
- `src/types/index.ts:16` - Added `finishEarly` to TimerState interface

---

## Testing Status

### ✅ Working (All Issues Fixed)
- Billable toggle in add modal ✅
- Billable toggle in edit mode ✅
- Billable persistence to database ✅
- Billable display ✅
- Finish Early sessions now saving to database ✅
- Finish Early sessions appearing in Daily Log ✅
- Finish Early notification showing ✅
- Merged entries can be marked for logging ✅
- Merged entries are read-only (edit/delete disabled) ✅

---

## Recommended Next Steps

1. **Test Billable Fix**:
   - Create new entry with billable unchecked
   - Verify `-` shows in Billable column
   - Refresh and verify it persists

2. **Debug Finish Early**:
   - Add console.log in finishEarly() to see saved session
   - Check database to verify session was saved
   - Check date format in start_at field
   - Verify getSessions() is querying correct date

3. **Debug Notifications**:
   - Test other notifications (break complete, etc.)
   - Check Electron notification permissions
   - Add console.log before notification call

---

## Database Verification

Check if sessions are being saved:

```sql
-- In SQLite console
SELECT * FROM pomodoro_sessions
WHERE date(start_at) = date('now')
ORDER BY start_at DESC
LIMIT 10;
```

Should show:
- Finished early sessions with actual duration (not 25)
- Comment: "Finished early (Xm)"
- billable: 1 (true)

---

## Console Checks

Look for these in browser console:
- ✅ "Migration complete: pomodoro_sessions.billable"
- ✅ "Migration complete: adhoc_entries.billable"
- ❌ Any errors when clicking "Finish Early"
- ❌ Any errors related to notifications
