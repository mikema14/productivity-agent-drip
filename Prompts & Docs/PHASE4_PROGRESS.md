# Phase 4 - Calendar Integration Progress

## ✅ What's Been Completed

### 1. Packages Installed
```bash
npm install ical.js axios  # ✅ DONE
```

### 2. Calendar Service Created (`src/services/calendar.ts`)
- ✅ ICS feed fetcher using ical.js
- ✅ Parser for calendar events (handles recurring events)
- ✅ `fetchCalendarEvents(date)` - Fetches and parses ICS feed
- ✅ `syncCalendarProposals(date)` - Syncs proposals to database

### 3. Database Operations Added (`src/services/db.ts`)
- ✅ `addCalendarProposal(proposal)` - Insert new proposals
- ✅ `updateCalendarProposal(id, updates)` - Update existing proposals
- ✅ `acceptCalendarProposal(id, taskId?)` - Mark as accepted
- ✅ `dismissCalendarProposal(id)` - Mark as dismissed
- ✅ All exported and imported in main.ts

### 4. IPC Handlers Added (`electron/main.ts`)
- ✅ `fetch-calendar-feed` - Fetches ICS data via Electron net module (avoids CORS)
- ✅ `add-calendar-proposal` - Add proposal to database
- ✅ `update-calendar-proposal` - Update proposal
- ✅ `accept-calendar-proposal` - Accept with optional task ID
- ✅ `dismiss-calendar-proposal` - Dismiss proposal

### 5. TypeScript Types Updated (`src/types/index.ts`)
- ✅ Added `fetchCalendarFeed` to `TimerAPI`
- ✅ Added `addCalendarProposal`, `updateCalendarProposal`, `acceptCalendarProposal`, `dismissCalendarProposal` to `LogAPI`

---

## ❌ What Still Needs to Be Done

### 1. Update Preload Script (`electron/preload.ts`)
Add IPC bridge methods to `timerAPI`:
```typescript
fetchCalendarFeed: async (url: string): Promise<string> => {
  const result = await ipcRenderer.invoke('fetch-calendar-feed', url);
  if (result.success) {
    return result.data;
  }
  throw new Error(result.error || 'Failed to fetch calendar feed');
}
```

Add IPC bridge methods to `logAPI`:
```typescript
addCalendarProposal: async (proposal: Omit<CalendarProposal, 'id'>): Promise<string> => {
  const result = await ipcRenderer.invoke('add-calendar-proposal', proposal);
  if (result.success) {
    return result.id;
  }
  throw new Error(result.error || 'Failed to add calendar proposal');
},

updateCalendarProposal: async (id: string, updates: Partial<CalendarProposal>): Promise<void> => {
  const result = await ipcRenderer.invoke('update-calendar-proposal', id, updates);
  if (!result.success) {
    throw new Error(result.error || 'Failed to update calendar proposal');
  }
},

acceptCalendarProposal: async (id: string, taskId?: string): Promise<void> => {
  const result = await ipcRenderer.invoke('accept-calendar-proposal', id, taskId);
  if (!result.success) {
    throw new Error(result.error || 'Failed to accept calendar proposal');
  }
},

dismissCalendarProposal: async (id: string): Promise<void> => {
  const result = await ipcRenderer.invoke('dismiss-calendar-proposal', id);
  if (!result.success) {
    throw new Error(result.error || 'Failed to dismiss calendar proposal');
  }
}
```

### 2. Update Log Store (`src/stores/logStore.ts`)
Add calendar sync to the `loadDay` function. The calendar entries are already being loaded (line 63), but we need to add sync functionality:

```typescript
// Add this import at the top
import { syncCalendarProposals } from '../services/calendar';

// In loadDay function, before loading calendar proposals:
loadDay: async (date: string) => {
  set({ isLoading: true });

  try {
    // Sync calendar proposals from ICS feed
    await syncCalendarProposals(date);

    // Load pomodoro sessions for the day
    const sessions = await window.logAPI.getSessions(date);

    // ... rest of the existing code
  }
}
```

### 3. Display Calendar Proposals in Daily Log UI
The `DailyLog.tsx` component already displays calendar entries (they're converted in logStore), but we need to add UI for accepting/dismissing proposals.

Add action buttons to `EntryRow.tsx` for calendar entries:
```typescript
{entry.type === 'calendar' && !entry.logged && (
  <div className="flex gap-2">
    <button
      onClick={() => onAccept(entry.id)}
      className="px-2 py-1 text-xs bg-green-600 text-white rounded"
    >
      Accept
    </button>
    <button
      onClick={() => onDismiss(entry.id)}
      className="px-2 py-1 text-xs bg-gray-600 text-white rounded"
    >
      Dismiss
    </button>
  </div>
)}
```

Add these handlers in `DailyLog.tsx`:
```typescript
const handleAcceptProposal = async (id: string) => {
  await window.logAPI.acceptCalendarProposal?.(id);
  await loadDay(selectedDate);
};

const handleDismissProposal = async (id: string) => {
  await window.logAPI.dismissCalendarProposal?.(id);
  await loadDay(selectedDate);
};
```

---

## Testing Steps

1. **Add Calendar URL in Settings**
   - Go to Settings
   - Paste your Outlook ICS URL in "Outlook Calendar ICS URL" field
   - Click "Save Settings"

2. **Test Calendar Sync**
   - Go to Daily Log
   - Should automatically sync calendar events for today
   - Check console logs for "Fetching calendar from:" and "Found X events"

3. **Test Accept/Dismiss**
   - Calendar events should appear in the daily log
   - Click "Accept" on a calendar proposal
   - Should convert to a logged entry with the event's duration
   - Click "Dismiss" on a calendar proposal
   - Should disappear from the list

---

## Files Modified

- ✅ `src/services/calendar.ts` - NEW FILE (ICS parser)
- ✅ `src/services/db.ts` - Added calendar proposal operations
- ✅ `electron/main.ts` - Added IPC handlers for calendar
- ✅ `src/types/index.ts` - Added calendar method types
- ❌ `electron/preload.ts` - NEEDS: Add IPC bridge methods
- ❌ `src/stores/logStore.ts` - NEEDS: Add syncCalendarProposals call
- ❌ `src/components/DailyLog/DailyLog.tsx` - NEEDS: Add accept/dismiss handlers
- ❌ `src/components/DailyLog/EntryRow.tsx` - NEEDS: Add action buttons for calendar entries

---

## Context for claude-code

You are continuing work on Phase 4 (Calendar Integration) of the Productivity Agent MVP. The backend (calendar service, database operations, IPC handlers) is complete. Now you need to:

1. Wire up the IPC bridge in preload.ts
2. Add calendar sync to logStore
3. Add UI for accepting/dismissing calendar proposals

The project uses:
- Electron + React + TypeScript
- ical.js for parsing ICS feeds
- Zustand for state management
- SQLite (better-sqlite3) for local database
- Tailwind CSS for styling

All previous phases (Timer, Daily Log, API Integration) are working correctly.
