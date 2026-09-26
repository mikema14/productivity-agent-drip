# URGENT FIX: Calendar Sync Performance

## Problem
`syncCalendarProposals()` is called **9+ times** on page load because:
1. React StrictMode runs effects 2x in dev
2. Every `loadDay()` call triggers ICS fetch
3. All update operations (edit/accept/dismiss) call `loadDay()` → fetch

## Fix Instructions

Apply these 3 changes in order:

---

### STEP 1: Add Cache to calendar.ts

**File**: `src/services/calendar.ts`

Add this at the TOP of the file (after imports):

```typescript
// ═══════════════════════════════════════════════════════════
// SYNC CACHE - Prevents redundant ICS fetches
// ═══════════════════════════════════════════════════════════
const syncCache = new Map<string, number>();
const SYNC_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

Then **wrap the existing `syncCalendarProposals` function** with cache check:

```typescript
export async function syncCalendarProposals(date: string, force: boolean = false): Promise<void> {
  // ─────────────────────────────────────────────────────────
  // CACHE CHECK - Skip if synced recently
  // ─────────────────────────────────────────────────────────
  if (!force) {
    const lastSync = syncCache.get(date);
    const now = Date.now();
    
    if (lastSync && (now - lastSync) < SYNC_CACHE_DURATION) {
      console.log(`[Calendar] Skipping sync for ${date} - cached ${Math.round((now - lastSync) / 1000)}s ago`);
      return; // EARLY EXIT - use cached data
    }
  }

  // ─────────────────────────────────────────────────────────
  // EXISTING SYNC LOGIC GOES HERE
  // (Keep all the existing code inside this function)
  // ─────────────────────────────────────────────────────────
  
  // ... existing fetch and processing code ...

  // ─────────────────────────────────────────────────────────
  // UPDATE CACHE - Add this at the END of the function (before final return/catch)
  // ─────────────────────────────────────────────────────────
  syncCache.set(date, Date.now());
  console.log(`[Calendar] Synced ${date} - cached for 5 minutes`);
}
```

**IMPORTANT**: The cache check goes at the TOP of the function. The cache update goes at the END (after successful sync, before any final return).

---

### STEP 2: Add skipSync Parameter to logStore.ts

**File**: `src/stores/logStore.ts`

**A. Update the interface** (find the `loadDay` type definition):

```typescript
// BEFORE:
loadDay: (date: string) => Promise<void>;

// AFTER:
loadDay: (date: string, skipSync?: boolean) => Promise<void>;
```

**B. Update the implementation**:

```typescript
// BEFORE:
loadDay: async (date: string) => {
  set({ isLoading: true });
  try {
    await syncCalendarProposals(date);
    // ... rest of code

// AFTER:
loadDay: async (date: string, skipSync: boolean = false) => {
  set({ isLoading: true });
  try {
    // Only sync calendar on initial load, not on local updates
    if (!skipSync) {
      await syncCalendarProposals(date);
    }
    // ... rest of code
```

**C. Update ALL operations that call loadDay() to skip sync**:

Find these patterns and add `true` as second argument:

```typescript
// In addManualEntry or similar:
await get().loadDay(selectedDate, true);  // ← Add true

// In updateEntry:
await get().loadDay(selectedDate, true);  // ← Add true

// In deleteEntry:
await get().loadDay(selectedDate, true);  // ← Add true

// In logSelected (after logging):
await get().loadDay(selectedDate, true);  // ← Add true

// In toggleLogMark:
await get().loadDay(selectedDate, true);  // ← Add true
```

**Quick find-and-fix**: Search for `loadDay(selectedDate)` or `loadDay(get().selectedDate)` and add `, true` before the closing paren.

---

### STEP 3: Update DailyLog.tsx Handlers

**File**: `src/components/DailyLog/DailyLog.tsx`

Find the accept/dismiss handlers and add `true`:

```typescript
// Accept proposal handler
const handleAcceptProposal = async (proposalId: string, taskId?: string) => {
  // ... accept logic ...
  await loadDay(selectedDate, true);  // ← Add true
};

// Dismiss proposal handler  
const handleDismissProposal = async (proposalId: string) => {
  // ... dismiss logic ...
  await loadDay(selectedDate, true);  // ← Add true
};
```

---

## Verification

After applying fixes, check console output:

**First page load** (should see 1-2 fetches max):
```
[Calendar] Synced 2025-12-02 - cached for 5 minutes
```

**Edit/accept/dismiss** (should see NO calendar logs):
```
(no calendar-related console output)
```

**Navigate away and back within 5 min**:
```
[Calendar] Skipping sync for 2025-12-02 - cached 45s ago
```

---

## If Still Broken

If you still see multiple fetches, check:

1. **Is cache code at file scope?** The `syncCache` Map must be outside any function
2. **Is cache check FIRST in syncCalendarProposals?** Before any fetch logic
3. **Are all loadDay() calls updated?** Search globally for `loadDay(` and verify

### Debug snippet (add temporarily):
```typescript
// Add at top of syncCalendarProposals:
console.log('[Calendar] syncCalendarProposals called', { date, force, cacheSize: syncCache.size });
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `calendar.ts` | Add `syncCache` Map + TTL constant at file scope |
| `calendar.ts` | Add cache check at START of `syncCalendarProposals()` |
| `calendar.ts` | Add cache update at END of `syncCalendarProposals()` |
| `logStore.ts` | Add `skipSync?: boolean` to `loadDay` signature |
| `logStore.ts` | Add `if (!skipSync)` guard around sync call |
| `logStore.ts` | Add `true` to all `loadDay()` calls in update operations |
| `DailyLog.tsx` | Add `true` to `loadDay()` in accept/dismiss handlers |
