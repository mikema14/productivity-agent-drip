# Phase 3 plan: Review screen

Spec: `mockups/Review.dc.html`. Shared language: `mockups/Main.dc.html` / `Plan.dc.html` as implemented in Phases 1–2 (`PHASE1_PLAN.md` §1.1, `PHASE2_PLAN.md` §3, `UI_DESIGN_SYSTEM.md` "Now Screen Tokens" / "Plan Screen Tokens"). Parity source: `FEATURE_INVENTORY.md` §1.4 (Daily Log), §1.9 (shared), §2 (Review rows), §3 (Review rows), §5.3.

Baseline on `feature/redesign` at `f036088`: 203 tests green (18 files), `tsc --noEmit` = 39 errors, `vite build` OK.

Owner rules carried over from Phases 1–2 and still binding: square `rounded-[2px]` radii + hairlines (P15), no inert controls (Q4), no caps on counts (P9), `DAY_TARGET_MINUTES = 360` imported from `TimerDayTimeline.tsx:16` and never duplicated (Q5/P8), `#`-less id pills (rule 6), Settings / Insights / other views untouched, components the mockup does not restyle stay as they are unless trivially re-tokenised.

**Safety rule for this phase (non-negotiable).** Review is the only screen that posts to the user's real Easy8 account. The main-process guard (`electron/main.ts:881-885`: `post-time-entry` returns `Blocked` when `!app.isPackaged` unless `DRIP_ALLOW_API_WRITES=1`) and the renderer dev throw (`src/services/api.ts:126`) are not touched by any commit in this phase. Unit tests prove that `logSelected` / `logEntryNow` reach the network only through `window.timerAPI.postTimeEntry` (an IPC mock in tests) and never through `fetch`. The e2e smoke never clicks anything that posts, saves a ritual, or mutates an entry (§7).

## 0. Ground truth that shapes the plan

- Review today is `src/components/DailyLog/DailyLog.tsx` (533 lines) hosting: header with `←` / date button (`CalendarPopover`) / `🔄` sync / `→` (`:328-382`), stats subtitle `Total · Nm break · N to log · N logged` (`:384-405`), empty state `No entries for this day` + `Add your first entry` (`:414-423`), `ControlBar` (`:427-446`), the Move `CalendarPopover` (`:448-456`), `TimelineView` or the `TimelineItem` + `EntryRow` list (`:458-484`), `AddEntryModal`, `EndDayModal`, `TemplateManagerModal` (`:491-511`), success toast with `View in Easy Project →` (`:514-530`, `buildEPLink` `:64-72` hard-codes `user_id=28668`).
- `ControlBar.tsx` (116 lines) carries: `ViewToggle` List/Timeline, `Move to...` + `Log N Items →` when `markedCount > 0` (`:38-56`), `+ Add`, `Templates`, `Select/Unselect All` when `toggleableCount > 0`, `🌙 End Day` unless `isDayLocked`, `⊞ Group by Task / ⊟ Show Flat` in list view (`:62-111`). Emoji prefixes violate rule 6.
- `EntryRow.tsx` (303 lines): edit mode (`:82-149`: `TaskIdInput`, title, duration, comment, `BillableToggle`, Save/Cancel; `handleTaskSelect` copies the event name to the comment for calendar rows `:33-44`), display mode = checkbox / `✓` logged / `-` proposal / `~` break (`:161-179`), title + type badge + `N sessions` badge (`:181-194`), duration (`:196-200`), comment or `No comment` (`:202-209`), `TaskDisplay` (renders `#id`, `:211-215`), `✓ Billable / Not billable` (`:217-224`), actions Accept/Dismiss (proposal), Edit (not break), Move (`onMove` and not logged), Delete, `Logged to Easy Project` (`:227-284`). `memo` compares eleven fields (`:290-303`).
- `logStore.ts` (945 lines): `LogEntry` (`:8-24`); `loadDay` syncs the ICS feed unless `skipSync` (`:80-87`) then maps the three tables (`:99-142`). Calendar rows get **no `billable`** (`calendar_proposals` has no such column, `db.ts:60-72`); `updateEntry` silently drops `billable` for calendar rows (`:221-228`) while the edit form shows a `BillableToggle` for them; `logSelected` posts `billable: entry.billable` = `undefined` for calendar rows, which `api.ts:116` turns into `DEFAULT_BILLABLE = true`. `toggleLogMark` refuses logged rows and proposals (`:275`) and persists `marked_to_log` only for adhoc rows (`:283-287`); pomodoro / calendar marks are UI-only. `toggleSelectAll` (`:302-343`) same rule. `logSelected` (`:345-433`): per entry → `Task ID is required` / duration check → `easyProjectAPI.getIssue` when `projectId` is missing (always, since `loadDay` never sets it) → `postTimeEntry` → mark logged (`updateSession` with `log_sent_at` + `server_entry_id`, `updateAdhocEntry {logged:1}`, `updateCalendarProposal {logged:1}`); errors are collected per entry in `result.errors` but **the UI shows only a count notification** (`DailyLog.tsx:247-252`). `deleteEntry` refuses logged rows with a notification (`:244-252`), calendar delete = dismiss (`:260-262`). `moveEntries` (`:497-529`) rewrites the date part of `start_at` for sessions and proposals. `partialize` persists `viewMode` **and `selectedDate`** (`:937-943`) → the known quirk: Review reopens on the last viewed day after a relaunch (`App.tsx:35-39` loads `selectedDate || today`).
- `NowAside.openReview` (`NowAside.tsx:33-37`) calls `loadDay(today)` **without** `setSelectedDate(today)`; `DailyLog`'s mount effect then calls `loadDay(selectedDate)` again, so `Review day →` lands on whatever `selectedDate` was. Same root cause as the quirk; fixed together (R1).
- `api.ts`: `getIssue` and `postTimeEntry` go through `window.timerAPI.getIssue` / `postTimeEntry` when present (`:33-45`, `:121-123`); the `fetch` fallbacks are dead in Electron (preload always defines both) and the POST fallback throws in dev (`:126`). `initialize()` reads `apiBaseUrl` / `apiKey` from settings and throws `API not configured` when either is empty (`:14-24`). `main.ts` `post-time-entry` maps 401 / 404 / 422 / other to `{ success:false, error }` strings (`:919-933`); preload turns `success:false` into a thrown `Error`, which is what `result.errors[].error` carries. `get-issue` caches the task on success (`:844-851`).
- `EndDayModal.tsx` (301 lines): loads sessions + adhoc for `date` (`:37-71`: total = non-break sessions + adhoc, deep = `source==='pomodoro'`, `tasksWorked` = distinct ids), sections Today's Plan (intentions, only when any), Review (Total / Deep % / `#id` chips), Reflection, Daily Notes, Tomorrow's Intentions ×3; `handleSubmit` (`:81-133`) → `saveRitual` → `computeWeeklySummary(monday)` → `addIntention(date+1, …)` for each tomorrow intention (**calendar** tomorrow, `:116-124`) → `onSuccess` → `DailyLog` re-checks the lock and notifies. `saveShutdownRitual` upserts with `locked=1` (`db.ts:1534-1568`); `isDayLocked` hides End Day; `unlockDay` exists in `shutdownStore` / IPC but has **no UI**.
- `CalendarPopover.tsx` (223 lines): month grid with activity dots from `getMonthlyStats`, `Today` button when not on today (`:154-161`), no forward navigation past the current month (`:85`), closes on outside click and Esc. Used twice: date picker and Move target. Not drawn in the mockup; stays.
- `TimelineView.tsx` (303 lines): hour grid of `LogEntry`s, active-session exclusion, hatched active block, red now-line (`:260-268`), Unscheduled section; `#` prefixes at `:188`, `:223`, `:289`; `rounded-lg` blocks. Logic identical in shape to `TimerDayTimeline`, which Phase 1 restyled (amber `NOW hh:mm` tag, `rounded-[2px]` blocks).
- `AddEntryModal.tsx`, `TemplateManagerModal.tsx` (+ inner `EditTemplateModal`), `EndDayModal.tsx`, `CalendarPopover.tsx` are modals the mockup does not draw → kept, trivially re-tokenised at most. `TemplateManagerModal.tsx:3` imports `AddTemplateModal` but never renders it (`:166` renders `EditTemplateModal`); `DailyLog/QuickLogBar.tsx` has zero importers; `shared/TimelineItem.tsx` is imported by `DailyLog.tsx` and by the dead `Timer/SessionHistory.tsx` only.
- Data available for the mockup's new panels: `list_items` with `column='today'` across lists (`listsStore.getTodayItemsAllLists`, `:159-163`), effective id = `list.task_id || item.task_id` (`boardLogic.effectiveTaskId`, §5.3); calendar proposals for any date via `syncCalendarProposals(date)` + `getCalendarProposals(date)`; the saved ritual via `dashboardAPI.getShutdownRitual`. Nothing exists for "Carried 3×" (no carry history, inventory §3) or for "2 slots" (no caps, owner rule).
- Raycast reads `calendar_proposals` with `SELECT *` (`drip-raycast/src/lib/db.ts:158`); additive columns are safe.
- E2E (`e2e/smoke.mjs:285-287`) only screenshots `review` after clicking the rail item, and (`:295-297`) checks `REVIEW DAY →` lands on Review. Guard (`e2e/db-guard.mjs`): `shutdown_rituals` / `daily_intentions` are `CONTENT_TABLES` (`:30`, changes are restored and **reported**, not violations); entry-table **updates** (`marked_to_log`, `billable`, `task_id`, `accepted`, `dismissed`, `comment`, `date`) are not snapshotted at all — only inserts (`:140-171`) and the logged columns (`:255-262`) are.

---

## 1. Goal and scope

Goal: replace the Daily Log header, control bar, entry list and end-of-day entry points with the Review screen from the mockup, preserving every feature of §1.4 exactly, on the Phase 1/2 language (hairlines, `rounded-[2px]`, `.now-label`, `KeyButton`, `Pill`), and make the logging path visibly safe and testable.

In scope: `DailyLog.tsx` (orchestrator, rewritten JSX), a new header, the entries table with inline edit + hover actions + footer, a toolbar for the controls the mockup omits, the `Today's 3` section, the `Tomorrow` aside with the reflection draft and `End day`, per-entry log errors, `TimelineView` re-token, store plumbing (R1, R7), pure `reviewLogic.ts`, unit tests, e2e + guard.

Out of scope (untouched files): `electron/main.ts` `post-time-entry` / `get-issue`, `src/services/api.ts`, `AddEntryModal`, `TemplateManagerModal` internals, `CalendarPopover` internals, `EndDayModal` internals except one optional prop (R3), `TaskIdInput`, `BillableToggle`, `Timer/*` except the one-line `NowAside` fix (R1), Plan, Progress, Settings, overlays, Raycast. No schema change except the additive `calendar_proposals.billable` column (R7). No ⌘K, no carry counts, no caps, no weekly review.

---

## 2. Mockup → component mapping

| Mockup region (`Review.dc.html`) | Component | Data | Notes |
|---|---|---|---|
| Rail (`:20-41`) | `Layout/Rail.tsx` | – | done in Phase 1; Review active for `daily-log` |
| Header 52px: `Review` + `‹ Fri 25 Sep ›` (`:44-52`) | `DailyLog/ReviewHeader.tsx` (new) | `selectedDate` | `Previous day` / `Next day` icon keys (26px, `aria-label` as mockup); the date label is a button that opens `CalendarPopover` (kept, R11); a `Sync calendar` icon key (SVG, no emoji) beside it with the spinner state and `title` `Syncing calendar...` / `Sync calendar` kept. Label format `Fri 25 Sep`, with a muted `· Today` suffix on today (R20) |
| Header right: `5h 40m tracked · 4h 25m billable · 3 to log` (`:53-57`) | `ReviewHeader` right slot | `reviewLogic.dayStats(entries)` | `tracked` = today's `totalDuration` (non-break, merged view), `billable` = sum of non-break rows with `billable !== false` (new), `to log` = `markedCount` (amber); `Nm break` (emerald) and `N logged` (emerald) appended only when > 0 (preserved from `:387-403`). No caps |
| `Today's 3` section (`:64-101`): id pill · title · `Carried 3×` · outcome group Done / Carry / To week / Drop | `DailyLog/TodaysThree.tsx` (new) | `listsStore.getTodayItemsAllLists()`, `lists` | Rows = today-column items across lists, `effectiveTaskId` pill (muted when done) or `No task ID`, title; outcome group = `role=group aria-label="Outcome"` with four `Pill`s (R2): `Done` pressed ⇔ `completed===1` (→ `updateItem {completed:1}` / back to `0`), `Carry` pressed ⇔ open (no write), `To week` → `moveItem(id,'this_week',order)`, `Drop` → `confirm` + `deleteItem`. Heading `Today's 3` → `Today` + count (no caps); subtitle `Carry-overs stay in Today` (R2). `Carried 3×` dropped (no data). Section hidden when there are no today items |
| `Time entries` section (`:103-161`): 6-col grid header `Time · Dur · Task · Comment · Billable · Log` | `DailyLog/EntriesTable.tsx` (new) | `mergedEntries` | `section aria-label="Time entries"`, `border border-drip-elevated rounded-[2px]`; a 40px toolbar row above the column header hosts the controls the mockup omits (R10); grid gains a 7th `88px` actions column |
| Entry row (`:108-133`): time · dur · dot + id · comment · `Billable` pill · checkbox | `DailyLog/EntryRow.tsx` (rewritten) | `MergedEntry` | 48px row, `border-b border-drip-elevated`. Time mono `HH:mm` or `--:--` (unscheduled, as `TimelineItem` did); Dur mono `formatMinutes`; Task = 6px type dot (amber pomodoro/adhoc, blue calendar, emerald break) + id pill (mono amber, no `#`, cached title as `title=` tooltip via `getCachedTask`) or `Assign task` dashed key (R8); Comment = title, then `· comment` muted when both exist and differ (R5), `N sessions` badge for merged rows; Billable = `Pill` `aria-pressed` toggling `updateEntry(id,{billable})` directly (R7), static muted `Billable` / `Not billable` on logged rows; Log = checkbox `aria-label="Log this entry"` (`markedToLog`), `✓` on logged rows (`aria-label="Logged"`), disabled checkbox `aria-label="Log this entry (needs accepting)"` on proposals; hover actions (7th column, `.row-actions`) = Accept · Dismiss (proposal) / Edit · Move · Delete (others, not logged, not break) |
| Proposal row tint + `Assign task` dashed button + disabled checkbox (`:135-142`) | `EntryRow` proposal state | `isProposal` | `bg-focus/[0.04]`; `Assign task` opens the inline editor with the task field focused; saving a proposal with a task id calls `acceptCalendarProposal(id, taskId)` (accept + assign in one, R8); Accept without a task and Dismiss stay as hover actions |
| Logged row, muted, green check (`:144-151`) | `EntryRow` logged state | `logged` | `text-txt-muted`, static billable label, `✓` + tooltip `Logged to Easy Project` (string kept as the `title`), no actions |
| Footer 60px: `3 selected · 1h 45m · 1 needs a task` + `+ Entry` + `Log 3 to Easy8` (`:154-160`) | `EntriesTable` footer | `reviewLogic.selectionSummary` | `KeyButton outline` `+ Entry` → `AddEntryModal`; `KeyButton amber` `Log N to Easy8` (disabled with `title` when `N = 0` or while logging; label `Logging…` while in flight); `M need a task` counts marked rows without an id (R9) |
| Aside `Tomorrow · Mon 28 Sep` (`:164-165`) | `DailyLog/TomorrowAside.tsx` (new) | `reviewLogic.nextWorkday(selectedDate)` | 320px (280 under `wide:`), `border-l border-drip-elevated`; date = next Mon–Fri day (R4) |
| `Starts in Today` + carry-over card + `2 slots — pick in the morning` (`:167-173`) | `TomorrowAside` | open today-column items | Rows mirror `TodaysThree` open items (id pill + title); `2 slots` dropped (no caps); empty → `Nothing carried over` |
| `Calendar · 3 meetings · 4h 20m free` (`:175-177`) | `TomorrowAside` | `getCalendarProposals(tomorrow)` after `syncCalendarProposals(tomorrow)` | `N meetings · Xh Ym` and `Xh Ym free of 6h` = `max(0, DAY_TARGET_MINUTES − meetingMinutes)` (R4); non-dismissed proposals count |
| `One line on today` textarea (`:179-181`) | `TomorrowAside` | local draft | Draft lives in `DailyLog` state and is handed to `EndDayModal` as `initialReflection` (R3); when the day is locked it shows the saved `reflection` read-only (R15) |
| `End day` (`:183`) | `TomorrowAside` | `isDayLocked` | `KeyButton amber` full width → opens `EndDayModal` (unchanged ritual); replaced by a `Day ended` label when locked (End Day hidden today, `ControlBar.tsx:93-101`) |

Not in the mockup, kept (R10): `List | Timeline` joined control, `Group by task` pill (list view only), `Select all` / `Unselect all`, `Move to…` (when marked), `Templates`. Timeline mode renders the restyled `TimelineView` inside the section body instead of the rows.

---

## 3. Component and file plan

### 3.1 Tokens

No new colours. Reuse `drip.elevated` / `drip.border`, `focus/30`, `break`, `blue-500` (calendar, as `TimerDayTimeline`), `alert` (errors), `.now-label`, `KeyButton`, `Pill` (exported from `Plan/PlanSubheader.tsx`; move `Pill` to `src/components/shared/Pill.tsx` and re-export from `PlanSubheader` so Plan imports do not change). `index.css`: add `.row-actions` with the same rule as `.plan-card-actions` (hover + `focus-within`, `pointer-events` gated) — a second selector on the existing block, no new behaviour.

### 3.2 Store and data plumbing

| File | Change |
|---|---|
| `src/stores/logStore.ts` | (R1) `partialize` keeps `viewMode` only; `selectedDate` still initialises to today. (R7) `loadDay` maps `billable: p.billable !== 0` for calendar rows; `updateEntry` calendar branch writes `billable` when present (`'billable' in changes`), and only the fields present (same gating as the pomodoro/adhoc branches, fixes the `title: undefined` clobber risk at `:224`). `LogEntry` unchanged. New `logErrors: Record<string, string>` is **not** store state (component state, §3.4). |
| `src/services/db.ts` | (R7) migration `ALTER TABLE calendar_proposals ADD COLUMN billable INTEGER DEFAULT 1` guarded by `PRAGMA table_info` like the `start_time` / `logged` migrations; `updateCalendarProposal` already writes arbitrary columns. |
| `src/types/index.ts` | `CalendarProposal.billable: 0 \| 1` (optional on read for old rows). |
| `src/components/Timer/NowAside.tsx` | (R1) `openReview` → `useLogStore.getState().setSelectedDate(today)` (which loads the day) instead of `loadDay(today)`. One line; `Timer.test` aside case updated to assert `selectedDate`. |
| `src/components/DailyLog/EndDayModal.tsx` | (R3) optional prop `initialReflection?: string` seeding the Reflection textarea (`useState(initialReflection ?? '')`). Nothing else. |
| `src/test/setup.ts` | `logAPI` stubs gain `updateSession`, `deleteSession`, `addAdhocEntry → 'new-adhoc'`, `updateAdhocEntry`, `deleteAdhocEntry`, `updateCalendarProposal`, `acceptCalendarProposal`, `dismissCalendarProposal`, `getTemplates → []`, `cacheTask`; `timerAPI` gains `postTimeEntry → 1001`, `openExternal`, `onCalendarFeedUpdated → () => {}`, `fetchCalendarFeed → { data:'', fetchedAt:0, fromCache:true }`; `dashboardAPI` gains `isDayLocked → false`, `getShutdownRitual → null`, `saveShutdownRitual`, `unlockDay`, `computeWeeklySummary`, `getShutdownReflectionsInRange → []`. `globalThis.fetch = vi.fn(() => { throw new Error('network call in test') })` installed in `beforeEach` so any accidental network path fails loudly. |

### 3.3 Pure logic module `src/components/DailyLog/reviewLogic.ts` (new, fully unit-tested)

- `dayStats(entries: MergedEntry[])` → `{ trackedMinutes, billableMinutes, breakMinutes, markedCount, loggedCount, toggleableCount, allSelected }` (the `useMemo` at `DailyLog.tsx:310-323` plus `billableMinutes`; `toggleableCount` keeps its rule `!logged && !isProposal && source !== 'break'`).
- `selectionSummary(entries)` → `{ selectedCount, selectedMinutes, needsTaskCount }` over `markedToLog && !logged && source !== 'break'`; `needsTaskCount` = those with `!taskId` (R9).
- `dateLabel(date: string, today: string)` → `{ text: 'Fri 25 Sep', isToday }` (R20). Parses `YYYY-MM-DD` as local (no `new Date(str)` UTC shift).
- `shiftDate(date, days)` → `YYYY-MM-DD`, local arithmetic (replaces `DailyLog.tsx:110-114`, which goes through `toISOString` and can skip/duplicate a day around midnight in non-UTC zones; behaviour is the same on the dates that matter, and tested).
- `nextWorkday(date)` → next Mon–Fri date string (R4); `tomorrowLabel(date)` → `Mon 28 Sep`.
- `tomorrowCalendar(proposals)` → `{ meetings, meetingMinutes, freeMinutes }` with `freeMinutes = max(0, DAY_TARGET_MINUTES − meetingMinutes)`, counting `dismissed === 0`.
- `rowModel(entry: MergedEntry)` → `{ kind: 'break'|'proposal'|'logged'|'open', dotClass, timeText, durText, primaryText, secondaryText, canToggle, canEdit, canMove, canDelete, canAcceptDismiss, billableInteractive }` — the display rules of `EntryRow.tsx:151-284` and the mockup in one testable place. `primaryText` = `title`; `secondaryText` = `comment` when it differs from `title` (R5); breaks show `Break` only.
- `buildEPLink(date)` moved verbatim from `DailyLog.tsx:64-72`.
- `errorHint(message)` → `{ kind: '401'|'404'|'422'|'server'|'other', action?: 'settings' }` from the strings `main.ts` produces (`Invalid API key (401)`, `not found (404)`, `Validation error:`, `API error: 5xx`) plus `API not configured` → `settings` (R18).
- `formatTimeOfDay(iso | null)` → `HH:mm` / `--:--` (from `TimelineItem.tsx:18-25`, 24h, local).

### 3.4 Components

| File | Status | Responsibility |
|---|---|---|
| `src/components/DailyLog/DailyLog.tsx` | rewritten JSX, handlers kept | Orchestrator. Keeps every effect and handler of today's file (`loadDay` on date change `:85-89`, feed-updated listener `:93-99`, lock check `:101-108`, `handleAcceptProposal` / `Dismiss` `:120-128`, merged toggle/update/delete `:130-194` incl. the `confirm` text, stable refs `:196-219`, `handleMoveConfirm` `:221-236`, `handleLogSelected` `:238-259`, `handleSyncCalendar` `:261-275`, `handleEndDay*` `:277-288`). New prop `onNavigate?: (v: ViewId) => void` (R18; `App.tsx:67` passes `setCurrentView`). New state: `logErrors: Record<string,string>` filled from `result.errors` after `logSelected` and cleared per row on the next attempt / edit; `reflectionDraft: string`; `apiHint: 'settings' \| null` for the 401 banner. Layout: `flex flex-col h-full` → `ReviewHeader` → `flex flex-1 min-h-0` → main column `p-7 gap-5 flex flex-col overflow-hidden` (`TodaysThree` + `EntriesTable`) + `TomorrowAside`. Below `wide:` the aside is 280px (Q8 precedent). Empty day: the table body shows `No entries for this day` + `Add your first entry` (strings kept). Loading: `Loading entries...` kept. |
| `src/components/DailyLog/ReviewHeader.tsx` | new | 52px, `border-b border-drip-elevated`, drag region like `PlanHeader` (controls `no-drag`). Props: `date`, `onPrev`, `onNext`, `onPickDate`, `onSync`, `isSyncing`, `stats`. Left: `h1 Review` (15px/500) + `‹` (`aria-label="Previous day"`) + date button (13px, opens `CalendarPopover` anchored below, unchanged component) + `›` (`aria-label="Next day"`) + sync icon key. Right: mono values + muted labels per §2. |
| `src/components/DailyLog/TodaysThree.tsx` | new | `section aria-label="Today"` `border border-focus/30 rounded-[2px] p-3.5`; `.now-label text-focus` `Today` + count; muted subtitle `Carry-overs stay in Today`. Rows 48px (`border-t border-drip-elevated` between): id pill (`TaskIdBadge plain`, muted + strikethrough title when done) or `No task ID`, title (14px, truncate, `title=`), outcome `role=group aria-label="Outcome"` of four `Pill`s per §2. Mount: `loadLists()` + `loadItems()` if the store is empty (same calls Plan makes). Hidden when there are no today items. |
| `src/components/DailyLog/EntriesTable.tsx` | new (replaces `ControlBar.tsx` + the list/timeline switch in `DailyLog.tsx:458-484`) | `section aria-label="Time entries"` `flex-1 min-h-0 flex flex-col border border-drip-elevated rounded-[2px] overflow-hidden`. **Toolbar** (40px, `border-b border-drip-elevated`, `px-4`): left = joined `List \| Timeline` (`aria-pressed`, `now-label`, same markup as `NowAside` tabs) + `Group by task` `Pill` (list view only, `showGroupToggle` rule kept); right = `Select all` / `Unselect all` text key (when `toggleableCount > 0`), `Move to…` ghost key (when `markedCount > 0`; opens the Move `CalendarPopover` anchored to the button), `Templates` ghost key. **Column header** (38px, `.now-label text-txt-muted`, grid `52px 44px 150px minmax(0,1fr) 84px 28px 88px`, `gap-3 px-4`): Time · Dur · Task · Comment · Billable · Log · (blank). **Body** `flex-1 overflow-y-auto`: `EntryRow`s (work rows then break rows, as `workEntries` / `breakEntries` today, breaks muted), or `TimelineView` in timeline mode, or the empty state. **Footer** (60px, `border-t border-drip-elevated`, `px-4`): summary text + `+ Entry` + `Log N to Easy8`. |
| `src/components/DailyLog/EntryRow.tsx` | rewritten | Grid row per §2, `group` for `.row-actions`. Display mode from `rowModel`. **Edit mode** (kept, restyled): the row expands to a 2-row editor under the grid cells (`bg-focus/5 border-y border-focus/20`): `TaskIdInput` (unchanged component) · title · duration (number) / comment · `BillableToggle` · `Save` (`KeyButton amber sm`) · `Cancel` (`KeyButton ghost sm`); `handleTaskSelect` calendar rule kept (`:33-44`); Save → `onUpdate(id, {taskId,title,comment,durationMinutes,billable})` (`:46-55`); for a **proposal** Save with a non-empty task id → `onAssignTask(id, taskId)` → `acceptCalendarProposal(id, taskId)` + reload (R8). Props: today's plus `onAssignTask`, `onToggleBillable`, `error?: string`. The `memo` comparator gains `error`. Inline error: a 24px `text-alert` line under the row (`role=alert`) with the message and, for `errorHint === 'settings'`, an `Open Settings` key (R18). Break rows: `~` glyph replaced by the emerald dot, no checkbox, `Break` as primary text, dur only, no actions (as today). |
| `src/components/DailyLog/TimelineView.tsx` | restyled only | `rounded-[2px]`, `border-drip-elevated` hairlines, no `#` (`:188`, `:223`, `:289`), red now-line → amber `NOW hh:mm` tag (Phase 1 pattern, copied from `TimerDayTimeline`), block colours per the design-system table. No logic change. |
| `src/components/DailyLog/TomorrowAside.tsx` | new | `aside aria-label="Tomorrow"` per §2. Props: `date` (selected), `todayItems`, `lists`, `proposals` (tomorrow), `reflection`, `onReflectionChange`, `locked`, `savedReflection`, `onEndDay`. Tomorrow proposals are loaded by `DailyLog` (`syncCalendarProposals(tomorrow)` then `getCalendarProposals(tomorrow)`) on date change; failures leave the calendar line at `Calendar unavailable`. |
| `src/components/DailyLog/ControlBar.tsx`, `ViewToggle.tsx`, `QuickLogBar.tsx` | deleted | In the commit that lands `EntriesTable` (§5 step 4). `QuickLogBar` has no importers (inventory §1.10). |
| `src/components/shared/TimelineItem.tsx`, `src/components/Timer/SessionHistory.tsx` | deleted (R17) | Cleanup commit; `SessionHistory` is the only other importer and is dead (§1.10). Deleting both keeps the tsc count from rising. |
| `src/components/shared/TaskDisplay.tsx` | deleted (R17) | Only `EntryRow` imports it; the id pill + `getCachedTask` tooltip replaces it. |
| `src/components/DailyLog/TemplateManagerModal.tsx` | one-line change | drop the unused `AddTemplateModal` import (`:3`); `AddTemplateModal.tsx` deleted in cleanup (R17). |
| `src/components/DailyLog/AddEntryModal.tsx`, `EndDayModal.tsx`, `CalendarPopover.tsx`, `TemplateManagerModal.tsx` | re-token only | `rounded-2xl/xl/lg` → `rounded-[2px]`, `shadow-glass` kept (modal surface), emoji section prefixes in `EndDayModal` (`⚡ 📊 💭 📝 ✨`) removed (rule 6), `#` on the task chips removed. Strings and controls unchanged. |
| `src/App.tsx` | one line | `<DailyLog onNavigate={setCurrentView} />`. |
| `src/App.test.tsx` | unchanged | the `DailyLog` mock still renders `DailyLogView`. |

### 3.5 State-by-state spec

| Element | Open day, entries | Open day, no entries | Locked day (ritual saved) | Timeline mode | Group by task |
|---|---|---|---|---|---|
| Header stats | tracked · billable · to log (+ break, logged when > 0) | `0m tracked · 0m billable` | same as open | same | computed on merged rows (as today) |
| Today section | today items + outcomes | same (independent of entries) | same | same | same |
| Toolbar | List/Timeline · Group by task · Select all · Move to… (marked) · Templates | List/Timeline · Templates | same as open | Group pill hidden | pill pressed, `Unselect all` semantics unchanged |
| Body | rows: open / proposal / logged / break | `No entries for this day` + `Add your first entry` | rows, all still editable (lock only hides End day, as today) | `TimelineView` | merged rows with `N sessions` badge, merged handlers |
| Footer | `N selected · Xh Ym · M need a task` · `+ Entry` · `Log N to Easy8` | `0 selected` · `+ Entry` · `Log to Easy8` disabled | same as open | same | counts over merged rows |
| Aside | Tomorrow date · Starts in Today · Calendar · reflection textarea · `End day` | same | `Day ended` + saved reflection read-only (R15), no button | same | same |
| Log errors | per-row `role=alert` lines + `Failed to log N entries` notification (kept) + 401 banner with `Open Settings` | – | same | rows not shown; banner still | on the merged row (first source error) |

---

## 4. Parity table

`Verified by` names the test that fails if the feature regresses; `e2e` means the smoke also exercises it read-only.

| Inventory item (§1.4 unless noted) | Old location | New home | Verified by |
|---|---|---|---|
| Header `←` / date button / `→`; date button opens `CalendarPopover`; Esc closes | `DailyLog.tsx:333-382` | `ReviewHeader` `Previous day` / `Next day` / date button; `CalendarPopover` unchanged | `DailyLog.test` "prev/next call setSelectedDate with ±1 day", "date button opens the month grid, Esc closes"; e2e `review-date-popover` |
| `🔄` Force calendar sync | `:261-275`, `:365-375` | header sync icon key (`aria-label="Sync calendar"`), spinner, notification strings kept | `DailyLog.test` "Sync calls forceSyncCalendar then loadDay(date,true)"; e2e never clicks it |
| Stats subtitle Total / break / to log / logged | `:384-405` | header right (`tracked` + new `billable`; break / logged when > 0) | `reviewLogic.test` `dayStats`; `DailyLog.test` header text |
| Empty state `Add your first entry` | `:414-423` | table body empty state → `AddEntryModal` | `DailyLog.test` "empty day shows the CTA and opens AddEntryModal" |
| ControlBar: `ViewToggle` List/Timeline (persisted `viewMode`) | `ControlBar.tsx:35`, `ViewToggle.tsx` | toolbar joined control, `aria-pressed` | `DailyLog.test` "Timeline renders TimelineView (mocked) and persists viewMode"; e2e `review-timeline` |
| `Move to…` + `Log N Items →` when marked | `ControlBar.tsx:38-56` | toolbar `Move to…` (when marked) + footer `Log N to Easy8` | `DailyLog.test` "Move to… hidden at 0 marked, opens the popover when marked"; "Log button disabled at 0, label `Log 2 to Easy8`" |
| `+ Add`, `Templates` | `:62-76` | footer `+ Entry`, toolbar `Templates` | `DailyLog.test` "opens AddEntryModal / TemplateManagerModal (mocked)"; e2e opens + cancels both |
| `Select / Unselect All` | `:79-87` | toolbar text key (`toggleableCount > 0`) | `DailyLog.test` → `toggleSelectAll`; `logStore.test` "toggleSelectAll marks all toggleable, persists adhoc only" |
| `🌙 End Day` hidden when locked | `:93-101` | aside `End day` key / `Day ended` | `DailyLog.test` "locked day hides End day and shows Day ended"; e2e opens the modal and cancels only |
| `⊞ Group by Task / ⊟ Show Flat` (list view only) | `:104-111` | toolbar `Group by task` `Pill` | `DailyLog.test` "merged row shows `2 sessions`; toggle on merged row marks both sources" |
| Move calendar popover (single + bulk) | `DailyLog.tsx:214-236, 448-456` | row `Move` hover action (single) + toolbar `Move to…` (bulk), same `handleMoveConfirm` + notification strings | `DailyLog.test` "row Move → moveEntries(date,[id])", "bulk → moveEntries(date, undefined)"; `logStore.test` `moveEntries` rewrites `start_at` date part |
| Log selected → Easy Project (getIssue → POST → mark logged with `server_entry_id`) | `:238-259`, `logStore.logSelected` | footer `Log N to Easy8` → unchanged `logSelected` | `logStore.test` "logSelected: getIssue + postTimeEntry via IPC only, fetch never called; marks session/adhoc/calendar logged" (§6.1 safety block); `DailyLog.test` "success toast with count" |
| 401 / 404 / 422 / 5xx per-entry handling | `main.ts:919-933` (strings), UI = count notification only | per-row `role=alert` + notification kept + 401 `Open Settings` (R18) | `logStore.test` error matrix; `DailyLog.test` "row error rendered; 401 shows Open Settings → onNavigate('settings')" |
| Success toast `View in Easy Project →` (`buildEPLink`) | `:514-530`, `:64-72` | toast kept (re-tokenised), `reviewLogic.buildEPLink` | `reviewLogic.test` link params; `DailyLog.test` "toast link calls openExternal with the EP URL" |
| Group-by-task merge with merged toggle / update / delete (confirm) | `:130-194`, `mergeEntries.ts` | unchanged handlers behind the toolbar pill | `DailyLog.test` "merged delete confirms with the sessions count and deletes each source" (`window.confirm` spied) |
| Timeline view (hour grid, active-block exclusion, Unscheduled) | `TimelineView.tsx` | restyled, logic untouched | `TimelineView.test` "renders hour labels, one block per scheduled entry, Unscheduled section; no `#` in ids" |
| List rows: checkbox / `✓` / `-` / `~`; type badges; `N sessions`; comment; TaskDisplay; billable; actions | `EntryRow.tsx` | grid row per §2 (dot replaces badge, tooltip title replaces the second line) | `EntryRow.test` (12 cases, §6.1) |
| Inline edit: TaskIdInput, title, duration, comment, BillableToggle, Save/Cancel | `EntryRow.tsx:82-149` | edit mode kept (restyled) | `EntryRow.test` "Edit → Save calls onUpdate with the five fields", "Cancel restores", "calendar task select copies the title to the comment" |
| Delete blocked for logged entries; calendar delete = dismiss | `logStore.deleteEntry` | unchanged; logged rows have no Delete action | `logStore.test` "deleteEntry refuses logged (notification), dismisses calendar" |
| Day lock after End Day | `:101-108`, `shutdownStore` | `DailyLog` lock check unchanged; aside locked state | `DailyLog.test` locked case |
| Calendar feed background updates re-load the day | `:93-99` | unchanged effect | `DailyLog.test` "onCalendarFeedUpdated callback invalidates and reloads" |
| AddEntryModal (templates chips, title, start time, presets, task id + billable prefill, comment, billable) | `AddEntryModal.tsx` | unchanged component, opened from `+ Entry` and the empty state; `handleAddEntry` kept | untouched; `DailyLog.test` asserts `addManualEntry` receives `startTime` |
| EndDayModal (Today's Plan, Review stats, Reflection, Notes, Tomorrow ×3; ritual, weekly summary, intentions) | `EndDayModal.tsx` | unchanged, opened from the aside; `initialReflection` prefilled from the draft (R3) | `DailyLog.test` "End day opens the modal (mocked) with initialReflection = draft"; modal internals untouched; `EndDayModal.test` (new, 3 cases: prefill, submit calls saveRitual + computeWeeklySummary + addIntention(tomorrow), Cancel) |
| TemplateManagerModal (+ EditTemplateModal) | unchanged | toolbar `Templates` | untouched |
| Calendar proposals sync (ICS, RRULE, TTL) | `calendar.ts`, `loadDay` | unchanged; additionally called for `tomorrow` (aside) | `DailyLog.test` "loads tomorrow's proposals after the day" (mocked `syncCalendarProposals`) |
| Accept / Dismiss proposals | `EntryRow.tsx:231-245`, `DailyLog.tsx:120-128` | hover actions on proposal rows; `Assign task` = accept with id (R8) | `EntryRow.test` "proposal shows Accept/Dismiss, disabled checkbox"; `DailyLog.test` "Assign task save → acceptCalendarProposal(id,'123') then loadDay(date,true)" |
| Toggle `markedToLog` (adhoc persisted, others UI-only) | `logStore.toggleLogMark` | row checkbox | `logStore.test` "toggleLogMark persists marked_to_log for adhoc only, refuses logged/proposal" |
| `✓ Billable / Not billable` display; billable edit | `EntryRow.tsx:217-224`, edit mode | live `Pill` on open rows (R7), static label on logged rows; still in edit mode | `EntryRow.test` "billable pill → onToggleBillable"; `logStore.test` "updateEntry writes billable for session, adhoc and calendar (R7)" |
| §1.9 TaskIdInput, BillableToggle | unchanged | unchanged | untouched |
| §1.1 boot `loadDay(selectedDate)`; persisted `selectedDate` | `App.tsx:35-39`, `logStore.ts:941` | `selectedDate` no longer persisted (R1); boot loads today | `logStore.test` "partialize excludes selectedDate" |
| §1.3 Now aside `Review day →` | `NowAside.tsx:33-37` | `setSelectedDate(today)` (R1) | `Timer.test` aside case (updated) |
| §2 "Stats subtitle → Review header; break/logged dropped in mockup" | – | kept when > 0 | `DailyLog.test` |
| §2 "ViewToggle / Timeline NO HOME" | – | toolbar (R10) | `DailyLog.test` |
| §2 "Group by Task NO HOME" | – | toolbar pill (R10) | `DailyLog.test` |
| §2 "Select all not drawn" | – | toolbar (R10) | `DailyLog.test` |
| §2 "Move to… NO HOME" | – | toolbar + row action (R10) | `DailyLog.test` |
| §2 "Full inline edit not drawn; keep" | – | edit mode | `EntryRow.test` |
| §2 "Accept/Dismiss not drawn" | – | hover actions (R8) | `EntryRow.test` |
| §2 "Break rows / type badges not drawn" | – | break rows kept muted; type = dot colour (R6) | `EntryRow.test` "break row: emerald dot, no checkbox, no actions" |
| §2 "Delete not drawn" | – | hover action | `EntryRow.test` |
| §2 "Templates NO HOME" | – | toolbar (R10) | `DailyLog.test` |
| §2 "End Day: mockup collapses Reflection + Notes; day lock not drawn" | – | modal kept, aside prefills Reflection (R3); lock → `Day ended` (R15) | `DailyLog.test`, `EndDayModal.test` |
| §2 "CalendarPopover NO HOME drawn — keep as popover" | – | kept (R11) | `DailyLog.test` |
| §2 "Today's 3 / carry-overs / outcome per item" (§3 rows 2–4) | new | `TodaysThree` on the today column, no carry count (R2) | `TodaysThree.test` |
| §2 "Tomorrow panel: Starts in Today, Calendar free time" (§3) | new | `TomorrowAside` (R4) | `TomorrowAside.test`, `reviewLogic.test` |
| §2 "Review header `4h 25m billable`" (§3) | new | `dayStats.billableMinutes` | `reviewLogic.test` |
| §2 "`Assign task` dashed button; log checkbox disabled without task" (§3) | new | `Assign task` on id-less rows; checkbox disabled only on proposals (R9) | `EntryRow.test` |

Nothing from §1.4 is dropped. String changes: `Daily Log` → `Review`; `Log N Items →` → `Log N to Easy8`; `+ Add` → `+ Entry`; `Move to...` → `Move to…`; `End Day` → `End day`; `Group by Task / Show Flat` → `Group by task` (pressed state); `Select All / Unselect All` → `Select all / Unselect all`; `Total:` → `tracked`; `Today` / `Yesterday` date words → `Fri 25 Sep · Today` (R20). Notification strings, modal strings and `confirm` texts are unchanged.

---

## 5. Build sequence

One commit per step; every step ends with `npm test` green (count never below the previous step), `npx tsc --noEmit | grep -c "error TS"` ≤ 39, `npx vite build` OK. New files must be tsc-clean; deletions may lower the count, never raise it. No step touches `electron/main.ts` `post-time-entry` / `get-issue` or `src/services/api.ts`.

1. **Plumbing + store tests.** `logStore` `partialize` (R1), calendar `billable` (R7: `db.ts` migration, type, `loadDay` / `updateEntry`), `NowAside` `setSelectedDate` (R1), `EndDayModal.initialReflection` (R3), `setup.ts` stubs + the `fetch` trap. New `src/stores/logStore.test.ts` including the **safety block** (§6.1). `Timer.test` aside case updated. No UI change. — `feat(review): log store tests incl. IPC-only posting, calendar billable, review opens on today`
2. **reviewLogic.** `reviewLogic.ts` + `reviewLogic.test.ts`. — `feat(review): pure review logic`
3. **Header + shell.** `ReviewHeader.tsx` (+ test), `Pill` moved to `shared/`, `DailyLog.tsx` renders the new header and the `onNavigate` prop; the old `ControlBar` / list still render underneath for this one commit. `App.tsx` passes `onNavigate`. — `feat(review): header with date nav, sync key and day stats`
4. **Entries table.** `EntriesTable.tsx`, `EntryRow.tsx` rewrite (display + edit + hover actions + `Assign task`), toolbar, footer, `TimelineView` re-token, `.row-actions`; `git rm` `ControlBar.tsx` `ViewToggle.tsx` `QuickLogBar.tsx`. `EntryRow.test.tsx`, `TimelineView.test.tsx`, `DailyLog.test.tsx` table cases. From here nothing is duplicated and nothing is lost. — `feat(review): entries table, inline edit, hover actions, footer`
5. **Log path UI.** Per-row `logErrors`, 401 banner with `Open Settings` (R18), toast re-token, `Log N to Easy8` disabled states. `DailyLog.test` error cases. — `feat(review): per-entry log errors and Easy8 link`
6. **Today's 3.** `TodaysThree.tsx` + test; `DailyLog` mounts it. — `feat(review): today's tasks with outcomes`
7. **Tomorrow aside.** `TomorrowAside.tsx` + test, tomorrow proposals load, reflection draft → `EndDayModal`, locked state (R15), `EndDayModal.test.tsx`. — `feat(review): tomorrow aside and end-day hand-off`
8. **E2E + guard.** `smoke.mjs` Review walk (§7.1), guard changes (§7.2); run once with the installed app quit; attach `report.txt` + screenshots to the review. — `test(e2e): Review walk; entry-table drift and ritual guards`
9. **Cleanup + docs.** `git rm` `shared/TimelineItem.tsx`, `Timer/SessionHistory.tsx`, `shared/TaskDisplay.tsx`, `DailyLog/AddTemplateModal.tsx` (R17; grep importers first), `EndDayModal` / `AddEntryModal` / `CalendarPopover` / `TemplateManagerModal` re-token, `UI_DESIGN_SYSTEM.md` "Review tokens", `CLAUDE.md` gets no change (operational facts unchanged). — `chore(review): design-system notes and cleanup`

---

## 6. Test plan

### 6.1 Vitest / RTL

Patterns as in Phases 1–2: `useLogStore.setState({ entries, selectedDate })` for state, `window.logAPI.*` / `window.timerAPI.*` stubs from `setup.ts`, `userEvent`, `vi.mock` for heavy children (`AddEntryModal`, `TemplateManagerModal`, `EndDayModal`, `CalendarPopover`, `TimelineView` as light stubs exposing their props), `vi.spyOn(window, 'confirm')`. `syncCalendarProposals` / `forceSyncCalendar` / `getLastSyncTime` are `vi.mock`ed from `../../services/calendar` (they touch the feed and the DB). A `src/test/logFixtures.ts` helper builds `LogEntry`s: `makeEntry(kind: 'pomodoro'|'adhoc'|'calendar'|'proposal'|'break'|'logged', overrides)`.

**Safety block — `src/stores/logStore.test.ts` (new, required by the owner):**
- `logSelected` with one marked session, `timerAPI.getIssue → { taskId, title, projectId: 6562, projectName }`, `timerAPI.postTimeEntry → 1001`: asserts `postTimeEntry` was called exactly once with `('https://example.test', 'test-key', { time_entry: { project_id: 6562, issue_id: 643749, user_id: 28668, activity_id: 95, hours: 0.5, spent_on: date, comments, easy_is_billable: true } })`, `globalThis.fetch` was **never** called, `updateSession` was called with `{ logged: 1, log_sent_at, server_entry_id: 1001 }`, result `{ success: 1, failed: 0 }`.
- Same for an adhoc row (`updateAdhocEntry {logged:1}`) and an accepted calendar row (`updateCalendarProposal {logged:1}`, `easy_is_billable` from the new column).
- With `window.timerAPI.postTimeEntry` deleted (simulating a missing bridge): `api.postTimeEntry` throws `Blocked: posting time entries is disabled in dev builds` (`import.meta.env.DEV` is true under Vitest), `fetch` never called, the entry is not marked logged, `result.errors[0].error` carries the message.
- Blocked-by-main simulation: `postTimeEntry` rejects with `Error('Blocked: posting time entries is disabled in dev builds')` → `failed: 1`, nothing marked.
- Error matrix: `postTimeEntry` rejects with `Invalid API key (401)` / `Issue not found (404)` / `Validation error: hours is invalid` / `API error: 500` → each becomes `errors[].error`, no mark; a mix of one success + one 404 → `{ success:1, failed:1 }` and only the successful row marked.
- `getIssue` failure (`API not configured`) → no `postTimeEntry` call at all.
- Rows without `taskId` → `Task ID is required`, no IPC call; `durationMinutes: 0` → `Duration must be greater than 0`.
- `logEntryNow`: saves the adhoc row first, then posts via IPC only, marks logged; on POST failure the row stays with `marked_to_log: 1`.

Other `logStore.test.ts` cases: `loadDay` mapping (break title `Break`, `markedToLog` rules for the three tables, calendar `billable` default when the column is missing, sort by `startTime` with nulls last); `toggleLogMark` / `toggleSelectAll`; `updateEntry` field gating per type incl. calendar `billable` (R7) and that `title` is not sent when absent; `deleteEntry` logged guard + calendar dismiss; `moveEntries` date rewrite for the three types; `addManualEntry` converts `HH:MM` to an ISO `start_time` on `selectedDate`; `partialize` excludes `selectedDate` (R1).

`src/components/DailyLog/reviewLogic.test.ts` (new, ~28 cases): `dayStats` (break excluded from tracked, billable sum ignores `billable:false` and breaks, proposals counted in tracked as today, `allSelected` rule), `selectionSummary` (needsTask counts marked id-less rows only), `dateLabel` today / other / year boundary, `shiftDate` across month + DST, `nextWorkday` Fri→Mon, Sat→Mon, Sun→Mon, Mon→Tue, `tomorrowCalendar` (dismissed excluded, free floors at 0, uses `DAY_TARGET_MINUTES` imported from `TimerDayTimeline`), `rowModel` for each kind (dot class, texts, capability flags, `secondaryText` only when comment ≠ title), `buildEPLink` params, `errorHint` for the five message shapes, `formatTimeOfDay`.

`src/components/DailyLog/EntryRow.test.tsx` (new, ~14): open pomodoro row (checkbox reflects `markedToLog`, toggling calls `onToggleLog`), id pill without `#` + `getCachedTask` tooltip, `Assign task` on id-less rows opens edit with the task field, billable pill → `onToggleBillable(id, false)`, logged row (no checkbox, `Logged` check, static label, no actions), proposal row (tint, disabled checkbox label, Accept / Dismiss → callbacks, Assign task + Save → `onAssignTask(id,'123')`), break row, merged badge `2 sessions` + Delete `title`, Edit → Save payload, Cancel restores, calendar `handleTaskSelect` comment rule, hover actions have `.row-actions`, inline error `role=alert` + `Open Settings` for 401.

`src/components/DailyLog/DailyLog.test.tsx` (new, ~26): everything in §4's "Verified by" column for `DailyLog.test`, plus: header renders `Review` + `Fri 25 Sep · Today` for today; `loadDay(selectedDate)` on mount; `Log N to Easy8` disabled at 0 and while logging; clicking it calls `logSelected` and renders the toast on success with the count, per-row errors on failure; `Open Settings` → `onNavigate('settings')`; `Move to…` visibility; `Group by task` hidden in timeline mode; `Templates` opens the manager (mocked); locked day state; tomorrow proposals requested for `nextWorkday`; reflection draft flows into `EndDayModal` (mocked, asserts `initialReflection`).

`src/components/DailyLog/TodaysThree.test.tsx` (new, ~7): hidden when no today items; rows show effective ids (list-bound id wins), `No task ID`; `Done` pressed for completed → click → `updateItem {completed:0}`; open → `Carry` pressed; `To week` → `moveItem(id,'this_week',n)`; `Drop` → `confirm` accepted → `deleteItem`, declined → nothing; no caps (7 items → 7 rows, count `7`).

`src/components/DailyLog/TomorrowAside.test.tsx` (new, ~6): label `Tomorrow · Mon 28 Sep` from a Friday; carry-over rows list open today items; `Nothing carried over`; calendar line `2 meetings · 1h 30m` + `4h 30m free of 6h`; `Calendar unavailable`; textarea change → `onReflectionChange`; `End day` → `onEndDay`; locked → `Day ended` + saved reflection, no button.

`src/components/DailyLog/TimelineView.test.tsx` (new, 3): hour labels for the dynamic range, one block per scheduled entry with the duration text, `Unscheduled` section; no `#` anywhere.

`src/components/DailyLog/EndDayModal.test.tsx` (new, 3): `initialReflection` prefilled; submit → `saveRitual(date, total, deep, tasks, reflection, notes, intentions)` + `computeWeeklySummary(monday)` + `addIntention(tomorrow, …)` each; Cancel → `onClose`.

`src/components/DailyLog/ReviewHeader.test.tsx` (new, 4): prev / next / sync callbacks, `aria-label`s, stats slot text, spinner state.

Existing tests untouched except `Timer.test` (aside case) and `TimerDayTimeline.test` (unchanged). Expected total after step 8: ≈ 203 + 20 (store) + 28 + 14 + 26 + 7 + 6 + 3 + 3 + 4 ≈ 314.

### 6.2 E2E — see §7.

---

## 7. E2E smoke and guard

### 7.1 `e2e/smoke.mjs` Review walk (replaces `:285-287`; both sizes)

Read-only by construction; every step lists the writes it can cause. **Never clicked:** any `Log this entry` checkbox, the `Billable` pill, `Assign task`, Accept, Dismiss, Edit → Save, Move (row or bulk confirm), Delete, `Select all`, any outcome pill in Today, `Sync calendar`, `Log N to Easy8`, `End day` confirm inside the modal, `Add Entry` inside the modal, `Restore`, anything inside `TemplateManagerModal` except its close. The reflection textarea is never typed into.

1. Rail `Review` → wait for `h1 Review` → assert `section[aria-label="Time entries"]` and `aside[aria-label="Tomorrow"]` exist → `review-day`. (Writes: `calendar_proposals` sync inserts for the selected day and for `nextWorkday` — safe rows, deleted by the guard as today.)
2. Assert the date label ends with `· Today` (R1 proof: Review opened on today).
3. If `section[aria-label="Today"]` exists → `review-today-section` (nothing clicked).
4. Toolbar `Timeline` → wait for the hour grid → `review-timeline` → `List`. (Writes: `localStorage` `viewMode`; restored by clicking back.)
5. `Group by task` (if present) → `review-grouped` → click again. (No writes.)
6. Hover the first open row → `review-row-hover` (actions visible). Click `Edit` on it (if present) → `review-row-edit` → `Cancel`. (No writes: Cancel restores the buffer.)
7. Date button → month grid visible → `review-date-popover` → Esc. (No writes.)
8. `Previous day` → wait for the label to change → `review-yesterday` → `Next day` → assert `· Today` again. (Writes: `calendar_proposals` sync for yesterday and its `nextWorkday`; safe rows.)
9. `+ Entry` → `AddEntryModal` visible → `review-add-entry` → `Cancel`. (No writes.)
10. `Templates` → manager visible → `review-templates` → close. (No writes: `getTemplates` is a read.)
11. `End day` (if not locked) → `EndDayModal` visible (`End Day - <date>` heading) → `review-end-day-modal` → `Cancel`. (No writes: the modal reads sessions/adhoc only; `saveRitual` fires only from its `End Day` button, which is never clicked.)
12. `review` → Insights → Settings continue as today; the `REVIEW DAY →` check (`:295-297`) additionally asserts the label ends with `· Today`.

Assertions added: no `#` in any `[data-testid="entry-task-id"]`; `Log … to Easy8` button exists and is never clicked (log a line like the `Start on` CTA); after the walk `main.log` contains no `Posting time entry to:` and no `[Safety] Blocked` (already enforced in (d)).

### 7.2 Guard changes (`e2e/db-guard.mjs`)

- **Entry-table drift becomes a violation.** New `ENTRY_TABLES = { pomodoro_sessions: ['task_id','comment','duration_minutes','billable','start_at','logged'], adhoc_entries: ['date','duration_minutes','title','task_id','comment','marked_to_log','logged','billable','start_time'], calendar_proposals: ['accepted','dismissed','task_id','comment','date','start_at','end_at','duration_minutes','logged','billable'] }`. `prepare` snapshots those columns for every existing row; `verifyAndClean` diffs pre-existing ids, restores each changed row from the backup (`ATTACH … bk`) and records `<table>: N row(s) changed during the run` as a **violation**. This is the guard that proves the Review walk never toggled, edited, accepted, dismissed, moved or billed anything. (`calendar_proposals` rows the sync itself updates: the sync only inserts new occurrences or updates `title/start_at/end_at/duration_minutes` of existing ones when the feed changed — report those four columns as `feed drift`, restore, not a violation; the other columns are violations.)
- **Ritual and intentions writes become violations.** `shutdown_rituals` and `daily_intentions` move from "restore + report" to "restore + **violation**" (`MUST_NOT_CHANGE = ['shutdown_rituals','daily_intentions']`), since the only writers are `End Day` and `SetIntentionModal` add — neither is used by the walk. `daily_summaries` / `weekly_summaries` stay report-only (`computeWeeklySummary` is only reachable from End Day, so they will not change either; if they do, the ritual violation already fires).
- `list_items` `column/order/completed` drift stays a violation (Phase 2 guard): it also covers the Today outcome pills.
- (d) unchanged: `DRIP_ALLOW_API_WRITES` absent, zero `Posting time entry to:` / `[Safety] Blocked` lines, logged rows equal to the snapshot.
- Precondition print gains: "the Review walk navigates one day back and forth (calendar sync inserts for those days are deleted), opens and cancels the Add Entry / Templates / End Day modals, and never marks, edits, logs or ends a day."

### 7.3 Unavoidable writes in the Review walk

`settings.timer_state` etc. (Now part, unchanged), `calendar_proposals` safe inserts for today / yesterday / their next workdays (deleted), `calendar-feed-cache.ics` rewrite, `localStorage` `viewMode` (restored), `list_items.archived` flips from `archiveOldCompleted` when `TodaysThree` loads items (reported, Q7). No entry-table updates, no rituals, no intentions, no time entries.

---

## 8. Risks

- **This screen can spend the user's money.** Every commit keeps `main.ts:881-885` and `api.ts:126` byte-identical (the reviewer diffs those hunks); the safety block in `logStore.test.ts` runs from step 1, before any UI exists; the `fetch` trap in `setup.ts` makes any accidental direct call fail every test file. The e2e never reaches a POST by construction, and the guard would flag it three ways (log grep, logged-row diff, entry drift).
- **`logSelected` semantics are preserved, not improved.** Rows without a task are still markable and still fail per row at log time (R9); `getIssue` is still called for every row (no `projectId` caching in `loadDay`). Flagged as follow-ups, not changed silently.
- **Calendar `billable` column (R7)** is the only schema change. Additive with a default; Raycast `SELECT *` tolerates it; old rows read as billable (today's effective behaviour). The migration follows the existing `PRAGMA table_info` pattern and is exercised on the real DB by the e2e run (the guard restores nothing for schema, so the column stays — intended, same as every prior migration).
- **`selectedDate` no longer persisted (R1).** A user relaunching mid-review of an older day lands on today; date navigation inside a session is unaffected (store state survives view switches). `NowAside` fix removes the double `loadDay`.
- **`EntryRow` rewrite** replaces a `memo` comparator; the new one must include `error` and `onAssignTask`/`onToggleBillable` identity or rows go stale. `EntryRow.test` "re-renders when error changes" covers it.
- **Tomorrow's calendar needs a second ICS sync per date change.** `syncCalendarProposals` has a 10-minute TTL and in-flight de-duplication (`calendar.ts:32`, `:342`), so the extra call is cheap; it can still insert rows for tomorrow, which the guard treats like today's.
- **`TodaysThree` shares `listsStore` with Plan.** Loading items runs `archiveOldCompleted` (Q7, reported). Outcome writes reuse `updateItem` / `moveItem` / `deleteItem`; nothing new in the store.
- **Narrow windows.** 72px rail + 280px aside at 800px leaves ~450px for the 7-column grid; below `wide:` the Comment column shrinks (`minmax(0,1fr)`) and the actions column overlays the comment's right edge (Phase 2 `52b4b51` pattern) instead of taking a fixed column. The 800×600 screenshots confirm.
- **tsc gate.** `DailyLog.tsx` and `EntryRow.tsx` may carry some of the 39 existing errors (untyped `any` handlers at `:116`, `:145`); rewriting them can only lower the count. Deleting `TimelineItem` requires deleting `SessionHistory` in the same commit (R17) or the count rises.
- **Time-zone arithmetic.** `handleDateChange` and `formatDate` use `new Date('YYYY-MM-DD')` (UTC midnight) — replaced by local parsing in `reviewLogic`; `EndDayModal`'s `tomorrow` (`:116-119`) and monday (`:104-109`) keep their code (untouched file) — noted, not fixed.

---

## 9. Owner decisions needed

Each item: what the mockup shows vs what exists, the options, and my recommendation. I will proceed on the recommendation unless told otherwise.

### Decided (owner, 2026-09-26)

- **R1** Decided: (a) stop persisting `selectedDate`; Review and `Review day →` open on today (confirmed by the owner).
- **R2** Decided: (a) rows from the Today column, no carry badge, no caps — **OVERRIDE of the Drop mapping:** `Drop` moves the item to **Backlog** (`moveItem(id,'backlog',order)`, non-destructive); it never deletes. `Done` → complete, `Carry` → leave in Today, `To week` → move to This week. No `confirm` on any outcome.
- **R3** Decided: (a) aside textarea drafts the modal's Reflection (`initialReflection`); `End day` opens the unchanged modal.
- **R4** Decided: (b) the aside shows the next workday (Mon–Fri) and the same date is passed into `EndDayModal` (`tomorrowDate` prop) so Friday's intentions land on Monday; `free = 6h − meetings` with `DAY_TARGET_MINUTES` reused (confirmed by the owner).
- **R5** Decided: (a) title primary, `· comment` muted when it differs.
- **R6** Decided: (a) break rows kept, muted, emerald dot; `Nm break` header stat kept.
- **R7** Decided: (a) additive `calendar_proposals.billable INTEGER DEFAULT 1` via an idempotent migration guarded by `PRAGMA table_info`; pill live everywhere. (`db.updateCalendarProposal` gained a `billable` field: it whitelists columns, contrary to §3.2's note.)
- **R8** Decided: (a) `Assign task` opens the inline editor; saving a proposal with an id = accept + assign.
- **R9** Decided: (a) id-less rows stay markable; footer shows `M need a task`.
- **R10** Decided: (a) 40px toolbar row at the top of the `Time entries` section.
- **R11** Decided: (a) `CalendarPopover` kept as is, re-tokenised only.
- **R12** Decided: (a) `Nm break` / `N logged` appended when > 0.
- **R13** Decided: (a) `KeyButton` md footer keys.
- **R14** Decided: (a) `Log to Easy8` rendered disabled with a `title` at 0.
- **R15** Decided: (a) `Day ended` + saved reflection read-only; no unlock.
- **R16** Decided: (a) toast kept, re-tokenised.
- **R17** Decided: (a) delete all five dead files after grepping importers.
- **R18** Decided: (a) per-row `role=alert` errors + 401 / not-configured banner with `Open Settings`.
- **R19** Decided: (a) the §7.1 walk and the §7.2 guard additions.
- **R20** Decided: (a) `Fri 25 Sep` with a muted `· Today` suffix.
- **R21** Decided: square `rounded-[2px]` radii + hairlines.

### Decided — Review v2: logging first (owner, 2026-09-29)

Mockup: canvas artboard "Review — end of day" (`mockups/Review.dc.html`, replaced on this date). Logging is the main column; closing the day is an optional aside. Where a v2 decision contradicts an R1–R21 entry, the v2 entry wins (named below).

- **R22** Decided: a row without a task is **blocked** — amber tint, dashed `+ Assign task`, checkbox disabled (`title="Needs a task"`); `isLoggable` (logStore) excludes it from `logSelected` and `toggleSelectAll`, so it is never sent and never errors. Replaces **R9**.
- **R23** Decided: break rows leave the List table (they are never logged or counted) and stay in Timeline; the `Nm break` / `N logged` header stats go. Replaces the rows half of **R6** and **R12**.
- **R24** Decided: every number comes from `reviewLogic.logSummary` over the flat entries (never merged rows): TO LOG `n · Xh Ym`, NEEDS A TASK, LOGGED `n · Xh Ym`, the filter counts, the footer. Invariant `tracked = toLog + logged`. Header right = `Xh tracked · Yh billable` (mono 11px) only.
- **R25** Decided: the Comment cell is a 34px input showing exactly what Easy8 receives (`sentComment` = comment, else title, else `Work session`); blur / Enter commits `comment`, Esc reverts. Replaces the display half of **R5**.
- **R26** Decided: the Task cell = id (amber mono) + task name (`useTaskName`); clicking it, or `+ Assign task`, opens `TaskPickerPopover` (recents, cache search, ↑↓ Enter, numeric id + Enter → cache → `get-issue`). A proposal is accepted with the picked id (**R8** kept); any other row gets `{ taskId, markedToLog: true }`. The inline Edit editor is removed: duration, task, comment and billable are all inline; an adhoc row's separate title is no longer editable (it only feeds the comment fallback).
- **R27** Decided: Billable = `BillableToggle variant="yesno"` (30px square key, `Yes` + amber dot / `No` + dim dot, `aria-pressed`); logged rows read `Yes` / `No` as text.
- **R28** Decided: Dur is a key that becomes an input; `parseDuration` reads `45`, `45m`, `1h`, `1h10`, `1h 10m`, `1:10`, `1.5h` (≤ 24h). Enter commits (an unreadable value stays open, `aria-invalid`), blur commits or reverts, Esc cancels. Read-only on logged and merged rows (`Ungroup to edit`).
- **R29** Decided: `Carried n×` = workdays since the item entered Today (`carriedDays`), shown from n ≥ 2. Additive `list_items.today_since` (local `YYYY-MM-DD`): set on entering Today (create or column write), kept while it stays, cleared on leaving (`utils/todaySince.todaySinceFor`, shared by `db.updateListItem` and the lists store's optimistic writes); the migration stamps what is in Today at rollout with that day. Refines **R2** (which had no badge).
- **R30** Decided: an unaccepted proposal with a task shows an unchecked box — checking it accepts (and so marks) it; without a task it is a blocked row whose `+ Assign task` accepts + assigns; Dismiss is its hover action (`deleteEntry` dismisses calendar rows). Proposals count under TO LOG.
- **R31** Decided: filter `All n / To log n / Logged n` (joined, active = light key), default To log, session state only; logged rows dimmed with the emerald check; footer `K logged today · show` / `hide`. The right of the filter row carries List | Timeline, `Group by task`, `Move to…`, `Templates` (**R10** moved); rows keep hover Move / Delete icons. Group by task merges after filtering, so a group never mixes logged and unlogged sessions.
- **R32** Decided: `Log N to Easy8 ↵` is the one primary key (summary bar); Enter logs and N opens `+ Add entry`, both only when no input / button / link has focus (target or active element), no Review modal or popover is open and no `[role=dialog]` exists; Enter also needs a loggable selection. Key hints only while the window has focus.
- **R33** Decided: aside `Close the day · Optional` (`CloseDayAside`, 280 / 300px): `Today · N` triage (no caps — the mockup's `Today's 3` and `2 slots free` are not built), open items as cards with a joined Done / Carry / Week / Drop (**R2** outcomes), done items collapsed to one line whose `Done` reopens; `Tomorrow · Mon 28 Sep` + one line `Starts with <id> · N meetings · Xh Ym free`; the 2-row reflection (**R3**); `End day` as `KeyButton outline` (**R15** kept). Logging never depends on it.

**R1. Review opens on the last viewed day (known quirk).** `logStore` persists `selectedDate` (`:941`), `App.tsx:35-39` loads it at boot, and `NowAside.openReview` loads today without selecting it (`:33-37`). Options: (a) stop persisting `selectedDate` (boot = today) and make `Review day →` call `setSelectedDate(today)`; the date chosen inside a session still sticks while the app runs; (b) keep persisting, only fix `NowAside`; (c) keep everything, add a `Today` shortcut in the header. **Recommend (a).** Review is the end-of-*this*-day screen; the month popover already has `Today` for the rare relaunch-mid-review case.

**R2. `Today's 3` section with Done / Carry / To week / Drop and `Carried 3×`.** Nothing records outcomes or carries; the Today column (`list_items.column='today'`) is the only "today" data (inventory §3). Options: (a) rows = today-column items across lists; outcomes map to existing store ops — `Done` ⇔ `completed`, `Carry` = leave in Today (pressed by default), `To week` = move to `this_week`, `Drop` = delete with `confirm`; no `Carried 3×` (no data), no caps (heading `Today · N`); (b) show the day's text intentions (`daily_intentions`) read-only instead; (c) drop the section. **Recommend (a).** It gives End Day a real triage step without schema; a `carried_count` column is a clean follow-up if the section proves useful.

**R3. End day: aside vs modal.** Mockup: one textarea + `End day` in the aside. Existing: `EndDayModal` with Today's Plan, Review stats, Reflection, Notes, Tomorrow's Intentions ×3, weekly summary, lock. Options: (a) aside textarea is a draft of the modal's Reflection (`initialReflection` prop); `End day` opens the unchanged modal; (b) move the whole ritual into the aside (rewrite, modal deleted); (c) aside only, drop Notes / Tomorrow intentions (loses features). **Recommend (a).** Zero feature loss, one optional prop.

**R4. Tomorrow = next calendar day or next workday; "free" definition.** Mockup: Friday → `Mon 28 Sep`, `3 meetings · 4h 20m free`. `EndDayModal` writes tomorrow's intentions to `date+1` (`:116-119`). Options: (a) aside shows the next Mon–Fri day and its meetings; `free = 6h − meetings` (`DAY_TARGET_MINUTES`, P8 precedent); `EndDayModal` unchanged (Friday intentions land on Saturday, as today); (b) same aside, and pass `nextWorkday` into `EndDayModal` so both agree (behaviour change on Fri/Sat only); (c) next calendar day everywhere. **Recommend (b).** Saturday intentions are never what a Friday review means; the modal change is one prop with a test.

**R5. Comment column vs title + comment.** Mockup shows one text per row. Existing rows show `title` and, on a second line, `comment || 'No comment'`. Options: (a) `title` as primary, `· comment` muted when it differs, full text in `title=`; `No comment` dropped; (b) two-line rows (56px) with the comment underneath; (c) comment only, title in tooltip. **Recommend (a).** Pomodoro titles already equal the comment, so most rows show one text as drawn.

**R6. Break rows.** Not drawn. Existing: `~` rows in emerald tint plus `Nm break` in the subtitle. Options: (a) keep break rows (muted, emerald dot, dur only, no controls) after the work rows and keep the `Nm break` header stat; (b) header stat only; (c) rows only. **Recommend (a)** under the preservation rule; they are visually quiet.

**R7. Billable pill on calendar rows.** Mockup: live `Billable` pill on every open row incl. a calendar event. `calendar_proposals` has no `billable` column; the edit form shows a `BillableToggle` for calendar rows that `updateEntry` silently ignores (`:221-228`), and logging posts them as billable by default. Options: (a) additive `calendar_proposals.billable INTEGER DEFAULT 1` (migration, type, `loadDay`, `updateEntry`), pill live on every open row; (b) no schema change: static `Billable` text on calendar rows and remove the inert toggle from their edit form; (c) leave the inert toggle. **Recommend (a).** Fifteen lines, Raycast-safe, and it makes the mockup's row and the existing edit form honest.

**R8. `Assign task` on a proposal and the disabled log checkbox.** Mockup: proposal row with a dashed `Assign task` and `Log this entry (needs a task)` disabled. Existing: proposals show `-`, Accept / Dismiss buttons; `acceptCalendarProposal(id, taskId?)` exists. Options: (a) `Assign task` opens the inline editor focused on the task field; saving a proposal with an id calls `acceptCalendarProposal(id, taskId)` (accept + assign); Accept (no task) and Dismiss stay as hover actions; the checkbox is disabled with `aria-label="Log this entry (needs accepting)"`; (b) `Assign task` = `TaskIdInput` inline in the cell, accept on select; (c) keep Accept/Dismiss buttons only. **Recommend (a).** One editor for every row; the labels say why the checkbox is off.

**R9. Log checkbox on id-less non-proposal rows.** Mockup disables it (`needs a task`); today they are markable and fail per row inside `logSelected` (`Task ID is required`), and `marked_to_log` is persisted for adhoc rows. Options: (a) keep markable; footer shows `M need a task`; the row shows `Assign task`; after `Log`, the per-row error appears (R18); (b) disable the checkbox when `!taskId` and skip them (changes `logSelected`'s counting and leaves persisted marks stranded). **Recommend (a).** Preservation; the footer makes the failure predictable.

**R10. Controls the mockup omits** (List/Timeline, Group by task, Select all, Move to…, Templates). Options: (a) a 40px toolbar row at the top of the `Time entries` section; (b) header right side; (c) drop any of them. **Recommend (a).** Same place the old `ControlBar` sat, restyled.

**R11. `CalendarPopover` (month picker with activity dots; also the Move target).** Not drawn. Options: (a) keep as is, opened from the header date button and from `Move to…` / row `Move`, re-token `rounded-[2px]` only; (b) rewrite. **Recommend (a).**

**R12. Header stats that the mockup drops** (`Nm break`, `N logged`). Options: (a) append when > 0 after the three mockup stats; (b) drop. **Recommend (a).**

**R13. Footer keys.** Mockup buttons are 38px rounded. Options: (a) `KeyButton` md (44px) `+ ENTRY` outline + `LOG 3 TO EASY8` amber, `Log` disabled with a `title` at 0 / while logging; (b) 38px custom buttons. **Recommend (a)** — Phase 1/2 language.

**R14. `Log` button when nothing is marked.** Today the button is hidden at 0. Options: (a) rendered disabled (`Log to Easy8`, `title="Mark entries to log"`), like `BEGIN FOCUS` at rest; (b) hidden. **Recommend (a).** Disabled-with-reason is a state, not an inert control.

**R15. Locked day in the aside.** Existing: End Day hidden, nothing else; `unlockDay` has no UI. Options: (a) `Day ended` label + the saved reflection read-only (via `getShutdownRitual`), no unlock; (b) hide the textarea and the button only; (c) add an `Unlock` key (new feature). **Recommend (a).**

**R16. Success toast.** Options: (a) keep, re-token (`rounded-[2px]`, hairline, emerald text), strings and `View in Easy Project →` kept; (b) move into the footer summary. **Recommend (a).**

**R17. Dead files to delete in the cleanup commit.** `DailyLog/QuickLogBar.tsx` (0 importers), `DailyLog/AddTemplateModal.tsx` (imported, never rendered), `shared/TaskDisplay.tsx` (only `EntryRow`), `shared/TimelineItem.tsx` + `Timer/SessionHistory.tsx` (the latter is dead per inventory §1.10 and the only other importer). Options: (a) delete all five after a grep; (b) delete only the DailyLog ones, leave `TimelineItem` / `SessionHistory` / `TaskDisplay` on disk. **Recommend (a).** Leaving `TimelineItem` orphaned is how `SessionHistory` got orphaned.

**R18. Error handling UI (CLAUDE.md table: 401 → Settings, 404 → highlight, 422 → field errors, 5xx → retry).** Today: one `Failed to log N entries` notification; `result.errors` is discarded. Options: (a) per-row `role=alert` line with the server message, rows stay marked so `Log` is the retry, plus a 401 / `API not configured` banner with `Open Settings` (new `onNavigate` prop on `DailyLog`); notification kept; (b) notification only (as today). **Recommend (a).** The messages already exist; only the display is new.

**R19. E2E and the Review walk.** Options: (a) the walk in §7.1 (view, toggle modes, open + cancel modals, ±1 day, hover) with the guard additions in §7.2 (entry-table drift and ritual writes become violations); (b) screenshot only, as today. **Recommend (a).** The guard additions are the important part: they make any accidental write on this screen a red run.

**R20. Date label.** Mockup `Fri 25 Sep`; today `Today` / `Yesterday` / `Fri, Sep 25, 2026`. Options: (a) `Fri 25 Sep` always, muted `· Today` suffix on today (also what the e2e asserts for R1); (b) keep the words. **Recommend (a).**

**R21. Corner radii.** Mockup uses 6–14px. **Recommend** square `rounded-[2px]` + hairlines (P15 precedent); listed for completeness.

### Critical files for implementation
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/components/DailyLog/DailyLog.tsx` (orchestrator; every handler is reused)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/components/DailyLog/EntryRow.tsx` (source of the row rules, rewritten)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/stores/logStore.ts` (`logSelected` untouched; `partialize`, calendar `billable`)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/services/api.ts` and `electron/main.ts:881-885` (read-only in this phase; the safety tests target them)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/e2e/smoke.mjs`, `e2e/db-guard.mjs`
