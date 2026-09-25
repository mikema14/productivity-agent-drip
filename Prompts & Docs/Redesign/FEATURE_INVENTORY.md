# Drip — Feature-parity inventory for the Now · Plan · Review · Insights redesign

> Generated 2026-09-25 before the merge into `feature/redesign`. Paths without a prefix are repo-relative. `I/...` paths came from the idle-kickoff worktree and now live at the same repo-relative path on `feature/redesign`.


Path prefixes used below (all paths are absolute once expanded):
- `` = `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/` (branch `feature/task-picker`, uncommitted task-picker work)
- `I/` = `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip-idle/` (branch `feature/idle-kickoff`, on top of `feature/raycast-focus`, v1.0.5)
- Mockups: `/private/tmp/claude-501/-Users-marekmikesz-Documents-Claude-workplace-Drip-productivity-agent-drip/513a3341-4a1c-4a6c-84f8-74fcd18721b3/scratchpad/drip-design/project/`

IPC bridge names (`electron/preload.ts:547-551`): `window.timerAPI`, `window.logAPI`, `window.dashboardAPI`, `window.aiAPI`, `window.listsAPI`; overlay window uses `window.overlayAPI` (`electron/overlayPreload.ts`).

---

## 1. Feature inventory (current app)

### 1.1 App shell / routing / global

| Feature | Entry point | Shortcut | Store / IPC |
|---|---|---|---|
| State-based view switch: `timer` / `daily-log` / `progress` / `settings` / `lists` (single list) / `all-lists` | `src/App.tsx:63-80` | none | local state |
| Boot: load session count, hydrate timer from main, register main-timer listeners | `src/App.tsx:21-25` | – | `timerStore.loadSessionCount/checkTimerHydration/setupMainTimerListeners` |
| Boot: restore persisted day (`logStore.loadDay`) | `src/App.tsx:36-40` | – | logStore (persisted `selectedDate`, `viewMode`) |
| "N days since last log" nudge notification (≥6 days) | `src/App.tsx:42-61` | – | `timerAPI.getDaysSinceLastLog` → `db.getDaysSinceLastLog` (`src/services/db.ts:1202`) |
| CreateListModal mounted at root | `src/App.tsx:86-88` | – | listsStore |
| Sidebar collapse state (w-64 ↔ 76px) | `src/App.tsx`, `src/components/Sidebar.tsx:104-119` | – | local |
| Window close → hide (not quit); single-instance lock; 1200×800 hiddenInset | `electron/main.ts:135-140` | – | – |
| Persisted zustand keys: `timerMode`, `sessionViewMode`, `lastTaskId`, `lastTaskTitle`, `intention`, `durationMinutes` | `src/stores/timerStore.ts:609-616` | – | localStorage |

### 1.2 Sidebar

| Feature | Entry point | Shortcut | Store / IPC |
|---|---|---|---|
| Nav: Timer / Daily Log / Progress / Settings | `src/components/Sidebar.tsx:76-81` | none | – |
| Collapse toggle | `Sidebar.tsx:104-119` | none | – |
| Daily intention button: shows first intention + "Edit"; opens SetIntentionModal | `Sidebar.tsx:141-168`, `:268-275` | none | `intentionsStore` → `dashboardAPI.getDailyIntentions/setDailyIntentions` |
| Lists header + "+" create list | `Sidebar.tsx:173-197` | none | listsStore.createList |
| "All Tasks" entry → AllListsOverview | `Sidebar.tsx:200-216` | none | – |
| Per-list button with colour dot → ListPlanningView | `Sidebar.tsx:219-234` | none | listsStore |
| "Show archived (n) / Hide archived" toggle + per-list Restore | `Sidebar.tsx:237-262` | none | `listsStore.toggleShowArchivedLists/unarchiveList` → `listsAPI.getArchivedLists/unarchiveList` |

### 1.3 Timer view (`src/components/Timer/Timer.tsx`, 718 lines)

| Feature | Entry point | Shortcut | Store / IPC |
|---|---|---|---|
| Focus states `ready-empty` / `ready-selected` / `running` / `paused` | `Timer.tsx:20, 81-84` | – | timerStore |
| Header title Focus / Deep work / Break; subtitle "Session N of 8" / "Start your session" / "Take a breather" | `Timer.tsx:322-333` | – | timerStore.sessionCount |
| State pill (Ready/Focusing/Paused/Break) | `Timer.tsx:336-347` | – | – |
| IntentionRow ("Today's intention" + Edit → SetIntentionModal) | `Timer.tsx:351-353`, `src/components/Timer/IntentionRow.tsx` | – | intentionsStore |
| Continue-previous CTA (last session with task today; "#id" pill; Continue →) | `Timer.tsx:222-237, 356-358`, `src/components/Timer/ContinuePreviousCTA.tsx` | – | `timerAPI.getLastSessionWithTask` |
| 320px clock ring w/ tick marks, RAF progress arc | `Timer.tsx:120-132, 400-478` | – | – |
| **+5 min capsule** (running only) | `Timer.tsx:418-433` | – | `timerStore.extendSession` → `timerAPI.extendMainTimer` |
| Session window "start → end" under the digits | `Timer.tsx:436-447` | – | – |
| MM:SS digits + 8 session dots | `Timer.tsx:461-478` | – | sessionCount |
| DurationSegments 15 / 25 / 50 / 90 | `Timer.tsx:484-486`, `src/components/Timer/DurationSegments.tsx` | – | `timerStore.setDurationMinutes` (persisted) |
| TaskPicker (idle, always-open search + list) | `Timer.tsx:497-533`, `src/components/Timer/TaskPicker.tsx` | `/` focuses search (`Timer.tsx:104-118`); ↑/↓/Enter; Esc clears query then blurs | `useTaskPickerNav` + `useTaskSearch` → `logAPI.searchTasks` (task_cache, debounce 120ms, limit 50); numeric+Enter → `timerAPI.getIssue` |
| Ranked recent tasks (frecency: 30-day window, 7-day decay, limit 20, `todayMinutes`) | `Timer.tsx:23, 152-189`; `src/utils/frecency.ts`; `src/services/db.ts:851` | – | `logAPI.getRankedRecentTasks` |
| TaskResultList: label "Recent tasks / Searching… / All tasks · N"; rows id-pill, title, today's minutes or relative age, project name; amber current-marker; empty states | `src/components/Timer/TaskResultList.tsx:40, 83-127` | keyboard-only scrollIntoView | – |
| TaskCardWithPicker (selected task): collapsible id row, search-in-place, "Fetching…" slot, session note input, footer project + "Today · N/8 sessions" | `src/components/Timer/TaskCardWithPicker.tsx:88-178` | Esc: clear query → close; outside click closes | `timerStore.setIntention` (note = intention) |
| BillableToggle on selected task (prefilled from list item > list > global) | `Timer.tsx:196-204`, `src/components/shared/BillableToggle.tsx` | – | `listsAPI.getBillableForTask` → `db.getBillableDefaultForTask` (`db.ts:1687`) |
| Readonly TaskCard during active session | `Timer.tsx:525-533`, `src/components/Timer/TaskCard.tsx` | – | – |
| Boundary check ("Starting Work Late?") when `enableBoundaryCheck` and now ≥ `workdayEndTime` | `Timer.tsx:139-150, 206-220`, `src/components/Timer/BoundaryConfirmDialog.tsx` | – | settings `enableBoundaryCheck`, `workdayEndTime` |
| BoundaryConfirmDialog "Change Settings" sets `window.location.hash='#/settings'` — **App has no hash routing, so this button is dead** | `Timer.tsx:696` | – | – |
| Action bar: Begin Focus (disabled when no task), Skip Break, Pause/Resume, Finish (early), Cancel | `Timer.tsx:538-637` | none | `timerStore.startFocus/skipBreak/pauseTimer/resumeTimer/finishEarly/reset` → `timerAPI.start/pause/resume/stopMainTimer` |
| Cancel confirm modal when elapsed > 300 s | `Timer.tsx:245-251`, `src/components/Timer/CancelConfirmModal.tsx` | – | – |
| Finish early: ceil elapsed, reject <1 min with notification, comment `Finished early (Nm)` | `src/stores/timerStore.ts:368-529` | – | `timerAPI.saveSession`, notifications |
| Break logic: break = duration/5 min (min 1), long = 2× every 3rd session (`SESSIONS_UNTIL_LONG_BREAK=3`) — **ignores Settings pomodoroShortBreak/LongBreak/sessionsUntilLongBreak** | `timerStore.ts:28-35` | – | – |
| Focus complete: save session (comment = intention or "Focus session"), raise overlay, notification, tray "Ready"; break complete saves break ≥1 min | `timerStore.ts:211-366` | – | `timerAPI.saveSession`, `showSessionOverlay` |
| Session count per day (`lastSessionDate` / `sessionCount` settings) | `timerStore.ts:622-647` | – | `timerAPI.getSettings/saveSettings` |
| Hydration from main-process timer on reload | `timerStore.ts:660-682` | – | `timerAPI.getMainTimerState` |
| Right panel toggle **Timeline | Tasks** | `Timer.tsx:643-666` | none | local |
| TimerDayTimeline: Mon-based week header prev/Today/next, 7-day grid, stats row (sessions/focus/break/meetings), hour timeline (HOUR_HEIGHT 80, dynamic range, overlap resolution), session/calendar/adhoc blocks, active hatched block, red now-line, auto-scroll, Unscheduled adhoc section, FAB "+" → AddEntryModal | `src/components/Timer/TimerDayTimeline.tsx:133-139, 214-282, 525-561` | none | `timerAPI.getSessions`, `logAPI.getCalendarProposals/getAdhocEntries/addAdhocEntry` |
| TimerTaskList: Today/Week/All column filter, search, list pills, show-completed, grouped by list w/ progress bar, checkbox complete, TaskIdBadge, subtasks expand + click subtask → select task with subtask title as intention; list.task_id overrides item.task_id | `src/components/Lists/TimerTaskList.tsx:11-15, 76-85` | none | listsStore, `listsAPI.updateListItem` |
| SetIntentionModal (max 3; Enter adds; Esc closes) | `Timer.tsx:691-715`, `src/components/shared/SetIntentionModal.tsx` | Enter/Esc | intentionsStore |
| Selecting a list item from TimerTaskList sets task + intention | `Timer.tsx:668-687` | – | – |

### 1.4 Daily Log view (`src/components/DailyLog/DailyLog.tsx`, 533 lines)

| Feature | Entry point | Shortcut | Store / IPC |
|---|---|---|---|
| Header: ← date-button → ; date button opens CalendarPopover | `DailyLog.tsx:333-382`, `src/components/DailyLog/CalendarPopover.tsx` | Esc closes popover | `logStore.setSelectedDate/loadDay`; `logStore.getMonthlyStats` for activity dots |
| 🔄 Force calendar sync | `DailyLog.tsx:261-275, 333-382` | – | `logAPI.fetchCalendarFeed` + `services/calendar.ts` |
| Stats subtitle: Total, break, "N to log", "N logged" | `DailyLog.tsx:385-405` | – | logStore selectors |
| Empty state "Add your first entry" | `DailyLog.tsx:414-423` | – | – |
| ControlBar: ViewToggle List/Timeline; "Move to…" + "Log N Items →" when marked; Add; Templates; Select/Unselect All; 🌙 End Day (hidden when day locked); "⊞ Group by Task / ⊟ Show Flat" (list view only) | `src/components/DailyLog/ControlBar.tsx:38-112`, `ViewToggle.tsx` | none | logStore (`viewMode` persisted), shutdownStore.isDayLocked |
| Move calendar popover (move selected entries to another date; single + bulk) | `DailyLog.tsx:214-236, 448-456` | – | `logStore.moveEntries` → `logAPI.updateAdhocEntry/updateCalendarProposal`, `timerAPI.updateSession` |
| Log selected → Easy Project (getIssue for project id, POST, mark logged with `server_entry_id`) | `DailyLog.tsx:238-259`; `src/stores/logStore.ts` `logSelected` | – | `timerAPI.getIssue`, `timerAPI.postTimeEntry` (USER_ID 28668, ACTIVITY_ID 95; 401/404/422 handling in `electron/main.ts`) |
| Success toast with "View in Easy Project →" (`buildEPLink` → es.easyproject.com/easy_time_entries?user_id=28668) | `DailyLog.tsx:514-530` | – | `timerAPI.openExternal` |
| Group-by-task merge (mergeEntriesByTaskId) with merged toggle/update/delete (confirm) | `DailyLog.tsx:130-194`, `src/utils/mergeEntries.ts` | – | – |
| Timeline view (TimelineView: hour timeline of LogEntry, active-block exclusion, Unscheduled section) | `DailyLog.tsx:458-484`, `src/components/DailyLog/TimelineView.tsx` | – | – |
| List view rows (EntryRow): checkbox markedToLog / ✓ logged / '-' proposal / '~' break; type badges pomodoro/break/adhoc/calendar; "N sessions" merged badge; comment; TaskDisplay; "✓ Billable / Not billable"; actions Accept/Dismiss (proposal), Edit, Move, Delete, "Logged to Easy Project" | `src/components/DailyLog/EntryRow.tsx` | – | `logStore.toggleLogMark/updateEntry/deleteEntry`, `logAPI.acceptCalendarProposal/dismissCalendarProposal` |
| Inline edit in EntryRow: TaskIdInput, title, duration, comment, BillableToggle, Save/Cancel | `EntryRow.tsx:82-149` | – | `logStore.updateEntry` |
| Delete blocked for logged entries (notification); calendar delete = dismiss | `logStore.ts` `deleteEntry` | – | – |
| Day lock after End Day (shutdownStore.isDayLocked) | `DailyLog.tsx`, `src/stores/shutdownStore.ts` | – | `dashboardAPI.isDayLocked/unlockDay` |
| Calendar feed background updates re-load day | `DailyLog.tsx:93-99` | – | `timerAPI.onCalendarFeedUpdated` |
| AddEntryModal: Quick Templates chips, Title*, Start Time (+Clear / "No start time (unscheduled)"), Duration* + presets 15m/30m/1h/2h, Task ID (TaskIdInput; billable prefill), Comment, BillableToggle, Cancel/Add | `src/components/DailyLog/AddEntryModal.tsx` | – | `logStore.addManualEntry`, `logAPI.getTemplates`, `listsAPI.getBillableForTask` |
| EndDayModal (shutdown ritual): Today's Plan (intentions), Review (Total Work, Deep Work %, Tasks Worked chips), Reflection, Daily Notes, Tomorrow's Intentions ×3; saves ritual, computes weekly summary, sets tomorrow's intentions; success notification | `src/components/DailyLog/EndDayModal.tsx`; `DailyLog.tsx:281-288` | – | `shutdownStore.saveRitual` → `dashboardAPI.saveShutdownRitual`, `dashboardAPI.computeWeeklySummary(monday)`, `dashboardAPI.setDailyIntentions` |
| TemplateManagerModal: list templates (name, task, duration, billable, comment), + Add, Edit, Delete (confirm); inner EditTemplateModal (Name, Task ID, Default Duration, Default Comment, Billable) | `src/components/DailyLog/TemplateManagerModal.tsx` | – | `logAPI.getTemplates/addTemplate/updateTemplate/deleteTemplate` |
| Calendar proposals sync (ICS → local-date index, RRULE expansion, exception handling, 10-min TTL, recurring " 🔁" suffix, keyed `event_uid|start_at`) | `src/services/calendar.ts` (383 lines); `logStore.loadDay` | – | `logAPI.fetchCalendarFeed/getCalendarProposals/addCalendarProposal/updateCalendarProposal` |

### 1.5 Progress view (`src/components/Progress/ProgressPage.tsx`, 176 lines)

| Feature | Entry point | Shortcut | Store / IPC |
|---|---|---|---|
| Month navigation | `ProgressPage.tsx` | none | – |
| MetricsRow: Deep Work h, Trend, Focus Rate, Peak Window | `src/components/Progress/MetricsRow.tsx` | – | `dashboardAPI.getWeeklySummariesInRange/getSessionsByTimeOfDay` |
| MonthlyCalendar heatmap + legend + total/deep% footer | `src/components/Progress/MonthlyCalendar.tsx` | – | `logStore.getMonthlyStats` |
| AIInsightsPanel: tabs Patterns / Synthesis / Coach, Generate/Redo, sessionStorage cache, requires OpenRouter key | `src/components/Progress/AIInsightsPanel.tsx`; `src/services/ai.ts` | – | `aiAPI.callOpenRouter` (`electron/main.ts` `call-openrouter`) |
| ReflectionsSection (shutdown reflections in range) | `src/components/Progress/ReflectionsSection.tsx` | – | `dashboardAPI.getShutdownReflectionsInRange` (via logStore.getMonthlyStats) |
| **Orphan:** GoalProgressSection (goal id from task preferences + `getTaskTotalMinutes`) — file exists, not imported anywhere | `src/components/Progress/GoalProgressSection.tsx` (111 lines) | – | `dashboardAPI.getAllTaskPreferences/getTaskTotalMinutes` |

### 1.6 Settings view (`src/components/Settings/Settings.tsx`, 476 lines; +55 on idle branch)

Every field (`Settings.tsx:5-21`, save handler ~`:70-100`):

| Field | Setting key | Consumed by |
|---|---|---|
| Easy Project API URL | `apiBaseUrl` | `services/api.ts`, `useTaskPickerNav.fetchById`, TaskIdInput |
| API key (password) | `apiKey` | same |
| Test Connection button (→ `/users/current.json`) | – | `timerAPI.testApiConnection` |
| Calendar ICS URL | `calendarUrl` | main-process 15-min refresh (`electron/main.ts`), `services/calendar.ts` |
| Focus duration | `pomodoroFocus` | **only** `TaskDetailInline.tsx` Start button; timerStore uses `durationMinutes` segments |
| Short break | `pomodoroShortBreak` | **not consumed** (timerStore derives duration/5) |
| Long break | `pomodoroLongBreak` | **not consumed** |
| Sessions until long break | `sessionsUntilLongBreak` | **not consumed** (hardcoded 3) |
| Default billable (checkbox) | `defaultBillable` | `db.getBillableDefaultForTask` fallback (`db.ts:1689`) |
| Rounding mode select none/5min/15min | `roundingMode` | saved; no consumer found in renderer |
| Enable boundary check + Workday end time | `enableBoundaryCheck`, `workdayEndTime` | `Timer.tsx:139-150` |
| OpenRouter API key / model | `openRouterApiKey`, `openRouterModel` (default `anthropic/claude-4.5-sonnet-20250929`) | `services/ai.ts` |
| Show tray icon | `show_tray_icon` | `timerAPI.toggleTray`; `electron/tray.ts` |
| Session-end overlay | `sessionEndOverlay` | `timerAPI.setOverlayEnabled`; `electron/overlayWindow.ts` |
| **Idle branch:** Idle Nudge toggle | `idleNudgeEnabled` | `I/electron/idleNudge.ts:40-46` |
| **Idle branch:** Raycast Focus toggle | `raycastFocusEnabled` | `I/electron/raycastFocus.ts:43-49` |
| Save Settings + success/error message | – | `timerAPI.saveSettings` |
| TaskTrackingPreferences section: Track New Task (search), list with tracked checkbox, Pinned badge, Pin/Unpin, Remove (copy says "appear in the Dashboard" — no dashboard exists) | `src/components/Settings/TaskTrackingPreferences.tsx` (170) | `dashboardAPI.getAllTaskPreferences/setTaskPreference` |
| **Orphan:** GoalsManagement (create goal title/description/identity, Set Active, Edit) — not imported | `src/components/Settings/GoalsManagement.tsx` (267) | `dashboardAPI.getAllGoals/createGoal/updateGoal/setActiveGoal` |

### 1.7 Lists (single list) — `src/components/Lists/ListPlanningView.tsx` (439)

| Feature | Entry point | Shortcut | Store / IPC |
|---|---|---|---|
| Columns Backlog / This Week / Today | `ListPlanningView.tsx:22-26` | none | listsStore.getItemsByColumn |
| Header: colour dot, name, TaskIdBadge (list-level task id), BillableToggle (list default), remaining count, Archive list (confirm) | `:185-215` | – | `listsStore.updateList/archiveList` |
| Per column: done/total + progress bar; "Add Task" → AddItemInline (title, task id, BillableToggle) | `ListPlanningView.tsx`, `src/components/Lists/AddItemInline.tsx` | Enter adds | `listsStore.createItem` (optimistic) |
| Drag-and-drop between columns (@dnd-kit PointerSensor distance 5, closestCorners, DragOverlay) | `ListPlanningView.tsx`, `DraggableItem.tsx` | – | `listsStore.moveItem` → `listsAPI.updateListItem`, `db.reorderItemsInColumn` |
| Item row: checkbox complete, title click → TaskDetailInline, TaskIdBadge, "n/m Subtasks" inline checklist, hover Move left/right, Move-to-list dropdown, Delete; completed strikethrough; "All Clear" empty state | `ListPlanningView.tsx` | – | `listsStore.updateItem/deleteItem` |
| TaskDetailInline: title (blur save), Task ID, description, **Start** (guards running session, reads `pomodoroFocus`, sets duration+intention, startFocus w/ billable, notification), **Log** → LogTimeModal, BillableToggle sm, subtasks add/toggle/delete + progress bar, close | `src/components/Lists/TaskDetailInline.tsx` (313) | – | timerStore.startFocus, `listsAPI.getBillableForTask` |
| LogTimeModal (portal): duration + presets, date + Today/Yesterday, comment; "Add to Log" (local adhoc) / "Log Now" (POST, disabled without task id) | `src/components/Lists/LogTimeModal.tsx` (193) | – | `logStore.addManualEntry/logEntryNow` |
| CreateListModal: colour picker (LIST_COLORS), icon preview, name, Task ID (TaskIdInput autofills name), "Billable by default", Create | `src/components/Lists/CreateListModal.tsx` (152) | – | `listsStore.createList` |
| Auto-archive completed items older than 7 days on load | `src/stores/listsStore.ts` `loadItems`; `db.ts:1583-1589` | – | `listsAPI.archiveOldCompleted` |

### 1.8 All Tasks — `src/components/Lists/AllListsOverview.tsx` (508)

| Feature | Entry point | Shortcut | Store / IPC |
|---|---|---|---|
| Columns Backlog / This Week / Today / **Done** | `AllListsOverview.tsx` | none | listsStore |
| Header "N remaining across M lists"; toggles **Group** (by list), **Done** (localStorage `allListsOverview_showDone`), **IDs** (localStorage `allListsOverview_showTaskIds`) | same | – | localStorage |
| List filter pills: All + per-list multi-select | same | – | – |
| Item: checkbox, title → TaskDetailInline, list tag, subtasks badge/checklist, move left/right, move-to-list dropdown with checkmark | same | – | listsStore |
| Drag to Done sets completed; drag out of Done uncompletes | same | – | `listsStore.updateItem` |

### 1.9 Shared components

| Component | File | Notes |
|---|---|---|
| TaskIdInput (recents dropdown + search; blur fetch cache/API) | `src/components/shared/TaskIdInput.tsx` (156) | `logAPI.getRecentTasks/searchTasks`, `timerAPI.getIssue` |
| BillableToggle (role=switch pill, sizes) | `src/components/shared/BillableToggle.tsx` (47) | |
| SetIntentionModal (max 3 soft) | `src/components/shared/SetIntentionModal.tsx` (83) | intentionsStore (max 3, `src/stores/intentionsStore.ts`) |
| TaskIdBadge (tooltip) | `src/components/shared/TaskIdBadge.tsx` (47) | used by Lists views only |
| TimelineItem | `src/components/shared/TimelineItem.tsx` | used by DailyLog + (dead) SessionHistory |
| TaskDisplay | `src/components/shared/TaskDisplay.tsx` (87) | used by EntryRow |
| MainContent wrapper | `src/components/shared/MainContent.tsx` (18) | |

### 1.10 Dead / orphaned components (confirmed by import grep — zero importers)

| File | What it did | Verdict |
|---|---|---|
| `src/components/Timer/QuickLogBar.tsx` (73) | quick manual log bar | dead |
| `src/components/Timer/TimerControls.tsx` (119) | older control bar | dead |
| `src/components/Timer/SessionHistory.tsx` (194) | today's session list grouped/flat via `timerStore.sessionViewMode` | dead (but `sessionViewMode` still persisted) |
| `src/components/Timer/DailyIntentionBanner.tsx` (139) | intentions + yesterday's notes banner | dead |
| `src/components/shared/TaskInput.tsx` (120) + `src/hooks/useTaskLookup.ts` (202) | older task input | dead (hook only used by dead TaskInput) |
| `src/components/Progress/GoalProgressSection.tsx` (111) | goal progress bars | orphan |
| `src/components/Settings/GoalsManagement.tsx` (267) | goals CRUD | orphan |
| `src/components/DailyLog/AddTemplateModal.tsx` (147) | light-theme template modal | imported by TemplateManagerModal (check whether the inner EditTemplateModal supersedes it before deleting) |
| `src/stores/goalsStore.ts`, `milestonesStore.ts` | goals/milestones state | no UI consumer except orphans |
| `timerStore.timerMode` ('pomodoro'/'stopwatch') | persisted | no stopwatch UI exists |

### 1.11 Overlays & notifications (separate BrowserWindow)

| Feature | Entry point | Shortcut | Store / IPC |
|---|---|---|---|
| Transparent always-on-top overlay window (screen-saver level, all workspaces, click-through with hover interactivity), positioned on last-active display below menu-bar band (MARGIN_Y 96); repositions on display change | `electron/overlayWindow.ts` (370); `src/overlay/useOverlayHoverInteractivity.ts` | – | `overlay:*` IPC |
| Focus-complete card: task id/title, time range, note input "What did you get done?" (debounced save), buttons Start break (Nm) / Next focus, dismiss × | `src/overlay/SessionEndOverlay.tsx` (544) | Enter = start break, Esc = dismiss | `overlayAPI.saveNote` → `overlay:save-note` (updates session comment); `overlay:action` relayed to renderer (`timerStore.setupMainTimerListeners` `onOverlayAction`) |
| Break-complete card: "Start focus Nm" | same | Enter | `next-focus` action |
| Break-running pill with progress | same | – | `overlay:break-started`, `onTick` |
| Escalation after 60 s: halo, chime, EdgeGlow strips on every display | `SessionEndOverlay.tsx`, `src/overlay/EdgeGlow.tsx`, `src/overlay/chime.ts` | – | `overlay:set-escalated` |
| Dev params `?state=focus|break-complete|break` (`?edge=1` for edge windows) | `SessionEndOverlay.tsx` `devPayload`, `src/overlay/main.tsx` | – | – |
| Overlay enable/disable setting | `overlayWindow.ts` `initOverlayEnabled/setEnabled` | – | `sessionEndOverlay` |
| macOS notifications (session complete, log success/failure, finish-early rejection, moved entries, end-day, days-since-log) | `src/utils/notifications.ts`; `timerAPI.showNotification` (`preload.ts:54`) | – | `show-notification` IPC |
| **Idle branch additions:** `idle` red nudge card ("Nothing running · 12m", "Kickoff HH:MM", Start focus / Kickoff 2m / Snooze 15m, ×), `kickoff-continue` card ("Kickoff done", countdown, "Rolling into Nm focus", Keep going / Stop) — no amber escalation for these; `?state=idle|kickoff` | `I/src/overlay/SessionEndOverlay.tsx` (+213), `I/src/overlay/glass.ts` ALERT, `I/src/theme/tokens.js` alert red | – | `OverlayActionType` `idle-start-focus / idle-kickoff / idle-snooze / kickoff-keep / kickoff-stop` (`I/src/types/index.ts`) |

### 1.12 Tray / menu bar

| Feature | Entry point |
|---|---|
| Tray (opt-in via `show_tray_icon`), icon from `public/icon.png`, menu Show App / Quit, click toggles window | `electron/tray.ts` (134) |
| Tray title `MM:SS` / `Break MM:SS` / `5m Break` / `Ready` (throttled) | `electron/timer.ts` `formatTrayTime`, `updateTray` |
| Renderer can set tray text (`updateTrayTime`) | `electron/preload.ts:46` |

### 1.13 Raycast / deeplinks

| Feature | Entry point |
|---|---|
| `drip://` scheme handler: `start-focus?taskId&intention`, `pause`, `resume`, `stop`, `finish-early`, `start-break?duration`, `skip-break`, bare `drip://` (show window) | `electron/main.ts:150-213`; renderer `timerAPI.onUrlStartFocus / onUrlTimerAction` (`preload.ts:169-173`) |
| **Idle branch:** `drip://kickoff` → `startKickoff('manual')` | `I/electron/main.ts` (+ case 'kickoff') |
| Main-process timer writes `timer_state` setting every 10 ticks (with `pendingBreak` after focus) for Raycast | `electron/timer.ts` `writeTimerState` |
| Raycast extension (reads SQLite at `~/Library/Application Support/drip/productivity.db` via sqlite3 CLI; writes via `sqlite3` exec): commands `timer-status` (menu-bar, 10s; **deleted on idle branch**), `start-focus` (form: task/list-item/subtask/intention → deeplink), `add-entry` (adhoc insert), `todays-log`, `search-tasks` (cache + API fetch, start focus, copy id, open in EP; list dropdown), `todays-intentions` (add/complete/remove), `log-entries` (POST unlogged to EP, Log All), `weekly-stats`; **idle branch adds** `kickoff` (no-view → `drip://kickoff`) | `drip-raycast/src/*.tsx`, `drip-raycast/src/lib/{constants,db,dedup}.ts`; `I/drip-raycast/src/kickoff.tsx`, `I/drip-raycast/package.json` |

### 1.14 Background behaviour (main process)

| Feature | Entry point |
|---|---|
| Main-process 1-s timer (unthrottled), `timer-tick` / `timer-complete` / `timer-extended` to renderer, ticks to overlay, `sampleActiveDisplay` every 5 ticks | `electron/timer.ts` (265) |
| Calendar ICS download every 15 min → `calendar-feed-cache.ics` → `calendar-feed-updated` event | `electron/main.ts` `startCalendarBackgroundRefresh`, `fetch-calendar-feed` |
| Task cache on every `get-issue` | `electron/main.ts` `get-issue`; `db.cacheTask` |
| SQLite schema: `task_cache`, `pomodoro_sessions`, `adhoc_entries`, `calendar_proposals`, `daily_summaries`, `settings`, `log_templates`, `task_preferences`, `milestones`, `goals`, `daily_intentions`, `shutdown_rituals`, `weekly_summaries`, `lists`, `list_items` (+ migrations for billable, start_time, archived, completed_at, description, subtasks, goal_id, target_hours) | `src/services/db.ts:21-160, 370-574` |
| **Idle branch — idle watcher** (pure state machine `off → counting → nudged → snoozed`; nudge after 10 min idle, kickoff 15 min after nudge; break-end path counts from break end; gates: toggle off / screen locked or asleep / away ≥120 s system idle / outside Mon–Fri 08:00–18:00 / in a non-all-day calendar event; snooze 15 min; dismiss does not stop escalation; `DRIP_IDLE_FAST=1` seconds mode) | `I/electron/idleWatcher.ts` (235), wiring `I/electron/idleNudge.ts` (284: powerMonitor lock/unlock/suspend/resume, 30-s poll, `isInMeeting` from `calendar_proposals`) |
| **Idle branch — kickoff**: one focus session of `kickoffSeconds` (120) that at zero extends itself by the full focus length (`rolloverSeconds`) instead of completing; roll-over prompt Keep going / Stop with 10-s auto-keep; Stop saves what ran as its own session with comment "Kickoff"; task = current > today's last session task > `lastTaskId`; auto kickoff brings window to front without stealing keyboard focus (`showInactive`); Timer header shows "Kickoff" / "Rolls into Nm" | `I/electron/kickoff.ts` (56), `I/electron/timer.ts` (+97: `setTimerListener`, `rollOver`), `I/src/stores/timerStore.ts` (+140: `kickoff`, `startKickoff`, `stopKickoff`, `onIdleCommand`), `I/src/components/Timer/Timer.tsx:320-330`, `I/electron/preload.ts` `onIdleCommand`, `I/src/types/index.ts` `IdleCommand` |
| **Idle branch — Raycast Focus mirror**: `raycast://focus/start?goal&duration&mode=block&categories=social,streaming,gaming` on focus start/resume/extend, `raycast://focus/complete` on pause/stop/complete/quit; `open -g`; cold-launch ordering guard; requires Raycast to own `raycast://` | `I/electron/raycastFocus.ts` (115) |
| `showOverlay(payload, {force})` bypasses `sessionEndOverlay` toggle for idle/kickoff cards; `getVisibleOverlayKind()` | `I/electron/overlayWindow.ts` |

Note: `src/types/index.ts` in the task-picker checkout already contains `kind: 'idle'` (L215) and `kind: 'kickoff-continue'` (L226) and the extended `OverlayActionType` (L239) — the idle types have leaked into the task-picker working tree even though its electron/overlay code has not. Worth checking before merging.

---

## 2. Mapping to the new IA (rail: Now · Plan · Review · Insights · Settings; ⌘K per header)

Legend: **Now** = Main.dc.html, **Plan** = Plan.dc.html, **Review** = Review.dc.html, **Insights** (no mockup), **Settings**, **Overlay**, **Rail**, **⌘K**, **NO HOME**.

| Current feature | New home | Notes |
|---|---|---|
| Timer ring / digits / session N of 8 / state pill | **Now** | Mockup: 160px Barlow digits + ruler ticks, "READY · SESSION 3/8", header pill "Ready". Ring replaced by ruler. |
| DurationSegments 15/25/50/90 | **Now** | Present in mockup. |
| Session note input | **Now** | Present ("Session note (optional)"). |
| Begin Focus (↵) | **Now** | Present; mockup adds Enter shortcut (not in code today). |
| Pause/Resume, Finish early, Cancel + CancelConfirmModal, Skip Break | **Now** | **Not drawn in mockup** (only Ready state shown) — must be added to the running/paused/break states. |
| +5 min capsule | **Now** | Not drawn — running state missing from mockup. |
| Continue-previous CTA | **Now** | Not drawn; the "Today" section's first row / "Start on 689742" in Plan partially covers it. Flag as needs a slot. |
| Task picker (search `/`, ↑↓ Enter, numeric fetch, "Recent by frequency") | **Now** | Mockup Tasks section = Today's 3 + Recent + search with `/` kbd. |
| TaskCardWithPicker collapsible id row | **Now** | Mockup shows selected task as "689742 — EWOK OPS / title" in the focus panel with a 4-dot pager (new). |
| BillableToggle on Timer selected task | **NO HOME** in Now mockup | Only Review shows billable pills. Needs a place in Now (task panel). |
| Boundary check dialog ("Starting Work Late?") | **Overlay/modal** from Now | Fix dead "Change Settings" (route to Settings rail item). |
| IntentionRow / SetIntentionModal / daily intentions (max 3) | **NO HOME** as free-text intentions | Mockups replace "intentions" with Today's-3 *tasks*. Intentions are text strings in `daily_intentions`; EndDayModal "Today's Plan" and Raycast `todays-intentions` depend on them. Decide: map intention text → Today's 3 titles, or keep a small intention line in Now/Review. |
| Sidebar intention button | **NO HOME** (rail has no text) | See above. |
| Timeline | Tasks right-panel toggle | **Now** (Timeline fixed in right aside) + **Plan** (tasks) | Mockup's aside is timeline-only ("Day", capacity bar, hour grid, "3 entries not logged · Review day →"). TimerTaskList (Today/Week/All filter, list pills, show-completed, subtasks) has **NO HOME** unless the Now task list absorbs it. |
| TimerDayTimeline week header (prev/Today/next, 7-day grid, stats row) | **NO HOME** | Now aside shows a single day, no week nav/stats. Could go to Insights or Review header. |
| TimerDayTimeline FAB "+" → AddEntryModal | **Review** ("+ Entry") | Also consider Now aside. |
| Unscheduled adhoc section | **Review** table (rows without Time) / Now aside | Not drawn. |
| Daily Log date nav ← → + CalendarPopover month picker | **Review** header (‹ Fri 25 Sep ›) | CalendarPopover month grid with activity dots: **NO HOME** drawn — keep as popover on the date label. |
| 🔄 Force calendar sync | **NO HOME** | Add to Review header or ⌘K action. |
| Stats subtitle (total, break, N to log, N logged) | **Review** header (tracked / billable / to log) | "break" and "logged" counts dropped in mockup. |
| ViewToggle List/Timeline in Daily Log | **Review** = table only; timeline lives in **Now** aside | TimelineView of LogEntry (active block exclusion) → **NO HOME** as a Review mode. |
| Group by Task / Show Flat (merge) | **NO HOME** | Not in Review mockup. |
| Select All / Unselect All, "Log N Items →" | **Review** footer ("3 selected · 1h 45m · Log 3 to Easy8") | Select-all not drawn. |
| "Move to…" date move (single/bulk) | **NO HOME** | Not drawn. |
| EntryRow inline edit (task id, title, duration, comment, billable) | **Review** rows (billable pill, "Assign task" dashed button) | Full inline edit not drawn; keep. |
| Calendar proposals Accept / Dismiss | **Review** rows | Mockup shows a proposal row (dashed "Assign task", log checkbox disabled) — accept/dismiss buttons not drawn. |
| Type badges (pomodoro/break/adhoc/calendar), merged "N sessions" badge, "Logged to Easy Project" state | **Review** rows (coloured dot + green check for logged) | Break rows and type badges not drawn. |
| Delete entry (guarded) | **Review** rows | Not drawn. |
| Success toast "View in Easy Project →" | **Review** (toast) | Keep. |
| AddEntryModal (templates chips, start time, presets, task id, comment, billable) | **Review** "+ Entry" | Keep modal. |
| Log templates (TemplateManagerModal + EditTemplateModal, "Templates" button) | **NO HOME** | Not in any mockup. Options: ⌘K "Add from template…", or inside "+ Entry". |
| QuickLogBar | dead | drop. |
| End Day / EndDayModal (Today's Plan, Review stats, Reflection, Daily Notes, Tomorrow's intentions ×3), day lock | **Review** aside ("One line on today", "End day", Tomorrow: Starts in Today / 2 slots / Calendar) | Mockup collapses Reflection+Notes into one textarea and replaces tomorrow-intentions with tomorrow's Today-3 carry-overs; Deep-work %/Tasks-worked chips not drawn; day-lock behaviour not drawn. |
| Weekly summary computation on End Day | **Review** (background) | keep. |
| Lists sidebar (colour dot, +, All Tasks, archived toggle/restore) | **Plan** left aside (Lists, "+", All tasks 22, per-list rows with subtitle, "Archived · 2") | Restore per archived list not drawn. |
| ListPlanningView columns Backlog/This Week/Today, per-column progress, Add Task inline | **Plan** (Today / This week / Backlog) | Column order reversed; per-column progress bar not drawn; Add Task inline not drawn (⌘K?). |
| AllListsOverview 4th "Done" column, Group/Done/IDs toggles, list filter pills | **Plan** ("All tasks", "Group by list" pill) | Done column, Done/IDs toggles, multi-select pills **NO HOME**. |
| DnD between columns | **Plan** ("Drop a task here, or press W") | keep @dnd-kit. |
| TaskDetailInline (title, id, description, Start, Log, billable, subtasks) | **NO HOME** drawn | Plan cards show title/id/list/time only. Needs an expand or side panel. |
| Subtasks (add/toggle/delete, badge, Raycast subtask picker) | **NO HOME** | Not drawn anywhere. |
| LogTimeModal (Add to Log / Log Now) | **NO HOME** | Not drawn; could hang off Plan card or ⌘K. |
| List-level task id + list BillableToggle + "Billable default" | **Plan** aside ("logs to 679834", "3 clients · billable", "not billable") | Editing UI not drawn. |
| Item BillableToggle (AddItemInline) | **NO HOME** | |
| Archive list (confirm) | **Plan** | not drawn. |
| Move-to-list dropdown, Move left/right | **Plan** (keys T/W/S/D) | Move-to-list not drawn. |
| CreateListModal | **Plan** "+" | keep modal. |
| Auto-archive 7-day completed items | **Plan** (background) | keep. |
| Progress month nav, MetricsRow, MonthlyCalendar heatmap | **Insights** | No mockup — assume 1:1 carry-over. |
| AI insights (Patterns/Synthesis/Coach) | **Insights** | no mockup. |
| ReflectionsSection | **Insights** | no mockup. |
| Goals & milestones (GoalProgressSection, GoalsManagement, goalsStore, milestonesStore, `set-task-goal-id`) | **NO HOME** (already orphaned) | Decide drop vs. Insights. |
| Task tracking preferences (tracked/pinned) | **Settings** | Used by nothing visible ("Dashboard" copy). |
| All Settings fields (§1.6) | **Settings** | Consider surfacing that pomodoro break fields are inert or wire them. |
| Session-end overlay (focus/break cards, break pill, escalation, edge glow, note save) | **Overlay** | unchanged. |
| Idle nudge (red card) | **Overlay** (Nudge.dc.html) | Mockup adds "takeover in 14:32" countdown and explanatory copy naming the target task; code shows "Kickoff HH:MM" and no task name. |
| Kickoff roll-over prompt (Keep going / Stop) | **Overlay** | not in mockups (Kickoff.dc.html shows an in-app takeover instead — see §3). |
| Kickoff 2m button | **Now** ("KICKOFF 2M" beside Begin Focus) | Exists only on idle branch (`drip://kickoff`, nudge button); no in-app button today. |
| Tray, deeplinks, Raycast commands, calendar refresh, notifications | unchanged (main process) | Raycast `timer-status` menu-bar removed on idle branch. |
| SessionHistory, TimerControls, DailyIntentionBanner, TaskInput | dead | drop. |
| Sidebar collapse | **Rail** (fixed 72px) | drop toggle. |
| ⌘K search | new | see §3. |

---

## 3. Behaviour the mockups imply that does NOT exist today

| Implied behaviour | Where | What exists | Needed data / schema |
|---|---|---|---|
| **Today cap 3** ("3 / 3"), **This-week cap 5** ("4 / 5", "1 slot left") | Plan | Columns are unbounded (`list_items.column` free) | Cap constants; UI rejection/replace flow when full; Raycast `start-focus` list-item picker ignores caps. |
| **Today's-3 pick flow** ("2 slots — pick in the morning", numbered 1/2/3 rows in Now) | Now, Review | No ordering semantics beyond `list_items.order`; no per-day snapshot | Either derive from `column='today'` (cross-list, capped) or a new `daily_focus(date, list_item_id, slot)` table; needs a morning prompt. |
| **Carried-over count** ("Carried 3× · split or drop?", "Carry-overs land in tomorrow's Today") | Review | No history of column moves | New column `list_items.carried_count INTEGER` + `carried_from DATE`, incremented by end-day roll; or derive from `daily_focus` history. |
| **Review outcome per Today item: Done / Carry / To week / Drop** | Review | EndDayModal only records text reflection; completing = checkbox | End-day step that writes `completed`/`column`/`archived` and bumps carry count. |
| **Stale-item triage keys** (T Today, W Week, S Snooze, D Drop, K Keep; "Untouched 14+ days" group with age "18d"; "Meeting Inbox · new since Monday") | Plan | No keyboard shortcuts in Lists; no `snoozed_until`; no `last_touched_at`; no "source" for meeting-inbox items | `list_items.snoozed_until DATE`, `last_touched_at DATETIME` (update on any edit/move/session), `source TEXT` ('leexi'/'manual'); keyboard handler with focused-row model. |
| **"logs to <task>" on lists** (list subtitle) | Plan aside | `lists.task_id` exists (`db.ts` migration) and `TaskIdBadge` shows it in ListPlanningView header | Only presentation; also "3 clients · billable" implies list metadata (`lists.billable` exists; client count does not). |
| **Capacity "free time" line** ("2h 10m planned · 3h 40m free before 17:00"; Now aside "3h 05m / 6h" 12-segment bar; Tomorrow "3 meetings · 4h 20m free") | Now, Plan, Review | No planned-duration on list items; no daily capacity setting; calendar proposals exist for meetings | `list_items.estimate_minutes`, settings `dailyCapacityMinutes` / `workdayEndTime` (exists), computation = capacity − meetings − planned − tracked. |
| **Per-task "planned" duration on Today rows** ("1h 15m", "25m") and "2h 10m wk" on week rows | Now, Plan | `todayMinutes` exists only for *tracked* minutes (frecency) | Estimate field as above; week-tracked minutes needs `sumMinutesForDay` generalised to week. |
| **⌘K command palette** ("Search or jump to…") | every header | Only `/` focuses the Timer task search; no global palette | New component: tasks (`logAPI.searchTasks`), list items, views, actions (sync calendar, add entry, templates, set intention). |
| **Enter = Begin Focus** (↵ badge) | Now | Not bound | keydown handler when task selected. |
| **KICKOFF 2M button in Now** | Now | Idle branch has `startKickoff` via nudge/deeplink only | Call `timerStore.startKickoff(120)` (idle branch). |
| **4-dot task pager under selected task** | Now | none | Probably Today's-3 index; define. |
| **Kickoff full-window takeover** (Kickoff.dc.html: 240px "1:37", task, progress bar, "Raycast Focus on · social, streaming, gaming blocked", "Started automatically after 15m idle", `esc` Stop) | Kickoff | Idle branch runs the kickoff in the normal Timer view with header "Kickoff / Rolls into 25m" and `showInactive()`; Stop lives on the overlay prompt after roll-over | New full-screen renderer state driven by `timerStore.kickoff==='warmup'`; Esc → `stopKickoff`; a "Raycast Focus active" indicator needs main → renderer signal (none today; `raycastFocus.ts` `active` is private). |
| **Nudge "takeover in 14:32" countdown + target task in copy** | Nudge | Idle card shows "Kickoff HH:MM" clock time; target task resolved only when kickoff starts | Pass `kickoffAt` (exists) and resolved `taskId/title` in `IdleNudgePayload`. |
| **Review header "4h 25m billable"** | Review | Billable flag per entry exists; no aggregate selector | Sum in logStore. |
| **"Assign task" dashed button on calendar proposal row; log checkbox disabled without task** | Review | EntryRow inline edit assigns task id; `logEntryNow` disables without id; `logSelected` behaviour for id-less entries needs checking | UI only. |
| **Tomorrow panel: "Starts in Today" (carry-overs), "Calendar 3 meetings · 4h 20m free"** | Review | Tomorrow's intentions ×3 (text) in EndDayModal; calendar proposals for tomorrow are available via `getCalendarProposals(date)` | Carry-over data (above) + calendar sum for date+1. |
| **Rail badge dot on Now** (amber dot at top-right when… running?) | Now | none | define semantics (running timer / unlogged entries). |
| **Week label "Week 39 · 21–27 Sep" with ‹ › in Plan** | Plan | TimerDayTimeline has week nav; Lists have none | Week context for "This week" column (currently timeless). |
| **"Weekly review" button** | Plan | `computeWeeklySummary` exists (used by End Day) but no review UI | New view/modal. |
| **Now aside "3 entries not logged · Review day →"** | Now | counts exist in logStore | link to Review. |

---

## 4. Test baseline

### 4.1 `main` branch
No test files tracked (`git ls-tree main` matches only `Prompts & Docs/*TEST_CHECKLIST.md`). No vitest config. `package.json` v1.0.4 has no `test` script on main (added in both feature branches). Playwright is a dev dependency but there are no e2e specs anywhere.

### 4.2 `feature/task-picker` (``, all untracked)
Config: `vitest.config.ts` (jsdom, `src/**/*.test.{ts,tsx}`), `src/test/setup.ts` (jest-dom, `scrollIntoView` stub, `window.logAPI` / `window.timerAPI` stubs), `src/test/fixtures.ts` (`makeTask/makeTasks`).

| File | Tests | Covers |
|---|---|---|
| `src/utils/frecency.test.ts` (94) | 9 | decay, 30-day window, ranking/tie-breaks, limit, todayMinutes, `sumMinutesForDay` |
| `src/utils/time.test.ts` (31) | 4 | `formatMinutes`, `parseDbTimestamp` (UTC + ISO), `relativeTime` buckets |
| `src/components/Timer/TaskPicker.test.tsx` (157) | 12 | list on mount, >5 rows scroll, empty state, search label, highlight on focus, ↓↓Enter, aria-activedescendant + scroll, hover no-scroll, clamp, no-results keys, Esc semantics, outside click, numeric Enter fetch |
| `src/components/Timer/TaskResultList.test.tsx` (61) | 3 | project name untruncated, today's minutes vs age, current marker |
| `src/components/Timer/TaskCardWithPicker.test.tsx` (44) | 3 | collapsed note input, open uses shared list, Esc → onToggle |
| **Total** | **31 tests, 5 files** | Timer task-picker slice + two util modules only |

### 4.3 `feature/idle-kickoff` (`I/`, untracked)
Config: `I/vitest.workspace.ts` (two projects: renderer jsdom via `vitest.config.ts`, plus `electron` node project for `electron/**/*.test.ts`), `I/src/test/setup.ts` (no fixtures.ts). Does **not** contain the task-picker tests.

| File | Tests | Covers |
|---|---|---|
| `I/electron/idleWatcher.test.ts` (217) | 18 | nudge timing, work hours/weekend gates, away gate, snooze, escalation (incl. dismissed nudge still escalates, away cancels), resets on timer activity/unlock, duplicate stop, break-end path, configurable numbers |
| `I/electron/kickoff.test.ts` (57) | 4 | roll-over at zero, Stop ends session + Raycast, normal session completes, Raycast duration = kickoff + focus |
| `I/src/overlay/SessionEndOverlay.test.tsx` (82) | 3 | idle card renders idle time + 3 actions; no amber escalation for idle; kickoff prompt relays Keep/Stop |
| **Total** | **25 tests, 3 files** | idle state machine + kickoff rule + two overlay states |

### 4.4 Critical flows with NO automated coverage (any branch)
- Easy Project POST time entry (`electron/main.ts` `post-time-entry`, `logStore.logSelected/logEntryNow`, 401/404/422 handling, `server_entry_id` marking, rounding).
- Calendar ICS parsing / RRULE expansion / exceptions / local-date indexing / proposal upsert (`src/services/calendar.ts`, 383 lines).
- Timer state machine in renderer (`timerStore.ts` 779: startFocus/complete/break/long-break cadence/pause/resume/finishEarly/reset/extend/hydration) and main-process `electron/timer.ts` (tick, complete, `timer_state` write, tray).
- Lists DnD and column moves (`ListPlanningView`, `AllListsOverview`, `listsStore.moveItem`, `db.reorderItemsInColumn`), auto-archive rule.
- Daily Log merge-by-task (`mergeEntries.ts`), move-entries date logic, delete guards.
- Session-end overlay focus/break cards, escalation timer, edge glow, note save (only idle/kickoff states are tested).
- `drip://` URL handling, single-instance forwarding, Raycast extension (no tests in `drip-raycast/`).
- Billable resolution chain (`db.getBillableDefaultForTask`), frecency SQL (`db.getRankedRecentTasks`), `getDaysSinceLastLog`.
- End-day ritual save + weekly summary computation (`db.computeWeeklySummary`, 215-320).
- AI insights prompt/response handling (`services/ai.ts`).
- No typecheck/test in CI; no e2e (Playwright unused).

---

## 5. Risk hotspots

### 5.1 Large / fragile files a redesign will touch (line counts)

| File | Lines | Why fragile |
|---|---|---|
| `src/services/db.ts` | 1704 | All schema + migrations + queries in one module; both processes import it. New Plan/Review fields (estimates, carry counts, snooze, source) land here. |
| `electron/main.ts` | 1503 | Every IPC handler + URL scheme + calendar refresh + overlay wiring; idle branch adds more. |
| `src/stores/logStore.ts` | 945 | Unified LogEntry across 3 tables; merge/move/log/delete logic; many dashboard selectors used by Progress. |
| `src/stores/timerStore.ts` | 779 (idle: +140) | Renderer half of the timer state machine, overlay relay, URL/overlay/idle listeners, persisted keys. Untested. |
| `src/components/Timer/Timer.tsx` | 718 | Layout + state machine + 3 modals + right panel; Now redesign rewrites most of it. |
| `src/components/Timer/TimerDayTimeline.tsx` | 564 | Custom hour-grid layout with overlap resolution; becomes Now's aside. |
| `src/overlay/SessionEndOverlay.tsx` | 544 (idle: +213) | Inline-styled overlay with hand-rolled escalation/hover/note-save; two branches diverge here. |
| `src/components/DailyLog/DailyLog.tsx` | 533 | Becomes Review; merge/move/log/end-day orchestration. |
| `src/types/index.ts` | 522 | Shared IPC contracts; already drifting between branches (idle types present in task-picker tree). |
| `src/components/Lists/AllListsOverview.tsx` | 508 / `ListPlanningView.tsx` 439 | Two parallel DnD board implementations with duplicated item rendering; Plan must unify them. |
| `src/components/Settings/Settings.tsx` | 476 | Flat form with 16+ fields, several inert. |
| `src/services/calendar.ts` | 383 | Untested ICS/RRULE logic. |
| `electron/overlayWindow.ts` | 370 | Multi-display positioning, click-through, edge windows. |
| `electron/preload.ts` | 551 | Five bridge objects; every new IPC needs three edits (main, preload, types). |
| Branch divergence | – | `feature/task-picker` (Timer/TaskPicker/db/types/preload/main) and `feature/idle-kickoff` (timer/overlay/timerStore/Settings/types/preload/main) both modify `electron/main.ts`, `electron/preload.ts`, `src/types/index.ts`, `src/components/Timer/Timer.tsx`, `src/services/db.ts` — merge conflicts guaranteed; neither has the other's tests. |

### 5.2 Legacy glass classes
Grep for `glass-button|glass-surface-elevated|bg-glass-bg|border-glass-border|bg-glass-hover|glass-surface|glass-input|bg-glass` across `src` (excluding `src/overlay`) returned **no matches**, and `src/index.css` defines no `.glass-*` classes. The CLAUDE.md/UI_DESIGN_SYSTEM claim that they remain in DailyLog/Lists/Settings is stale. What does remain:
- `shadow-glass` / `shadow-glass-sm` Tailwind tokens (`tailwind.config.js:36-37`) used by the modals: `CalendarPopover.tsx`, `AddEntryModal.tsx`, `EndDayModal.tsx`, `TemplateManagerModal.tsx`, `LogTimeModal.tsx`, `BoundaryConfirmDialog.tsx`, `CreateListModal.tsx`, `CancelConfirmModal.tsx`, `SetIntentionModal.tsx`, `TaskIdInput.tsx` (all under `src/components/`).
- Overlay `GLASS` constants (`src/overlay/glass.ts`) — intentional, overlay-only.
- Design-system drift elsewhere: `AddTemplateModal.tsx` light-theme styling; emoji prefixes in ControlBar (🔄 🌙 ⊞ ⊟) contradicting the "no prefix symbols" rule; oklch inline styles in the new task-picker components vs. Tailwind tokens elsewhere; mockups use square corners (`border-radius: 0/2px`) in Now but 10–14px radii in Plan/Review — inconsistent among themselves.

### 5.3 Behavioural landmines to preserve
- `list.task_id` overrides `item.task_id` everywhere (TimerTaskList `:76-85`, Raycast `dedup.ts effectiveTaskId`).
- Billable chain item > list > global (`db.ts:1687-1700`).
- Finish-early <1 min rejection; cancel confirm only after 300 s; break = duration/5, long every 3rd.
- Calendar proposal identity `event_uid|start_at`; deleting a proposal = dismiss, not delete.
- Logged entries cannot be deleted; day lock after End Day.
- `timer_state` setting + `pendingBreak` contract consumed by the Raycast extension (menu-bar command removed on idle branch, but `start-focus`, `search-tasks`, `log-entries` still read the DB directly — schema changes must stay backward compatible with `drip-raycast/src/lib/db.ts`).
- Overlay `force` flag on idle branch: idle/kickoff cards must show even when `sessionEndOverlay` is off.