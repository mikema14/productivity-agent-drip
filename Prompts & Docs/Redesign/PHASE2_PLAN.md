# Phase 2 plan: Plan screen

Spec: `mockups/Plan.dc.html`. Shared language: `mockups/Main.dc.html` as implemented in Phase 1 (`PHASE1_PLAN.md` §1.1, `UI_DESIGN_SYSTEM.md` "Now Screen Tokens"). Parity source: `FEATURE_INVENTORY.md` §1.2 (Lists rows), §1.7, §1.8, §1.9, §2 (Plan rows), §5.3.

Baseline on `feature/redesign` at `c82cc80`: 111 tests green (14 files), `tsc --noEmit` = 39 errors, `vite build` OK.

## 0. Ground truth that shapes the plan

- Plan today is a 22-line shell (`src/components/Plan/PlanView.tsx`): `ListsPanel` (212px, `src/components/Layout/ListsPanel.tsx`) beside either `ListPlanningView` (single list, 439 lines) or `AllListsOverview` (all lists, 508 lines). Both hosted views are the pre-redesign boards, untouched by Phase 1.
- The two boards are parallel implementations of the same thing with three real behavioural differences: (1) `AllListsOverview` has a 4th **Done** column (`:22-27`) and hides completed items from the active columns (`:78-88`); `ListPlanningView` keeps completed items in their column, strikethrough at the bottom. (2) `AllListsOverview` has list filter pills (`:423-450`), Group / Done / IDs toggles (`:370-421`, `showDone` and `showTaskIds` persisted in `localStorage` `allListsOverview_showDone` / `_showTaskIds`), no Add Task. (3) `ListPlanningView` has the list header (colour, name, `TaskIdBadge`, `BillableToggle` = list default, remaining count, Archive with `confirm`, `:184-216`), per-column progress bar + "Add Task" → `AddItemInline` (`:250-276`), auto-selects the first list when none is selected (`:65`), "No list selected" empty state (`:161-170`).
- Shared by both: `DraggableItem` (`@dnd-kit/sortable`), `DroppableColumn` per column, `PointerSensor` distance 5, `closestCorners`, `DragOverlay`; item row = checkbox, title → `TaskDetailInline`, `TaskIdBadge`, "n/m Subtasks" inline checklist, hover Move left/right, Move-to-list dropdown (closes on outside click), Delete (no confirm); `resolveTaskNames` for badge tooltips.
- `listsStore` (`src/stores/listsStore.ts`) holds **one** `items` array that is whatever was last loaded: `selectList(id)` reloads only that list (`:101-104`), `createItem` reloads `item.list_id` (`:112`), the all view calls `loadItems()` (all). Every `loadItems` first runs `archiveOldCompleted` (`:53`). `getItemsByColumn(listId, column)` already filters by `list_id` (`:145-149`), so a store that always holds all items works for both scopes.
- `list_items` columns (`src/services/db.ts:158-169` + migrations `:553-561`): `id, list_id, title, task_id, column, order, completed, billable, created_at, archived, completed_at, description, subtasks`. There is **no** `updated_at`, `estimate`, `snoozed_until` or `source`. `lists` (`:147-156`, `:572-574`): `id, name, color, icon_path, task_id, order, billable, created_at, archived`. `getLists` orders by `"order", created_at`.
- `updateListItem` (`db.ts:1653`) sets `completed_at` on complete and clears `completed_at` + `archived` on uncomplete. `archiveOldCompleted` (`:1584`) archives items completed > 7 days ago.
- The Raycast extension reads `list_items` / `lists` directly (`drip-raycast/src/lib/db.ts:283,290`, columns `id, list_id, title, task_id, column, order, completed, subtasks` + `lists.name/color/task_id`). Additive schema changes are safe; renames are not.
- The Leexi sync (`leexi-sync/drip_backlog.py`) creates a list literally named `Meeting Inbox` (`:39`, `billable = 0`) and inserts backlog items whose `description` starts with `From Leexi call: <title> (<date>)\n<url>` (`:95-104`). That is the only provenance signal that exists for the mockup's "Meeting Inbox · from Leexi calls" / "from call · Wed 23 Sep".
- Effective task id rule (§5.3): `list.task_id || item.task_id` (`TimerTaskList.tsx:76-85`, `TaskDetailInline.tsx:34`, Raycast `dedup.ts`). Billable chain item > list > global (`db.ts:1688`).
- Tracked minutes per task exist only as `todayMinutes` from `getRankedRecentTasks` (`db.ts:852-885`, pure `sumMinutesForDay` in `src/utils/frecency.ts:52`) and lifetime `getTaskTotalMinutes` (`db.ts:321`, `dashboardAPI`). Nothing gives "this week per task".
- `useTaskName.resolveTaskName` (`src/hooks/useTaskName.ts:19-33`) falls back to `timerAPI.getIssue` for ids missing from `task_cache`, which `INSERT OR REPLACE`s into `task_cache`. Both boards call it on every item with a `task_id`. In the e2e guard `task_cache` is in `MUST_BE_EMPTY` (`e2e/db-guard.mjs:31`); the Phase 1 walk only survived because every id on the boards was already cached.
- `TaskIdBadge` renders `#{taskId}` (`src/components/shared/TaskIdBadge.tsx:31`); design rule 6 forbids the `#` prefix on new surfaces (Phase 1 id pill has none).
- Cross-view hand-off: `Timer.selectedTask` is local state (`Timer.tsx:66`). The only external way to preselect a task is what `NowAside.onSelectTask` does (`Timer.tsx:474-486`: `getCachedTask` → `setSelectedTask`, fallback stub, `setIntention(title)`). `timerStore` persists `lastTaskId/lastTaskTitle/intention/durationMinutes/...` to localStorage (`timerStore.ts:710`); anything added must be excluded from `partialize`.
- `DAY_TARGET_MINUTES = 360` and `getMonday` live in `TimerDayTimeline.tsx:16,34`.
- E2E: `e2e/smoke.mjs:188-196` waits for `heading "All Tasks"`, screenshots `plan-all-tasks`, clicks the first `ul li button` carrying `data-testid="list-color"` for `plan-list`. Both selectors change with this redesign. Guard: `lists`, `list_items`, `task_cache` inserts are violations; `list_items` state drift is report-only (Q7); settings are restored.

---

## 1. Goal and scope

Goal: replace the two legacy boards and the lists panel with the Plan screen from the mockup, preserving every feature of §1.2 (Lists rows), §1.7 and §1.8 exactly, on the Phase 1 visual language (hairlines, `rounded-[2px]`, `.now-label`, `KeyButton`).

In scope: `PlanView`, `ListsPanel`, a unified board for the all-lists and single-list scopes, the Plan header, the Backlog grouping the mockup draws, the Today "Start on" CTA, tracked-time annotations, tests, e2e.

Out of scope (untouched files): `Timer/*` except the one hand-off effect in §3.4, `TimerTaskList` (the Now aside's task list stays as is), `CreateListModal`, `LogTimeModal`, `TaskDetailInline` internals, `AddItemInline` internals, DailyLog, Progress, Settings, overlays, Raycast, main-process timer. No caps on Today / This week (owner rule); no new schema (recommended, see P5/P7); no ⌘K, no Weekly review, no week navigation (P1–P3).

---

## 2. Mockup → component mapping

| Mockup region (`Plan.dc.html`) | Component | Data | Notes |
|---|---|---|---|
| Rail (`:19-40`) | `Layout/Rail.tsx` | – | done in Phase 1, Plan active for `lists` and `all-lists` |
| Header 52px: `Plan` + `‹ Week 39 · 21–27 Sep ›` (`:43-51`) | `Plan/PlanHeader.tsx` (new) | `weekLabel(new Date())` | week label is static text (P1); no arrows unless P1-b |
| Header right: `Weekly review`, `⌘K` (`:52-59`) | – | – | dropped (P2, P3) |
| Aside `Lists` 212px (`:64-94`) | `Layout/ListsPanel.tsx` (restyled) | `lists`, `archivedLists`, `items` (all lists) | `h2 Lists` + `+` (`aria-label="New list"`); `All tasks` row with open count and `aria-pressed`; per-list rows 44px: colour dot, name, subtitle, open count; spacer; bottom `Archived · n` toggle |
| List subtitle `logs to 679834` / `not billable` / `3 clients · billable` / `from Leexi calls` (`:75-87`) | `listSubtitle(list)` in `Plan/boardLogic.ts` | `lists.task_id`, `lists.billable` | `logs to <task_id>` if bound, else `billable` / `not billable`. No client data and no list provenance exist → those two strings are not reproducible |
| Sub-header 48px: `All tasks` · `22 across 4 lists` · `Group by list` pill (`:97-102`) | `Plan/PlanSubheader.tsx` (new) | counts, `groupByList`, `showDone`, `showTaskIds`, `activeListFilters` | In list scope it shows the list header controls instead (colour dot, name, `TaskIdBadge`, `BillableToggle`, remaining, Archive) |
| Key legend `T Today · W Week · S Snooze · D Drop` (`:103-108`) | – | – | dropped (P4) |
| 3-column grid (`:111`) | `Plan/PlanBoard.tsx` (new, replaces both boards) + `Plan/BoardColumn.tsx` | `items` partitioned by `boardLogic.partition` | Order Today · This week · Backlog (mockup) — reversed from today's Backlog · This Week · Today; a 4th Done column appends when `showDone` (P10) |
| Column header `TODAY` + `3 / 3`, `THIS WEEK` + `4 / 5`, `BACKLOG` + `15` (`:114-117,137-140,163-166`) | `BoardColumn` header | `open`, `done` counts | no caps: `{open}` and, when `done > 0`, `· {done} done` (P9). Today header is amber, the column has `border-focus/30` |
| Capacity line `2h 10m planned · 3h 40m free before 17:00` (`:118`) | `BoardColumn` subtitle (Today only) | `timerAPI.getSessions(today)` focus minutes vs `DAY_TARGET_MINUTES` | `Xh Ym focus · Zh Wm to 6h` (P8) |
| `1 slot left · cap keeps the week honest` (`:141`) | `BoardColumn` subtitle (This week) | `getTaskMinutesByRange(monday, sunday)` | `Xh Ym tracked this week` when P7 approved, else no subtitle |
| Task card: dot + title / id · list · time (`:120-131`) | `Plan/TaskCard.tsx` (new) | item, list, `taskNames`, minutes | The 7px dot is the complete control (rest = dot, hover/focus = 14px checkbox, done = green check square as `:129`). Title click → `TaskDetailInline` (unchanged). Second row: id pill (no `#`, `TaskIdBadge plain`) or `No task ID`; list name (all scope only; in list scope omitted); tracked minutes or `—`. Hover actions (Move ←/→, Move to list, Delete) appear on hover/focus-within at the right of row 1; "n/m Subtasks" badge stays after the title |
| Completed card (`:128-131`) | `TaskCard` `done` state | `completed === 1` | strikethrough, muted, green check; the card stays in its column (P10) |
| `Start on 689742` (`:133`) | `Plan/StartOnCTA.tsx` → `KeyButton variant="amber"` | first open Today item with an effective id | navigates to Now with the task preselected (P13); hidden while a session runs |
| Dashed `Drop a task here, or press W` (`:159`) | `BoardColumn` footer | – | list scope: `Add a task` button that opens `AddItemInline` in place and reads `Drop here` during a drag; all scope: `Drop a task here` (P14). Whole column stays a droppable, as today |
| Backlog groups `Meeting Inbox · new since Monday` / `Untouched 14+ days` / `Everything else` (`:168-201`) | `boardLogic.groupBacklog` | `created_at`, `description` | `New this week` (created ≥ Monday) / `Older than 14 days` (age from `created_at`, `Nd` badge) / `Everything else` (P5). Cards from Leexi show `from call · <date>` (P6) |
| Triage card with `W Week · K Keep · S Snooze · D Drop` (`:185-193`) | – | – | dropped (P4); the card renders like any other with the age badge |
| `Group by list` on (mockup off) | `BoardColumn` grouped rendering | `getGroupedItems` (moved to `boardLogic`) | group header: dot + name + count, as today |

---

## 3. Component and file plan

### 3.1 Tokens

No new colours. Reuse `drip.elevated` (hairlines), `drip.border` (control outlines), `focus/30` (Today column), `break` (done check), `.now-label`, `KeyButton`, `shadow-key-*`. `tailwind.config.js`: nothing new unless the 4-column grid needs `grid-cols-4` (already in Tailwind). Add one class to `index.css`: `.plan-card-actions` = `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` (hover actions must also appear on keyboard focus; today they are hover-only).

### 3.2 Store and data plumbing

| File | Change |
|---|---|
| `src/stores/listsStore.ts` | The store always holds **all** items. `selectList(id)` → `set({selectedListId:id}); get().loadItems()` (no per-list load). `createItem` reloads `loadItems()` (`:112`). `updateItem`/`moveItem` error paths reload all. `loadItems(listId?)` keeps its signature (still used by nothing else after this) but `PlanBoard` never passes an id. Add selectors `openCountByList(): Record<string, number>` and `openCountAll(): number` (not completed, not archived). `getItemsByColumn`, `getTodayItemsAllLists` unchanged. |
| `src/utils/frecency.ts` | Add `sumMinutesForRange(rows, from, to): Map<string, number>` (inclusive `YYYY-MM-DD` bounds on `row.day`), sibling of `sumMinutesForDay`. Pure, tested. **Only if P7 is approved.** |
| `src/services/db.ts` | Extract the UNION query of `getRankedRecentTasks` (`:858-875`) into `usageRowsSince(since)`; add `getTaskMinutesByRange(from, to): Record<string, number>` = `sumMinutesForRange(usageRowsSince(from), from, to)`. `getRankedRecentTasks` behaviour unchanged. **P7.** |
| `electron/main.ts`, `electron/preload.ts`, `src/types/index.ts` | `ipcMain.handle('get-task-minutes-by-range')`, `logAPI.getTaskMinutesByRange(from, to)`, `LogAPI` type. Same 3-edit pattern as `getTaskTotalMinutes` (`preload.ts:453`, `main.ts:1238`). **P7.** |
| `src/stores/timerStore.ts` | `pendingSelection: { taskId: string; title: string } \| null` + `setPendingSelection(sel)`. Not persisted (excluded from `partialize` at `:710`). **P13.** |
| `src/components/Timer/Timer.tsx` | One mount effect: if `pendingSelection && status === 'idle'` → same body as the `NowAside.onSelectTask` handler (`:474-486`), then `setPendingSelection(null)`. Nothing else in Timer changes. **P13.** |
| `src/components/shared/TaskIdBadge.tsx` | Optional `plain?: boolean` → renders the id without `#`. Default unchanged, so Now and DailyLog callers are untouched. Tooltip kept. |
| `src/test/setup.ts` | `listsAPI` stubs gain `createListItem`, `deleteListItem`, `archiveList`, `updateList`, `getLists`/`getArchivedLists` already there; `logAPI.getTaskMinutesByRange → {}`; `timerAPI.getSessions` already stubbed. |

### 3.3 Pure logic module `src/components/Plan/boardLogic.ts` (new, fully unit-tested)

- `COLUMNS = [{key:'today',label:'Today'},{key:'this_week',label:'This week'},{key:'backlog',label:'Backlog'}]` (mockup order).
- `effectiveTaskId(item, list)` = `list?.task_id || item.task_id || null` (§5.3 rule, same as `TimerTaskList.tsx:76-85`).
- `partition(items, lists, { scope, listId, filters, showDone })` → `{ columns: Record<column, {open: ListItem[]; done: ListItem[]}>, doneColumn: ListItem[] }`. `showDone=true` collects every completed item into `doneColumn` and leaves `done` empty (today's All Tasks semantics); `showDone=false` keeps completed items in their column's `done` bucket (today's single-list semantics, mockup). Sorted by `order`. Archived items excluded everywhere.
- `groupBacklog(items, monday, now)` → `[{key:'new', label:'New this week', items}, {key:'stale', label:'Older than 14 days', items}, {key:'rest', label:'Everything else', items}]`, empty groups omitted, order preserved inside each. Age = `floor((now − created_at)/day)`; a `Nd` badge for stale items. `created_at` is a SQLite `CURRENT_TIMESTAMP` (UTC, no `Z`) → parse with `parseDbTimestamp` (`src/utils/time.ts:118`).
- `groupByList(items, lists)` (moved verbatim from `AllListsOverview.tsx:142-152`).
- `resolveDrop({ activeId, overId, items, columns, showDone, scope, listId })` → `{ kind:'complete' } | { kind:'uncomplete', column } | { kind:'move', column, order } | null`. Encodes both existing `handleDragEnd`s: all scope `AllListsOverview.tsx:160-185` (drop on Done completes; drag out of Done uncompletes into the target column; otherwise `moveItem` with `overIndex` or append), list scope `ListPlanningView.tsx:132-150` (same move rule, completed items excluded from the index). The board calls `updateItem`/`moveItem` from the result.
- `arrowTargets(column)` → `{ left: column|null, right: column|null }` on the **data** order `backlog → this_week → today` (unchanged semantics: "right" still means "closer to Today" even though the mockup draws Today on the left; the icons stay ← / →, titles "Move left/right" kept so nothing in muscle memory or tests changes. See P4-note).
- `listSubtitle(list)` → `logs to <task_id>` | `billable` | `not billable`.
- `provenance(item)` → `{ kind:'leexi', date: string }` when `description` matches `/^From Leexi call: .* \((.+)\)/`, else `null`; card subtitle `from call · <date>` (P6).
- `capacityLine(focusMinutes)` → `"Xh Ym focus · Zh Wm to 6h"` using `formatMinutes`; when `focusMinutes >= 360` → `"Xh Ym focus · target met"`. `DAY_TARGET_MINUTES` imported from `TimerDayTimeline.tsx` (single source).
- `weekLabel(date)` → `"Week 39 · 21–27 Sep"` (ISO week, Monday–Sunday, month shown once when both ends share it, `21 Sep – 4 Oct` otherwise). `weekRange(date)` → `{ from, to }` as `YYYY-MM-DD` for the minutes query, using the same Monday rule as `TimerDayTimeline.getMonday`.
- `startCandidate(todayOpenItems, lists)` → first open Today item (by `order`) whose `effectiveTaskId` is non-null, or `null` (P13).

### 3.4 Components

| File | Status | Responsibility |
|---|---|---|
| `src/components/Plan/PlanView.tsx` | rewritten | `flex flex-col h-full`: `PlanHeader` on top, then `flex flex-1 min-h-0`: `ListsPanel` + `PlanBoard scope={view==='lists'?'list':'all'}`. Props unchanged (`view`, `onNavigate`, `onCreateList`). Mount: `loadLists()` + `loadItems()` once (both hosted views did their own; now one place). |
| `src/components/Plan/PlanHeader.tsx` | new | 52px, `border-b border-drip-elevated`, drag region like `NowHeader` (`WebkitAppRegion: drag`, controls `no-drag`). Left: `h1 Plan` (display 15px/500) + `weekLabel()` (13px muted, the date range in mono 12px). Right: empty in Phase 2 (P2/P3). `date?: Date` prop for tests. |
| `src/components/Plan/PlanSubheader.tsx` | new | 48px, `border-b border-drip-elevated`, `px-7`. **All scope:** `All tasks` (13.5px/500) · `{open} across {lists.length} lists` (12px muted) · pills `Group by list` / `Done` / `IDs` (26px, hairline, `aria-pressed`, `rounded-[2px]`; the three toggles of `AllListsOverview.tsx:370-421`, `Done` and `IDs` persisted under the **same** localStorage keys). Second row (only when the store has ≥ 2 lists): the list filter pills `All` + one per list, multi-select (`AllListsOverview.tsx:423-450`, P12). **List scope:** colour dot + list name (13.5px/500) + `TaskIdBadge plain` with tooltip (list-level id) + `BillableToggle` (`label` `Billable` / `Billable default`, `ListPlanningView.tsx:192-196`) + hairline spacer + `N remaining` / `This list has no tasks` + Archive icon button (`title="Archive list"`, `confirm('Archive this list? It will be hidden from Lists.')` → `useListsStore.archiveList(id)`, which also clears the selection → the board falls back to "No list selected" until `PlanBoard` re-selects the first list, exactly the old `:151-157` + `:65` behaviour). |
| `src/components/Plan/PlanBoard.tsx` | new (replaces `AllListsOverview.tsx` + `ListPlanningView.tsx`) | Owns: `DndContext` (`PointerSensor` distance 5, `closestCorners`, `DragStart/End`, `DragOverlay` with dot + title), `expandedItemId`, `expandedChecklistId`, `openListPickerId` (+ outside-click close), `addingColumn` (list scope), `taskNames` via `resolveTaskNames`, `groupByList` (session state), `showDone` / `showTaskIds` (localStorage keys above), `activeListFilters`, `focusMinutes` (today's non-break sessions via `timerAPI.getSessions(today)`; refreshed on mount and on `focus`), `weekMinutes` (P7). List scope: auto-select first list when none selected; "No list selected" empty state text kept verbatim (`ListPlanningView.tsx:161-170`, "Create a list from the sidebar" → "Create a list from the Lists panel"). Grid: `grid grid-cols-3` (4 with Done) `gap-3 p-6` on `wide:`; below 1000px `flex overflow-x-auto` with `min-w-[220px]` columns (P16). |
| `src/components/Plan/BoardColumn.tsx` | new | `section aria-label={label}`, `border border-drip-elevated` (`border-focus/30` for Today), `rounded-[2px]`, `p-3.5`, `flex flex-col min-h-0`. Header: `.now-label` (amber for Today) + right count (mono 12px). Subtitle slot (capacity / week line / list-scope progress bar). Body = `SortableContext` + `DroppableColumn` (moved from the old boards, `min-h-[60px]`, `overflow-y-auto`), renders `TaskCard`s flat, grouped by list, or (Backlog) grouped by `groupBacklog` with `.now-label`-style group rows `label · count`; `All Clear` empty state (text kept) when the column has nothing. List scope only: the progress bar `done/total` in the list colour under the header (`ListPlanningView.tsx:235-249`). Footer: dashed 52px `border-drip-border` zone (P14) — list scope `Add a task` (opens `AddItemInline` inside the column with `defaultBillable = list.billable !== 0`, `handleAddItem` verbatim from `ListPlanningView.tsx:89-107`, `order = open.length`), all scope `Drop a task here`; while `activeId` is set the text becomes `Drop here` and the zone highlights `border-focus/40`. |
| `src/components/Plan/TaskCard.tsx` | new | `DraggableItem` wrapper (unchanged file) around a `div.group` `border border-drip-elevated rounded-[2px] px-3 py-2.5`. Row 1: `CompleteDot` (button, `aria-label` `Mark done` / `Mark not done`, 7px dot in the list colour at rest → 14px `rounded-[2px]` checkbox on hover/focus → filled `bg-break/15 text-break` check when done) + title button (13.5px, `hover:text-focus`, click → toggle `TaskDetailInline`) + subtasks badge (`n/m Subtasks`, chevron, toggles the lightweight checklist) + `.plan-card-actions` hover group: Move left / Move right (icons and titles unchanged, gated by `arrowTargets`), Move to list (folder icon → dropdown listing the other lists, current list ticked in all scope as `AllListsOverview.tsx:280-314`; the dropdown restyled to `bg-drip-elevated border-drip-border rounded-[2px]`), Delete (`hover:text-alert`, no confirm, as today). Row 2 (`pl-[15px]`, 11.5px muted): id pill (`TaskIdBadge plain`, amber mono, only when `showTaskIds` in all scope / always in list scope for items with their own id, the list-level id is shown in the sub-header instead) or `No task ID`; list name (all scope, not when grouped by list); `from call · <date>` (P6) or the `Nd` age badge (stale group); spacer; tracked minutes (`1h 15m` / `2h 10m wk`) or `—` (P7). Done: `opacity-50`, strikethrough, no hover actions except the complete control and Delete (matches `AllListsOverview` `isCompleted` gating). Expanded: `TaskDetailInline` (unchanged component, unchanged props) rendered under the card; the lightweight checklist (`ListPlanningView.tsx:363-396` / `AllListsOverview.tsx:329-362`) rendered when only the badge is expanded. |
| `src/components/Plan/StartOnCTA.tsx` | new | `KeyButton variant="amber" size="md"` full width at the bottom of Today: `Start on {id}`. Click → `useTimerStore.getState().setPendingSelection({taskId, title})` then `onNavigate('timer')`. Not rendered when `startCandidate` is null or `useTimerStore.status !== 'idle'` (P13). |
| `src/components/Layout/ListsPanel.tsx` | restyled | Same props and store calls. Markup per §2: `aside aria-label="Lists"`, `p-3 pt-4`, `h2.now-label Lists` + `+` (`aria-label="New list"`, `title="Create list"` kept for the existing tests), `All tasks` row (`aria-pressed`, list icon, open count mono) → `selectList(null); onNavigate('all-lists')`; list rows `min-h-[44px]` (`data-testid="list-color"` dot kept, name, `listSubtitle`, open count, active = `bg-focus/10 text-focus`) → `selectList(id); onNavigate('lists')`; `flex-1` spacer; bottom `Archived · n` button (`aria-pressed`, archive icon; hidden when none) toggling the archived rows above it (italic name + `Restore` on hover → `unarchiveList`) — P20. |
| `src/components/Lists/AllListsOverview.tsx`, `src/components/Lists/ListPlanningView.tsx` | deleted | In the commit that lands `PlanBoard` list scope (§5 step 6), never before. `DraggableItem.tsx`, `AddItemInline.tsx`, `TaskDetailInline.tsx`, `LogTimeModal.tsx`, `CreateListModal.tsx`, `TimerTaskList.tsx` stay in `Lists/`. |
| `src/App.tsx` | unchanged | `PlanView` keeps its props. |
| `src/App.test.tsx` | modified | Mocks of the two deleted boards (`:12-13`) become one mock of `./components/Plan/PlanBoard`. |

### 3.5 State-by-state spec

| Element | All scope, Done off | All scope, Done on | List scope | No list (list scope, empty store) |
|---|---|---|---|---|
| Sub-header | `All tasks · N across M lists`, Group / Done / IDs, filter pills | same | dot + name + list id + BillableToggle + remaining + Archive | hidden |
| Columns | Today · This week · Backlog | + Done (completed from every column) | Today · This week · Backlog, each with a progress bar | "No list selected" empty state |
| Completed items | strikethrough in their column | in Done only | strikethrough in their column | – |
| Column footer | `Drop a task here` | same (Done: none) | `Add a task` → `AddItemInline` | – |
| Backlog grouping | New this week / Older than 14 days / Everything else | same | same | – |
| Group by list | per-column list groups | same | n/a (pill hidden) | – |
| Start on CTA | if a Today item has an effective id and the timer is idle | same | same (within the list) | – |
| Capacity line (Today) | `Xh Ym focus · Zh Wm to 6h` | same | same | – |
| Time column on cards | tracked minutes (P7) | same | same | – |
| DnD | across the three columns; into Done completes; out of Done uncompletes | same | across the three columns | – |
| Hover actions | ←/→ (gated), Move to list, Delete | Done cards: Delete only | same as all | – |

---

## 4. Parity table

`Verified by` names the test that fails if the feature regresses; `e2e` means the smoke walk also exercises it read-only.

| Inventory item | Old location | New home | Verified by |
|---|---|---|---|
| §1.2 Lists header + `+` create list | `ListsPanel.tsx:33-45` | `ListsPanel` header, `aria-label="New list"`, `title="Create list"` | `ListsPanel.test` "+ calls onCreateList"; `App.test` "+ opens CreateListModal" |
| §1.2 All Tasks entry → overview | `ListsPanel.tsx:47-63` | `All tasks` row with open count | `ListsPanel.test` (existing, name updated to `All tasks`); e2e `plan-all-tasks` |
| §1.2 Per-list row with colour dot → single list | `ListsPanel.tsx:66-79` | list rows (dot kept, `data-testid="list-color"`) + subtitle + count | `ListsPanel.test` colour/selection test + new subtitle/count tests; e2e `plan-list` |
| §1.2 Show/Hide archived + Restore | `ListsPanel.tsx:83-106` | bottom `Archived · n` toggle + rows + Restore | `ListsPanel.test` archived tests (labels updated, P20); e2e clicks `Archived · n` when present, never Restore |
| §1.7 Columns Backlog / This Week / Today | `ListPlanningView.tsx:22-26` | `BoardColumn` ×3 (display order Today · This week · Backlog) | `boardLogic.test` partition; `PlanBoard.test` renders three `section`s by label |
| §1.7 List header: dot, name, TaskIdBadge, BillableToggle, remaining, Archive (confirm) | `ListPlanningView.tsx:184-216` | `PlanSubheader` list scope | `PlanBoard.test` "list scope sub-header" (`role=switch` → `updateList`, Archive → `confirm` + `archiveList`, remaining text, `This list has no tasks`) |
| §1.7 Per column done/total + progress bar | `:235-249` | `BoardColumn` subtitle slot (list scope) | `PlanBoard.test` progress width |
| §1.7 Add Task → AddItemInline (title, id, billable; Enter adds) | `:250-276`, `AddItemInline.tsx` | column footer `Add a task` (list scope) | `PlanBoard.test` "Add a task opens AddItemInline, submit calls createItem with list billable default and `order = open.length`" |
| §1.7 / §1.8 DnD between columns (PointerSensor 5, closestCorners, DragOverlay) | both `handleDragEnd` | `resolveDrop` + `PlanBoard` wiring | `boardLogic.test` resolveDrop matrix; `PlanBoard.test` drag handler (mocked `DndContext`, see §6.1) → `moveItem(id, column, order)` |
| §1.8 Drag to Done completes / out of Done uncompletes | `AllListsOverview.tsx:172-184` | `resolveDrop` `complete` / `uncomplete` | `boardLogic.test`; `PlanBoard.test` → `updateItem(id,{completed:1})` / `{completed:0,column}` |
| §1.7 / §1.8 Item checkbox complete | both | `CompleteDot` | `PlanBoard.test` "Mark done → updateItem completed 1", "Mark not done → 0" |
| §1.7 / §1.8 Title click → TaskDetailInline | both | `TaskCard` title | `PlanBoard.test` "title toggles TaskDetailInline (mocked) with `listTaskId` and `isFolderList`" |
| §1.7 / §1.8 TaskIdBadge with name tooltip | both | `TaskIdBadge plain` in row 2 (all scope gated by IDs) | `PlanBoard.test` "id shown without `#`", "IDs off hides it in all scope, list scope always shows" |
| §1.7 / §1.8 `n/m Subtasks` badge + inline checklist toggle | both | `TaskCard` badge + checklist | `PlanBoard.test` "badge → checklist, tick → updateItem subtasks JSON" |
| §1.7 / §1.8 Hover Move left / right | both | `.plan-card-actions` (also on focus) | `PlanBoard.test` "Move right from backlog → moveItem this_week; no Move right on today; no Move left on backlog" |
| §1.7 / §1.8 Move-to-list dropdown (outside click closes; current list ticked in all scope) | both | `TaskCard` folder dropdown | `PlanBoard.test` "move to list → updateItem list_id; outside click closes" |
| §1.7 / §1.8 Delete (no confirm) | both | `TaskCard` Delete | `PlanBoard.test` → `deleteItem` |
| §1.7 Completed strikethrough in column; "All Clear" | `:398-419` | `TaskCard done`, column empty state | `PlanBoard.test` |
| §1.7 Auto-select first list; "No list selected" | `:65, :161-170` | `PlanBoard` list scope | `PlanBoard.test` "selects lists[0] when none", "empty state with no lists" |
| §1.7 TaskDetailInline: title/id/description save, Start, Log → LogTimeModal, billable, subtasks | `TaskDetailInline.tsx` | unchanged component, same props from `TaskCard` | existing behaviour, file untouched; `PlanBoard.test` asserts the props passed |
| §1.7 LogTimeModal, CreateListModal | unchanged | unchanged | untouched; `App.test` still opens CreateListModal |
| §1.7 Auto-archive 7-day completed on load | `listsStore.ts:53` | unchanged | `listsStore.test` "loadItems calls archiveOldCompleted first" |
| §1.8 4th Done column + Done toggle (`allListsOverview_showDone`) | `AllListsOverview.tsx:22-27, 42-44, 128-134` | `Done` pill + Done column (P10) | `PlanBoard.test` "Done on → 4 sections and completed items only in Done; persisted key written" |
| §1.8 IDs toggle (`allListsOverview_showTaskIds`) | `:49-51, 136-142` | `IDs` pill (P11) | `PlanBoard.test` |
| §1.8 Group (by list) toggle | `:46, 144-154` | `Group by list` pill | `PlanBoard.test` "groups per column with dot + name + count; list tag hidden on cards" |
| §1.8 Header `N remaining across M lists` | `:375` | sub-header | `PlanBoard.test` text |
| §1.8 List filter pills All + multi-select | `:423-450` | sub-header second row (P12) | `PlanBoard.test` "filter to one list hides the others; All clears" |
| §1.8 List tag on cards in flat view | `:229-235` | row 2 list name (hidden when grouped) | `PlanBoard.test` |
| §1.9 BillableToggle, TaskIdInput (in AddItemInline/CreateListModal) | unchanged | unchanged | untouched |
| §5.3 `list.task_id` overrides `item.task_id` | TimerTaskList, TaskDetailInline | `effectiveTaskId` for the CTA and (P7) minutes; `TaskDetailInline` still receives `listTaskId` | `boardLogic.test`; `PlanBoard.test` CTA uses the list id when bound |
| §5.3 Billable chain item > list > global | `AddItemInline defaultBillable`, `TaskDetailInline` | unchanged inputs | `PlanBoard.test` add-item default |
| §5.3 Raycast reads `list_items` / `lists` | – | no schema change (P5-a, P7 adds no column) | n/a |
| §1.3 TimerTaskList in the Now aside | `NowAside` | untouched | existing `Timer.test` stub |
| §2 "Lists sidebar → Plan left aside" | – | `ListsPanel` | as above |
| §2 "Restore per archived list not drawn" | – | kept (P20) | `ListsPanel.test` |
| §2 "Column order reversed" | – | display reversed, data order unchanged (`arrowTargets`) | `boardLogic.test` |
| §2 "Add Task inline not drawn" | – | column footer (P14) | `PlanBoard.test` |
| §2 "Done column, Done/IDs toggles, multi-select pills NO HOME" | – | sub-header (P10–P12) | `PlanBoard.test` |
| §2 "TaskDetailInline NO HOME drawn" | – | expands under the card, unchanged | `PlanBoard.test` |
| §2 "Subtasks NO HOME" | – | badge + checklist + detail panel, unchanged | `PlanBoard.test` |
| §2 "LogTimeModal NO HOME" | – | via TaskDetailInline `Log`, unchanged | untouched |
| §2 "List-level task id + list BillableToggle" | – | `PlanSubheader` list scope + `logs to` subtitle | `PlanBoard.test`, `ListsPanel.test` |
| §2 "Item BillableToggle (AddItemInline) NO HOME" | – | inside `AddItemInline`, unchanged | untouched |
| §2 "Archive list not drawn" | – | sub-header Archive (list scope) | `PlanBoard.test` |
| §2 "Move-to-list / Move left-right not drawn" | – | hover actions | `PlanBoard.test` |
| §2 "Auto-archive" | – | unchanged | `listsStore.test` |
| New: Start on CTA | – | `StartOnCTA` → `pendingSelection` → Now | `PlanBoard.test`; `Timer.test` "consumes pendingSelection on mount" |
| New: capacity line, week label, backlog groups, tracked minutes | – | `boardLogic` | `boardLogic.test`, `frecency.test` |

Nothing from §1.7 / §1.8 is dropped. The only string changes: `All Tasks` → `All tasks`, `This Week` → `This week`, `Show archived (n)` / `Hide archived` → `Archived · n` (pressed), "hidden from the sidebar" → "hidden from Lists", "Create a list from the sidebar" → "from the Lists panel".

---

## 5. Build sequence

One commit per step; every step ends with `npm test` green (count never below the previous step), `npx tsc --noEmit | grep -c "error TS"` ≤ 39, `npx vite build` OK. New files must be tsc-clean; deleting the two boards may lower the count, never raise it.

1. **Plumbing.** `listsStore` all-items rule + selectors; `timerStore.pendingSelection` + Timer mount effect; `TaskIdBadge plain`; (P7) `sumMinutesForRange`, `db.getTaskMinutesByRange`, IPC + preload + type; `setup.ts` stubs. Tests: `listsStore.test.ts`, `frecency.test.ts` additions, `Timer.test.tsx` pending-selection case. No UI change. — `feat(plan): store holds all items, timer pending selection, task-minutes range query`
2. **boardLogic.** `boardLogic.ts` + `boardLogic.test.ts` (partition, groupBacklog, groupByList, resolveDrop matrix, arrowTargets, listSubtitle, provenance, capacityLine, weekLabel/weekRange, startCandidate, effectiveTaskId). — `feat(plan): pure board logic`
3. **ListsPanel restyle.** Rows, subtitles, counts, `Archived · n`; `ListsPanel.test.tsx` updated + new cases; `App.test.tsx` `All tasks` name. — `feat(plan): lists panel per mockup`
4. **PlanHeader + PlanView shell + PlanSubheader (all scope).** Old boards still render underneath the new header for this one commit. `PlanHeader.test.tsx`, `PlanSubheader` cases in `PlanBoard.test.tsx` deferred to step 5. — `feat(plan): header and sub-header`
5. **PlanBoard all scope.** `PlanBoard`, `BoardColumn`, `TaskCard`, DnD wiring, Done/IDs/Group/filters, backlog groups, `TaskDetailInline` expansion, hover actions; `PlanView` uses `PlanBoard` for `all-lists` only. `PlanBoard.test.tsx` all-scope cases. `App.test` mock for `PlanBoard` (the `AllListsOverview` mock goes). — `feat(plan): unified board, all-lists scope`
6. **PlanBoard list scope; delete the legacy boards.** Sub-header list controls, progress bars, `Add a task` footer, auto-select, empty state; `git rm` `AllListsOverview.tsx` `ListPlanningView.tsx`; `App.test` mock cleanup. List-scope tests. From here nothing is duplicated and nothing is lost. — `feat(plan): single-list scope; remove legacy boards`
7. **Today extras.** `StartOnCTA`, capacity line, tracked minutes on cards (P7), week line. Tests. — `feat(plan): start-on CTA, capacity and tracked time`
8. **E2E.** `smoke.mjs` Plan steps (§7.1), guard change (§7.2), run once with the installed app quit; attach `report.txt` + screenshots to the review. — `test(e2e): Plan walk and task_cache tolerance`
9. **Cleanup + docs.** `UI_DESIGN_SYSTEM.md` "Plan tokens" (card, complete dot, column, dashed footer, sub-header pills); remove any now-unused `Lists/` helpers (grep importers first). — `chore(plan): design-system notes and cleanup`

---

## 6. Test plan

### 6.1 Vitest / RTL

Patterns as in Phase 1: `useListsStore.setState` for state, `window.listsAPI.*` stubs, `userEvent`, `vi.mock` heavy children. DnD in jsdom: `vi.mock('@dnd-kit/core', async (orig) => ({ ...(await orig()), DndContext: ({ children, onDragEnd, onDragStart }) => { (globalThis as any).__dnd = { onDragEnd, onDragStart }; return <>{children}</>; } }))`, then `act(() => __dnd.onDragEnd({ active:{id:'a'}, over:{id:'today'} }))`. `useDroppable`/`useSortable` come from the real module (they tolerate a missing context in jsdom for render-only assertions; if not, stub them to `{ setNodeRef: () => {} }`).

New / changed files and cases:

`src/stores/listsStore.test.ts` (new)
- `selectList('l1')` sets `selectedListId` and calls `getAllListItems` (not `getListItems`)
- `loadItems` calls `archiveOldCompleted` before fetching; a throwing `archiveOldCompleted` does not block the load
- `createItem` inserts optimistically, then `createListItem` + reload all; failure removes the temp row
- `moveItem` optimistic update; failure reloads
- `openCountByList` / `openCountAll` ignore completed and archived

`src/utils/frecency.test.ts` (+3, P7): `sumMinutesForRange` inclusive bounds, ignores rows outside, sums per task

`src/components/Timer/Timer.test.tsx` (+2): with `pendingSelection={taskId:'600001',title:'Do X'}` and a cached task, Timer mounts in ready-selected with `Task number 1` and the note input containing `Do X`, and clears `pendingSelection`; with `status:'focus'` the selection is left untouched

`src/components/Plan/boardLogic.test.ts` (new, ~30 cases): partition both `showDone` modes and both scopes, filters; `groupBacklog` boundaries (created exactly on Monday 00:00 local = new; 13 days = rest; 14 days = stale; badge text `14d`; UTC timestamp parsing); `resolveDrop`: over column id, over item in same column (index), over item in other column, over Done from active (complete), out of Done (uncomplete + column), self-drop no-op, unknown over → null, completed items excluded from index in list scope; `arrowTargets` for each column; `listSubtitle` three branches; `provenance` match / no match / malformed; `capacityLine` 185 → `3h 05m focus · 2h 55m to 6h`, ≥ 360 → `target met`, 0 → `0m focus · 6h to 6h`; `weekLabel` same-month, cross-month, cross-year, ISO week number on 2026-09-25 = `Week 39 · 21–27 Sep`; `weekRange` Monday–Sunday; `startCandidate` skips items without an effective id, honours list id, respects `order`

`src/components/Plan/PlanHeader.test.tsx` (new): renders `Plan`, the week label for an injected date, drag region on the header

`src/components/Layout/ListsPanel.test.tsx` (updated + new): existing five cases with renamed labels (`All tasks`, `Archived · 2`, pressed state instead of `Hide archived`); new: open counts per row and on `All tasks`; subtitle `logs to 679834` / `billable` / `not billable`; active row highlighted for `view='lists'` + `selectedListId`; `All tasks` `aria-pressed` for `view='all-lists'`

`src/components/Plan/PlanBoard.test.tsx` (new, ~35 cases; `vi.mock` `TaskDetailInline`, `AddItemInline` to light stubs that expose their props): everything in §4's "Verified by" column for §1.7 / §1.8 rows, plus: Today column carries `border-focus/30`; columns render in mockup order; Done column only when `showDone`; completed inline when off; `localStorage` keys written; IDs gating per scope; Group by list hides the list tag; filter pills; backlog groups with labels and `Nd` badge; Leexi subtitle; capacity line from `getSessions` (non-break only); week line (P7); `Start on 689742` present/absent/`status:'focus'` → hidden, click → `pendingSelection` + `onNavigate('timer')`; hover actions visible on `focus-within`; `Add a task` footer only in list scope, opens `AddItemInline`, submit → `createItem` with `billable` from the list and `order` = open count; dashed footer text switches to `Drop here` during `onDragStart`; list scope auto-select + empty state; Archive confirm accepted → `archiveList`, declined → nothing; BillableToggle → `updateList`

`src/App.test.tsx` (updated): mocks `./components/Plan/PlanBoard`; existing four cases keep passing with `All tasks`

Existing Timer / picker / TickRuler / TimerDayTimeline / Rail / overlay tests: untouched, must stay green (the store change is a superset; `Timer.test` stubs `TimerTaskList`).

Expected total after step 8: ≈ 111 + 5 + 3 + 2 + 30 + 3 + 5 + 35 ≈ 190.

### 6.2 E2E — see §7.

---

## 7. E2E smoke and guard

### 7.1 `e2e/smoke.mjs` Plan walk (replaces `:188-196`; both sizes)

Read-only by construction; each step lists the writes it can cause.

1. Rail `Plan` → wait for `main` text `All tasks` in the sub-header → `plan-all-tasks`. (Writes: `archiveOldCompleted` state flips — report-only Q7; `resolveTaskNames` may GET uncached ids → `task_cache` — §7.2.)
2. Click `Group by list` → `plan-all-grouped` → click again. (No writes; session state.)
3. If the `Done` pill is not pressed: click → `plan-all-done` → click again to restore the persisted value; same for `IDs`. Both write `localStorage` (Electron `Local Storage`, not the SQLite guard); the walk restores the original state, so the user's preference survives.
4. Click the first card title → `TaskDetailInline` visible → `plan-card-detail` → press the panel's close button. (No writes: `saveTitle`/`saveTaskId`/`saveDescription` only write when the value changed; the walk never types.) Never click `Start`, `Log`, the billable switch, subtask checkboxes, or `Add subtask`.
5. If a card shows `n/m Subtasks`: click the badge → `plan-card-subtasks` → click again. (No writes.)
6. In `aside[aria-label="Lists"]`: if `Archived · n` exists, click → `plan-archived` → click again. Never click `Restore`.
7. Click the first list row (`button` containing `[data-testid="list-color"]` inside the aside) → wait for the sub-header `role=switch` → `plan-list`. (No writes.)
8. Hover the first open card → `plan-card-hover` (actions visible). Never click ←/→, Move to list, Delete, `Mark done`, `Add a task`, Archive.
9. Never drag. Never click `Start on …` (P18). Rail `Review` continues as today.

Assertions added: the three column `section`s exist by label in both scopes; `Start on` (if present) is a button; no `#` characters inside any `.plan-card` id pill.

### 7.2 Guard changes (`e2e/db-guard.mjs`)

- **`task_cache` becomes a tolerated cache table (P17):** move it from `MUST_BE_EMPTY` to a new `CACHE_TABLES = ['task_cache']`. Inserts are still deleted and reported (`task_cache: N cache row(s) fetched during the run — deleted`), but are not violations. Replaced rows are already restored from the backup (`:135-141`). Rationale: the Plan walk resolves names for every id on the boards; an id that is not yet cached triggers a legitimate GET (never a POST; the POST block `main.ts:872-873` and the `[Safety] Blocked` grep stay).
- `lists`, `list_items` stay in `MUST_BE_EMPTY`; the walk creates nothing.
- `list_items` state drift stays report-only (Q7). Add to the report a count split: `archived` flips vs `column/order` changes, and make any `column`/`order`/`completed` change (which only a drag, arrow, or checkbox could cause) a **violation**; `archived` flips alone stay a report. This is the guard that proves step 8 never moved a card.
- Precondition print gains: "the Plan walk toggles Done / IDs and restores them; localStorage is outside the guard".

### 7.3 Unavoidable writes in the Plan walk

`settings.timer_state` etc. (from the Now part, unchanged), `calendar_proposals` sync (unchanged), `list_items.archived` from `archiveOldCompleted` (reported), `task_cache` GET fills (tolerated + deleted), `localStorage` toggles (restored by the walk). No `lists`/`list_items` inserts, no `column`/`order`/`completed` changes, no time entries.

---

## 8. Risks

- **Unifying two 450–500-line boards** (inventory §5.1) is the big rewrite. Mitigation: `resolveDrop` and `partition` are pure and tested against both old behaviours before any JSX exists (step 2 before step 5); the legacy boards are deleted only in step 6 after the list-scope tests pass.
- **Completed-item semantics differ between the old boards** (Done column vs in-column). P10 picks one rule per `showDone` state; a user with `showDone=false` will now *see* completed items inline instead of nothing. Flagged, not silent.
- **Store change to all-items**: any code that assumed `items` is per-list. Grep: only the two deleted boards and `TimerTaskList` (which already loads all). `createItem`'s reload changes from per-list to all; behaviour visible only as a superset.
- **`resolveTaskNames` network calls** on the Plan screen (pre-existing) now also matter for the guard; P17 covers e2e, and the calls are GETs.
- **dnd-kit in jsdom**: the mocked-`DndContext` pattern verifies wiring, not pointer gestures. Pointer DnD is verified manually on the review screenshots (e2e never drags).
- **`weekLabel` ISO week** across year boundaries; tested explicitly.
- **`created_at` timezone**: SQLite `CURRENT_TIMESTAMP` is UTC without `Z`; `groupBacklog` must use `parseDbTimestamp` or "New this week" is off by the local offset near Monday midnight. Tested.
- **Narrow windows**: 3 columns + 212px aside + 72px rail at 800px leaves ~150px per column; P16 (horizontal scroll, `min-w-[220px]`) mirrors today's `overflow-x-auto`. The 800×600 screenshots confirm.
- **tsc gate**: new files are strict; the two deleted files may carry some of the 39 existing errors (count can only fall). If `TaskDetailInline`/`AddItemInline` prop types need widening for `PlanBoard`, do it in the same commit with a test.
- **Confirm dialogs in tests**: `window.confirm` is stubbed via `vi.spyOn(window, 'confirm')` in the Archive cases.

---

## 9. Owner decisions needed

Each item: what the mockup shows vs what exists, the options, and my recommendation. I will proceed on the recommendation unless told otherwise.

**P1. Week label and ‹ › arrows in the header.** Mockup: `‹ Week 39 · 21–27 Sep ›`. Nothing in Lists has a week concept ("This week" is a timeless column). Options: (a) static label of the current ISO week, no arrows; (b) arrows that do nothing visible (inert, violates the Q4 precedent); (c) drop the label. **Recommend (a).** The label gives "This week" and the tracked-week line a concrete date range.

**P2. `Weekly review` button.** No review UI exists; `computeWeeklySummary` runs from End Day only. Options: (a) drop for Phase 2, roadmap item; (b) open Review on the current week. **Recommend (a).**

**P3. `⌘K` search.** Not built in Phase 1 either (Now header has none). Options: (a) drop, consistent with Now; (b) build a palette. **Recommend (a).**

**P4. Key legend `T Today · W Week · S Snooze · D Drop` and the triage row `W Week · K Keep · S Snooze · D Drop` on the stale card.** No keyboard model, no `snoozed_until`, no "keep" state exist. Options: (a) drop legend and triage row; hover actions (←/→, Move to list, Delete) carry every existing behaviour; keys return with the task-hygiene phase together with Today's keycaps (Q4); (b) ship `T`/`W`/`D` only, acting on the hovered card (`T`→today, `W`→this_week, `D`→delete with confirm), plus a legend of those three; (c) full triage with a schema change (`snoozed_until`, `last_touched_at`). **Recommend (a).** Note on arrows: the mockup reverses the column order (Today left); the data order and the Move left/right semantics are kept so Raycast and muscle memory are unchanged — the ← icon still means "towards Backlog". Say if you want the icons flipped to match the visual order.

**P5. Backlog grouping and the `18d` age badge.** Mockup: "Meeting Inbox · new since Monday", "Untouched 14+ days" with an age, "Everything else". No `updated_at` exists; `created_at` does. Options: (a) groups from `created_at`: `New this week` (created ≥ Monday) / `Older than 14 days` (`Nd` since creation) / `Everything else`, no schema change; (b) add `list_items.updated_at` (migration, set in `createListItem`/`updateListItem`/`moveItem`, Raycast-safe additive) and group by "untouched"; (c) no grouping, flat backlog as today. **Recommend (a)** for Phase 2; (b) is a clean follow-up once the group proves useful.

**P6. Leexi provenance subtitle.** Mockup: `from call · Wed 23 Sep`. The sync writes `From Leexi call: <title> (<date>)` into `description`. Options: (a) parse that prefix and show `from call · <date>` as the card's row-2 text, list name otherwise; (b) show nothing special. **Recommend (a).** The parser is pure and tolerant; a non-matching description shows the list name.

**P7. Time column on cards (`1h 15m`, `2h 10m wk`).** Mockup values look like estimates; no estimate field exists (owner: no caps, capacity lines fine). Options: (a) tracked minutes — today's for Today cards, Monday–Sunday for This week cards, nothing on Backlog — via a new `logAPI.getTaskMinutesByRange(from, to)` (db + preload + main + types, pure `sumMinutesForRange`), attributed to the item's **own** `task_id` only (`—` when the id is inherited from the list, so five items of a task-bound list do not all show the list's total); (b) same but attributed by effective id (inherited ids repeat the list total on every card); (c) drop the column. **Recommend (a).** Cheap, honest, and it makes the week line possible.

**P8. Today capacity line.** Mockup: `2h 10m planned · 3h 40m free before 17:00`. No planned durations. Options: (a) `Xh Ym focus · Zh Wm to 6h` from today's non-break sessions against `DAY_TARGET_MINUTES = 360` (same numbers as the Now day bar); (b) (a) plus `before <workdayEndTime>` computed as end-of-day minus now minus remaining accepted meetings; (c) drop. **Recommend (a).**

**P9. Column counts without caps.** Mockup: `3 / 3`, `4 / 5`. Options: (a) `{open}` and, when any are done, `· {done} done` (muted); (b) `{open}` only. **Recommend (a).**

**P10. Done column vs inline completed.** Today: All Tasks has a Done column when the `Done` toggle is on and hides completed items when off; the single-list board shows them inline strikethrough. Mockup shows a completed card inline. Options: (a) `Done` on → 4th Done column (as today); `Done` off → completed shown inline in their column (mockup, matches single-list); default of the persisted key unchanged (`true`); (b) same rule, flip the default to `false` so a fresh install matches the mockup; (c) keep "off = hidden" exactly. **Recommend (a).** The only visible change is for a user with Done off, who now sees completed items inline instead of nowhere — I would rather show them than hide them.

**P11. `IDs` toggle.** Mockup cards always show the id. Options: (a) keep the toggle, honour the persisted value, default stays `false` (fresh install shows list name + time only); (b) keep the toggle, default `true`; (c) drop the toggle and always show ids. **Recommend (b).** An explicit stored `false` is honoured; a fresh state matches the mockup. In list scope the item id is always shown (no list tag competes for the row).

**P12. List filter pills (All + multi-select).** Not in the mockup; the Lists aside now gives single-list scope, but multi-select (2 of 4 lists) is not the same. Options: (a) keep as a second sub-header row in all scope (wraps; hidden when there is only one list); (b) drop, single-list scope covers the need. **Recommend (a)** under the preservation rule.

**P13. `Start on 689742` behaviour.** Mockup links to Now. Options: (a) navigate to Now with the task preselected and the item title as the session note (new `timerStore.pendingSelection`, consumed once by Timer; identical to what clicking a task in the Now aside does); candidate = first open Today item (by `order`) with an effective id; hidden when no candidate or a session is running; (b) start immediately like `TaskDetailInline` Start (uses `pomodoroFocus`, notification); (c) drop. **Recommend (a).** Kickoff/boundary rules are then Now's, unchanged.

**P14. Dashed footer `Drop a task here`.** Options: (a) list scope: `Add a task` button that opens `AddItemInline` in the column and reads `Drop here` during a drag; all scope: `Drop a task here` (no add, as today); (b) keep the old `Add Task` header button and a purely decorative dashed zone. **Recommend (a).** One affordance, both jobs.

**P15. Corner radii.** The Plan mockup uses 9–14px radii; Now shipped square (`rounded-[2px]`) and `UI_DESIGN_SYSTEM.md` says Phase 2 reuses that language. Options: (a) square, hairlines, `.now-label` headers; (b) the mockup's radii. **Recommend (a).**

**P16. Below 1000px.** Options: (a) columns keep `min-w-[220px]` in a horizontally scrolling row (today's behaviour), aside stays 212px; (b) stack the columns vertically; (c) collapse the aside to icons. **Recommend (a).**

**P17. Guard: `task_cache`.** The Plan walk can GET uncached ids (pre-existing `useTaskName` fallback). Options: (a) make `task_cache` a tolerated cache table in the guard (inserts deleted and reported, not a violation); (b) make `useTaskName` skip the API fallback under `DRIP_TEST_MODE` (touches a hook Now also uses); (c) leave as is and accept a red run when an id is uncached. **Recommend (a).**

**P18. E2E and the CTA.** Clicking `Start on` writes the persisted `intention` (localStorage, outside the guard) with the item's title. Options: (a) never click it in the smoke; cover by unit tests; (b) click it and accept the intention overwrite. **Recommend (a).**

**P19. Unify the boards.** Options: (a) one `PlanBoard` with a `scope` prop, delete `AllListsOverview.tsx` and `ListPlanningView.tsx`; (b) restyle both in place. **Recommend (a).** Two boards is how the completed-item semantics drifted apart in the first place.

**P20. Archived toggle label.** Options: (a) bottom `Archived · n` (`aria-pressed`) per mockup, rows with `Restore` on hover above it; (b) keep `Show archived (n)` / `Hide archived` text. **Recommend (a).** Tests updated in the same commit.

**P21. Subtitle strings the mockup shows but the data cannot produce** (`from Leexi calls`, `3 clients · billable`). Options: (a) rule `logs to <id>` | `billable` | `not billable` only; (b) add a `lists.subtitle` column (new feature). **Recommend (a).**

### Critical files for implementation
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/components/Lists/AllListsOverview.tsx` and `ListPlanningView.tsx` (sources of every behaviour, then deleted)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/stores/listsStore.ts`
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/components/Layout/ListsPanel.tsx`
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/components/Timer/Timer.tsx` (one effect) and `src/stores/timerStore.ts` (`pendingSelection`)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/e2e/smoke.mjs`, `e2e/db-guard.mjs`
