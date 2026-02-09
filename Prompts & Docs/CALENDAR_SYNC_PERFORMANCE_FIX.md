# Calendar Sync Performance Fix - Technical Documentation

## Problem
Calendar ICS feed was being fetched **9+ times** on single page load, causing:
- Long waiting times (2-3 seconds per operation)
- Poor UX
- Redundant network requests

### Root Causes
1. **React StrictMode** in dev mode runs effects twice (2x multiplier)
2. **Every update operation** (edit/accept/dismiss) triggered `loadDay()` → `syncCalendarProposals()` → ICS fetch
3. **No caching** between syncs - same date fetched repeatedly within seconds

## Solution Implemented

### 1. Smart Caching with 5-Minute TTL
**File**: `src/services/calendar.ts`

```typescript
// Lines 190-192: Cache storage
const syncCache = new Map<string, number>();
const SYNC_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Lines 197-207: Cache check
export async function syncCalendarProposals(date: string, force: boolean = false): Promise<void> {
  if (!force) {
    const lastSync = syncCache.get(date);
    const now = Date.now();

    if (lastSync && (now - lastSync) < SYNC_CACHE_DURATION) {
      console.log(`Skipping calendar sync for ${date} - synced ${Math.round((now - lastSync) / 1000)}s ago`);
      return; // Skip sync
    }
  }

  // ... rest of sync logic

  // Line 249: Update cache after successful sync
  syncCache.set(date, Date.now());
  console.log(`Calendar synced for ${date}`);
}
```

### 2. Skip Sync for Local-Only Operations
**File**: `src/stores/logStore.ts`

**Interface change (line 37)**:
```typescript
loadDay: (date: string, skipSync?: boolean) => Promise<void>;
```

**Implementation (lines 55-62)**:
```typescript
loadDay: async (date: string, skipSync: boolean = false) => {
  set({ isLoading: true });

  try {
    // Skip sync for local-only operations
    if (!skipSync) {
      await syncCalendarProposals(date);
    }

    // ... rest of load logic
  }
}
```

**All update operations now skip sync**:
- Line 146: `addManualEntry` → `loadDay(selectedDate, true)`
- Line 184: `updateEntry` → `loadDay(selectedDate, true)`
- Line 200: `deleteEntry` → `loadDay(selectedDate, true)`
- Line 295: `logSelected` → `loadDay(selectedDate, true)`

**File**: `src/components/DailyLog/DailyLog.tsx`

- Line 43: `handleAcceptProposal` → `loadDay(selectedDate, true)`
- Line 48: `handleDismissProposal` → `loadDay(selectedDate, true)`

## Expected Behavior

### Before Fix
```
Page load → Fetch ICS (9x)
Edit entry → Fetch ICS (1x)
Accept proposal → Fetch ICS (1x)
Dismiss proposal → Fetch ICS (1x)
Total: 12+ fetches in typical session
```

### After Fix
```
Page load → Fetch ICS (1x) → Cache for 5 min
Edit entry → Skip sync (0 fetches)
Accept proposal → Skip sync (0 fetches)
Dismiss proposal → Skip sync (0 fetches)
Navigate back within 5 min → Skip sync (0 fetches)
After 5+ min → Fetch ICS (1x) → Refresh cache
Total: 1 fetch per 5-minute window
```

## Console Logs to Expect

### First Load
```
Fetching calendar from: https://...
Processing 493 calendar events for 2025-12-02
Found 3 events for 2025-12-02
Calendar synced for 2025-12-02
```

### Subsequent Loads (within 5 min)
```
Skipping calendar sync for 2025-12-02 - synced 30s ago
```

### After Edit/Accept/Dismiss
```
(No calendar logs - sync skipped entirely)
```

## Files Modified

1. **src/services/calendar.ts**
   - Added cache Map and TTL constant
   - Added cache check logic
   - Added cache update after sync

2. **src/stores/logStore.ts**
   - Added `skipSync` parameter to `loadDay()`
   - Updated all update operations to skip sync

3. **src/components/DailyLog/DailyLog.tsx**
   - Updated accept/dismiss handlers to skip sync

## Troubleshooting Checklist

### If still fetching multiple times:

1. **Check console logs**
   - Look for "Skipping calendar sync" messages
   - Look for "Calendar synced for" messages
   - Count "Fetching calendar from" messages

2. **Verify code changes applied**
   ```bash
   # Check if syncCache exists in calendar.ts
   grep "syncCache" src/services/calendar.ts

   # Check if skipSync parameter exists
   grep "skipSync" src/stores/logStore.ts
   ```

3. **Verify build includes changes**
   ```bash
   # Rebuild and restart
   npm run dev
   ```

4. **Check React StrictMode**
   - In dev mode, React StrictMode runs effects twice (expected)
   - Should see max 2 fetches on first load, not 9+

5. **Check if cache is being bypassed**
   - Add breakpoint in `syncCalendarProposals` line 203
   - Verify cache check is executed
   - Check if `lastSync` value exists in Map

6. **Verify sync is called correctly**
   - Check if `loadDay(date, true)` is being called with `skipSync=true`
   - Check if accept/dismiss handlers use the updated signature

## Alternative Approaches

If caching doesn't work, consider:

1. **Debounce sync calls** (lodash.debounce)
2. **Move sync to background worker**
3. **Only sync once per app session** (aggressive caching)
4. **Manual refresh button** instead of auto-sync
5. **IndexedDB caching** instead of in-memory Map

## Known Limitations

1. **Cache is in-memory** - cleared on app restart
2. **5-minute TTL** - might be too long/short depending on use case
3. **Per-date caching** - changing dates triggers new sync (expected)
4. **React StrictMode** - will always fetch 2x in dev mode (unavoidable)
