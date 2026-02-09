# Phase 5: Polish - Implementation Plan

## Overview
Add final MVP features: notifications, reporting, export, and break logic.

## Tasks

### 1. Notifications ⏰
**Goal**: Notify user when pomodoro sessions and breaks end

**Features**:
- Desktop notification when focus session ends (25 min)
- Desktop notification when break ends (5 min short / 10 min long)
- Sound notification (optional)
- Auto-start break after focus session
- Show notification in menu bar icon

**Implementation**:
- Use existing `window.timerAPI.showNotification()`
- Add in Timer component when countdown reaches 0
- Add notification sounds (optional)

**Files**:
- `src/components/Timer/Timer.tsx` - Add notification calls
- `electron/main.ts` - Notification handler (already exists)

---

### 2. Break Logic 🔄
**Goal**: Implement short (5 min) and long (10 min) breaks

**Logic**:
- After 3 pomodoros → Long break (10 min)
- After each other pomodoro → Short break (5 min)
- Track session count per day
- Reset count at midnight or manually

**Settings**:
- `pomodoroFocus`: 25 min (already exists)
- `pomodoroShortBreak`: 5 min (already exists)
- `pomodoroLongBreak`: 10 min (needs to be added)
- `sessionsUntilLongBreak`: 3 (needs to be added)

**Implementation**:
- Add session counter to timerStore
- Auto-determine break type based on count
- Auto-start break after focus session completes

**Files**:
- `src/stores/timerStore.ts` - Add session counter logic
- `src/components/Timer/Timer.tsx` - Use counter for break type
- Database - Track session count

---

### 3. Reporting View 📊
**Goal**: View logged time entries with filters

**Features**:
- Date range picker (from/to)
- Filter by task ID or project
- Show total hours logged
- Group by day/project/task
- Display in table format

**Layout**:
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

**Implementation**:
- New component: `src/components/Reporting/Reporting.tsx`
- Query database for logged sessions in date range
- Aggregate by project/task
- Display in table with totals

**Files**:
- `src/components/Reporting/Reporting.tsx` - Main component
- `src/components/Reporting/DateRangePicker.tsx` - Date selector
- `src/components/Reporting/ReportTable.tsx` - Results table
- `src/services/db.ts` - Add query function for logged entries

---

### 4. Export JSON/CSV 📥
**Goal**: Export logged time entries

**Features**:
- Export current report view to CSV
- Export current report view to JSON
- Include all relevant fields (date, task, hours, project, comment)
- Save to user-selected location

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

**Implementation**:
- Add export buttons to Reporting view
- Generate CSV/JSON from report data
- Use Electron's dialog to save file
- Show success notification

**Files**:
- `src/components/Reporting/Reporting.tsx` - Add export buttons
- `src/utils/export.ts` - Export logic (CSV/JSON generation)
- `electron/main.ts` - Add IPC handler for file save dialog

---

## Implementation Order

1. **Break Logic** (30 min)
   - Update settings schema
   - Add session counter to timerStore
   - Implement auto-break logic

2. **Notifications** (20 min)
   - Add notification calls in Timer
   - Test focus/break end notifications

3. **Reporting View** (60 min)
   - Create database query function
   - Build Reporting component
   - Add date range filtering
   - Display results table

4. **Export** (30 min)
   - Add CSV/JSON generation
   - Add file save dialog
   - Wire up to Reporting view

**Total Estimated Time**: 2-3 hours

---

## Testing Checklist

### Notifications
- [ ] Focus session ends → Desktop notification shows
- [ ] Short break ends → Notification shows
- [ ] Long break ends → Notification shows
- [ ] Notifications appear in macOS Notification Center

### Break Logic
- [ ] After 1 pomodoro → 5 min break offered
- [ ] After 2 pomodoros → 5 min break offered
- [ ] After 3 pomodoros → 10 min break offered
- [ ] Counter resets after long break
- [ ] Manual skip/stop works correctly

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

## Database Schema Updates

Add to settings table:
```sql
-- Already exists:
-- pomodoroFocus: 25
-- pomodoroShortBreak: 5

-- Need to add:
INSERT INTO settings (key, value) VALUES ('pomodoroLongBreak', '10');
INSERT INTO settings (key, value) VALUES ('sessionsUntilLongBreak', '3');
```

New database query needed:
```typescript
// In src/services/db.ts
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

---

## Files to Create/Modify

### New Files
- `src/components/Reporting/Reporting.tsx`
- `src/components/Reporting/DateRangePicker.tsx`
- `src/components/Reporting/ReportTable.tsx`
- `src/utils/export.ts`

### Modified Files
- `src/stores/timerStore.ts` - Break logic
- `src/components/Timer/Timer.tsx` - Notifications
- `src/services/db.ts` - Report queries
- `electron/main.ts` - File save dialog IPC
- `src/components/Layout/Sidebar.tsx` - Add "Reporting" link
- `src/App.tsx` - Add Reporting route

---

## Success Criteria

Phase 5 is complete when:
1. ✅ Pomodoro sessions show notifications when complete
2. ✅ Break logic cycles between short/long breaks correctly
3. ✅ Reporting view shows logged time with filters
4. ✅ Can export time logs to CSV and JSON
5. ✅ All features work smoothly without errors

---

## Notes

- **Priority**: Implement in order listed (break logic enables notifications)
- **Keep it simple**: MVP polish, not production-ready
- **Test thoroughly**: Notifications are critical for UX
- **Calendar perf fix**: Can be addressed post-MVP
