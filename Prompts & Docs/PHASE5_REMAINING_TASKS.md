# Phase 5: Remaining Tasks (Post-Notifications)

## Status

✅ **Completed:**
- Notifications for pomodoro/break end (already implemented in timerStore.ts)

## Remaining Features

### 1. Break Logic 🔄 (Priority: HIGH)

**Goal**: Implement short (5 min) and long (10 min) breaks with proper cycling

**Current State**:
- Timer supports both break types
- No automatic cycling between short/long breaks
- Session counter exists but not fully integrated

**Tasks**:
- [ ] Add database settings for `pomodoroLongBreak` (10 min) and `sessionsUntilLongBreak` (3)
- [ ] Enhance timerStore session counter to track daily pomodoro count
- [ ] Auto-determine break type based on session count (3rd session → long break)
- [ ] Reset counter after long break or at midnight
- [ ] Test cycling: Session 1 → short, Session 2 → short, Session 3 → long, repeat

**Files to modify**:
- `src/services/db.ts` - Add new settings
- `src/stores/timerStore.ts` - Session counter logic
- `src/components/Timer/Timer.tsx` - Display break type indicator

**Estimated time**: 30-45 minutes

---

### 2. Reporting View 📊 (Priority: MEDIUM)

**Goal**: View logged time entries with filters and aggregations

**Features**:
- Date range picker (from/to)
- Filter by task ID or project
- Show total hours logged
- Group by day/project/task
- Display in table format

**Tasks**:
- [ ] Create `src/components/Reporting/Reporting.tsx` main component
- [ ] Create `src/components/Reporting/DateRangePicker.tsx`
- [ ] Create `src/components/Reporting/ReportTable.tsx`
- [ ] Add query function `getLoggedEntriesInRange()` in `src/services/db.ts`
- [ ] Add "Reporting" link to Sidebar
- [ ] Add route to `src/App.tsx`

**Database query needed**:
```typescript
export function getLoggedEntriesInRange(
  startDate: string,
  endDate: string
): LoggedEntry[] {
  // Query pomodoro_sessions and adhoc_entries
  // WHERE logged = 1 AND date BETWEEN startDate AND endDate
  // JOIN with task_cache for project info
  // Return unified format
}
```

**UI Layout**:
```
┌─────────────────────────────────────────┐
│ Reporting                               │
│                                         │
│ From: [2025-11-01] To: [2025-12-01]    │
│ Task: [Search...] Project: [All]       │
│                                         │
│ ┌──────────────────────────────────┐   │
│ │ Date     │ Task  │ Hours │ $    │   │
│ ├──────────────────────────────────┤   │
│ │ 12-01    │ #123  │ 2.5   │ $    │   │
│ │ 12-01    │ #456  │ 1.0   │ $    │   │
│ ├──────────────────────────────────┤   │
│ │ Total:          │ 3.5h  │      │   │
│ └──────────────────────────────────┘   │
│                                         │
│ [Export CSV] [Export JSON]             │
└─────────────────────────────────────────┘
```

**Estimated time**: 60-90 minutes

---

### 3. Export JSON/CSV 📥 (Priority: LOW)

**Goal**: Export logged time entries from reporting view

**Features**:
- Export current report view to CSV
- Export current report view to JSON
- Include all relevant fields (date, task, hours, project, comment)
- Save to user-selected location
- Show success notification

**CSV Format**:
```csv
Date,Task ID,Project,Hours,Comment,Billable,Logged At
2025-12-01,643749,Project X,2.5,"Dev work",true,2025-12-01T18:00:00Z
```

**JSON Format**:
```json
{
  "exported_at": "2025-12-01T18:00:00Z",
  "date_range": {"from": "2025-12-01", "to": "2025-12-01"},
  "entries": [
    {
      "date": "2025-12-01",
      "task_id": "643749",
      "project_name": "Project X",
      "hours": 2.5,
      "comment": "Dev work",
      "billable": true,
      "logged_at": "2025-12-01T18:00:00Z"
    }
  ],
  "total_hours": 2.5
}
```

**Tasks**:
- [ ] Create `src/utils/export.ts` with CSV/JSON generation functions
- [ ] Add IPC handler in `electron/main.ts` for file save dialog
- [ ] Wire up export buttons in Reporting component
- [ ] Add success/error notifications

**Estimated time**: 30-45 minutes

---

## Implementation Order

1. **Break Logic** (30-45 min) - Highest impact on daily UX
2. **Reporting View** (60-90 min) - Core analytics feature
3. **Export** (30-45 min) - Depends on Reporting being complete

**Total Estimated Time**: 2-3 hours

---

## Known Issues to Address Later

- **Calendar sync performance**: Cache implementation added but not verified working (see CALENDAR_SYNC_FIX.md)
- **Calendar day filtering**: ICS fetch processes all events instead of narrowing query (performance optimization needed)

---

## Testing Checklist

### Break Logic
- [ ] After 1 pomodoro → 5 min break offered
- [ ] After 2 pomodoros → 5 min break offered
- [ ] After 3 pomodoros → 10 min break offered
- [ ] Counter resets after long break
- [ ] Counter persists across app restarts (until midnight)

### Reporting
- [ ] Can select date range
- [ ] Shows only logged entries in range
- [ ] Totals are calculated correctly
- [ ] Can filter by task/project
- [ ] Empty state shows when no data

### Export
- [ ] CSV export works and opens in Excel/Numbers
- [ ] JSON export is valid JSON
- [ ] File save dialog allows choosing location
- [ ] Export includes all visible filtered data
- [ ] Success notification appears

---

## Notes

- Notifications are already complete ✅
- Break logic has foundation in timerStore, just needs counter logic
- Reporting requires new UI components but DB queries are straightforward
- Export is the simplest feature, depends on Reporting data structure
