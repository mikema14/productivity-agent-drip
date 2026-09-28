# Phase 1 plan: rail shell + Now screen

## 0. Ground truth that shapes the plan

- Routing today is a `useState('timer')` switch in `src/App.tsx:16,63-80`; view ids `timer | daily-log | progress | settings | lists | all-lists`. Nothing in `electron/` navigates views (deeplinks only `show()` the window), so keeping the ids is enough.
- The Sidebar owns three things that must survive: nav (`src/components/Layout/Sidebar.tsx:76-81`), the intention button (`:141-168`, the only entry point when intentions are empty because `IntentionRow.tsx:7` returns null), and the Lists section (`:170-264`).
- Timer state machine: `focusState` derived at `src/components/Timer/Timer.tsx:82-85`; `status==='break'` is not a focus state (in break, `focusState` is still `ready-*`), which is why several gates use `status !== 'break'`.
- Kickoff header strings live at `Timer.tsx:327-335` (`Kickoff` / `Rolls into Nm`); `startKickoff(seconds)` is `src/stores/timerStore.ts:199-204` (resolves the task itself and ignores the UI selection).
- Cancel (`reset`, `timerStore.ts:628-656`) never calls `saveSession`; confirm modal only when elapsed > 300 s (`Timer.tsx:246-252`). Skip Break (`skip` → `reset`, `:482-510`) also writes no rows. `stopKickoff` (`:207-248`) DOES save a session, so e2e must never use it. Break-complete saves a break row only if it ran ≥ 1 min (`:428`).
- Main-process timer writes the `timer_state` settings row on start/pause/resume/stop/extend (`electron/timer.ts:63-73,156,285,294,319`). Boot writes `lastSessionDate`/`sessionCount` on a new day (`timerStore.ts:730-734`). Review's `loadDay` runs `syncCalendarProposals` which can insert/update `calendar_proposals` (`src/stores/logStore.ts:86`, `src/services/calendar.ts:308-316`). Any `loadItems` runs `archiveOldCompleted` (`src/stores/listsStore.ts:53`). These are the only unavoidable writes for a read-only walk.
- Dev safety: POST is hard-blocked at `electron/main.ts:871`; `DRIP_TEST_MODE=1` disables idle nudge (`electron/idleNudge.ts:40`) and Raycast Focus (`electron/raycastFocus.ts:43`). Dev builds `loadURL('http://localhost:5173')` and call `openDevTools()` (`main.ts:128-131`).

---

## 1. Component and file plan

### 1.1 Tokens and fonts (no hex in components)

| File | Change |
|---|---|
| `index.html:9` | Append `&family=Barlow+Condensed:wght@600;700` to the existing Google Fonts URL (same mechanism as Outfit/JetBrains). |
| `src/theme/tokens.js` | Add `drip.ghost: '#16161b'` (ghost 88:88 digits) and `focus.shadow: '#92560a'` (keycap drop). `#1c1c22` and `#2a2a32` already exist as `drip.elevated` / `drip.border`; use them for hairlines (mockup uses elevated for section separators, border for control outlines). |
| `tailwind.config.js` | `fontFamily.condensed: ['Barlow Condensed', 'JetBrains Mono', 'sans-serif']`; `boxShadow['key-amber']: '0 3px 0 <focus.shadow>, inset 0 1px 0 rgba(255,255,255,0.35)'`, `boxShadow['key-dark']: '0 3px 0 #000'`, `boxShadow['key-sm']: '0 2px 0 #000'`, `boxShadow.led: '0 0 5px rgba(245,158,11,0.8)'`, `letterSpacing.label: '1.5px'`. |
| `src/index.css` | Add `.now-digits` (condensed 700, 160px, line-height .8, letter-spacing -3px, `font-variant-numeric: tabular-nums`) and `.now-label` (mono 10.5px 500 tracking 1.5px uppercase). Leave `.focus-timer-display` in place until the old ring is gone, then delete it. |

### 1.2 App shell

| File | Status | What it does |
|---|---|---|
| `src/components/Layout/views.ts` | new | `export type ViewId = 'timer'|'daily-log'|'progress'|'settings'|'lists'|'all-lists'`; `RAIL_ITEMS = [{id:'timer',label:'Now',target:'timer'},{id:'plan',label:'Plan',target:'all-lists',matches:['all-lists','lists']},{id:'review',label:'Review',target:'daily-log'},{id:'insights',label:'Insights',target:'progress'}]` plus settings. Ids unchanged so nothing persisted breaks. |
| `src/components/Layout/Rail.tsx` | new | 72px `nav`, `padding-top: 52px` (clears traffic lights at 16,16), whole rail is `WebkitAppRegion: drag`, each button `no-drag`. Items 56×52, `rounded-[2px]`, active = `bg-focus/10 text-focus` + 4px amber square LED top-right (`shadow-led`), inactive `text-txt-muted hover:text-txt-primary`. Labels `.now-label` (mono uppercase, per your spec; the mockup's Outfit 10.5px is overridden). Settings pinned at bottom (56×44, icon only, `aria-label="Settings"`). Icons: copy the four SVGs from `Sidebar.tsx:34-73` plus the Plan icon from `Main.dc.html:27`. `aria-current="page"` on the active item. Props `{ view: ViewId; onNavigate(view: ViewId) }`. |
| `src/components/Layout/ListsPanel.tsx` | new | Verbatim move of `Sidebar.tsx:83-100,170-264` (expanded branch only): `loadLists()` on mount, "Lists" header + "+" (`onCreateList`), All Tasks (`selectList(null); onNavigate('all-lists')`), per-list rows with colour dot (`selectList(id); onNavigate('lists')`), "Show archived (n) / Hide archived" toggle, archived rows with Restore → `unarchiveList`. Width 212px, `border-r border-drip-elevated`. No restyle of the rows beyond the container. |
| `src/components/Plan/PlanView.tsx` | new | `flex h-full`: `<ListsPanel/>` + `<div className="flex-1 min-w-0">{view==='lists' ? <ListPlanningView/> : <AllListsOverview/>}</div>`. Both hosted views are untouched; `ListPlanningView` already handles "no list selected" (`:163`). |
| `src/App.tsx` | modified | Drop `Sidebar`, `sidebarCollapsed`. `currentView: ViewId`. `renderView`: `lists` and `all-lists` both return `<PlanView view={currentView} onNavigate={setCurrentView} onCreateList={…}/>`; `timer` returns `<Timer onNavigate={setCurrentView}/>`. Keep `MainContent`, `CreateListModal` at root, and all boot effects (`:21-61`) untouched. |
| `src/components/Layout/Sidebar.tsx` | deleted | In the same commit that lands ListsPanel + the Now intention affordance, so no feature is orphaned in between. |
| `src/components/Layout/MainContent.tsx` | unchanged | |

Rail highlight rule: Plan is active when `view ∈ {'all-lists','lists'}`; clicking Plan always goes to `all-lists` (selected list stays in `listsStore` so the panel still highlights it).

### 1.3 Now screen (`src/components/Timer/`)

Keep `Timer.tsx` as the orchestrator (state, effects, handlers `:94-268` stay), rewrite its JSX (`:314-719`) against new presentational pieces. New prop: `onNavigate: (v: ViewId) => void`.

| File | Status | Responsibility |
|---|---|---|
| `NowHeader.tsx` | new | 52px header: `h1 Now`, `Fri 25 Sep`, 84×14 dot-grille (`radial-gradient` with `drip.border`), right: state pill (square, 6px square dot; labels Ready / Focusing / Paused / Break / Kickoff; amber when active, emerald in break). No ⌘K button. Header is `WebkitAppRegion: drag` except its controls. |
| `FocusBlock.tsx` | new | The bordered section: `border border-drip-border border-t-2 border-t-focus` (emerald top rule in break, dimmed `border-t-drip-border` when paused). Left 330px column = `CountdownDisplay`; hairline divider; right column = state-dependent context (see §2). Hairline section header "01 FOCUS" above. |
| `CountdownDisplay.tsx` | new | Label row (`.now-label`): left = state word (+ session window `11:40 → 12:05` when active), right = `SESSION n/8` + 8 session squares (4×4, completed/current amber; replaces the round dots at `Timer.tsx:464-481`). Digits: ghost `88:88` in `drip.ghost` absolutely behind real digits (`role="timer"`, `aria-label="Time remaining"` kept). Colon blink while running (reuse `.colon-blink`). Below: `TickRuler`. |
| `TickRuler.tsx` | new | Replaces the 320px ring (`Timer.tsx:270-296, 363-484`). One tick per minute, majors every 5, labels under majors (00…25 for 25 min; label step 10 for 50, 15 for 90; 15 → 00 05 10 15). Elapsed ticks turn amber; a 1px amber baseline grows via the existing RAF `--progress` variable (`:121-138`, keep that effect and point `clockRef` at the ruler). Paused = fill frozen, dimmed; break = emerald. `aria-hidden`. |
| `DurationSegments.tsx` | restyled in place | Same props/values (15/25/50/90). Joined strip `border border-drip-border`, 52×34 buttons, `aria-pressed`, selected = amber fill, dark text; a 4px LED square centred above the selected button. |
| `KeyButton.tsx` | new | Physical-key button. `variant: 'amber'|'outline'|'ghost'|'danger'`, `kbd?: string` (renders `↵`), `size: 'md'(44px)|'sm'(28px)`. Mono 12.5px, tracking 1.5px, uppercase, `rounded-[3px]`, `shadow-key-amber`/`shadow-key-dark`, `active:translate-y-[2px] active:shadow-none`. |
| `IntentionRow.tsx` | modified | Never returns null in ready states: when empty renders a hairline row with a ghost `SET INTENTION` KeyButton (`onEdit`). This is where the Sidebar button's job moves. When set: `.now-label` "INTENTION" + text + `EDIT`. Remove the `intentions.length > 0 &&` gate at `Timer.tsx:354`; keep `status !== 'break'`. *Revised by owner (parity audit):* no `readonly` and no break gate — the row renders in every state with `SET INTENTION` / `EDIT` live, because the old app allowed editing the intention while focusing, paused and on a break (sidebar button). |
| `ContinuePreviousCTA.tsx` | restyled | Hairline row exactly 44px: `.now-label` "CONTINUE PREVIOUS" + `#id` mono pill (no `#` prefix per rule 6) + title + `CONTINUE →` sm key. `Timer.tsx:359-361` becomes an always-rendered `h-[44px]` slot in ready states (rule 8; today it is 56px and pops in). |
| `TaskPicker.tsx`, `TaskResultList.tsx`, `TaskCardWithPicker.tsx`, `TaskCard.tsx` | restyled only | Square corners, `border-drip-border`, search row with a `/` kbd, hairline section header "02 TASKS" and a "RECENT · by frequency" row. Keycaps `1 2 3` (18×18, `shadow-key-sm`) on the first three rows of the Recent list, visual only in Phase 1 (see Q4). Keep every string and role the tests assert: placeholder `Search task ID or title…`, `role="listbox"`, label text `Recent tasks` / `Searching…` / `All tasks · N` (apply `uppercase` via CSS so `getByText('Recent tasks')` still matches), `.picker-list` class, `maxHeight: 280`, `aria-current` marker. `TaskCardWithPicker` gets one new optional prop `beforeNote?: ReactNode` so the DurationSegments strip can sit between the id row and the note input (mockup order). |
| `TimerDayTimeline.tsx` | restyled | Hour labels mono 10.5px, dashed `border-focus/10` lines (unchanged), blocks `rounded-[2px]` with 1px borders (amber sessions, emerald break bar, blue solid accepted / dashed proposal, dashed adhoc), `hatched-pattern` kept for the active block. Red now-line (`:512-520`) becomes the amber `NOW hh:mm` inverted tag with 7px square. Week header (`:211-268`) restyled to mono (`MON 22`), stats row (`:270-282`) mono. New 12-segment day bar above the grid: `focusMinutes / DAY_TARGET_MINUTES` (constant 360, see Q5), `aria-label` as in the mockup. FAB kept, `rounded-[2px]`. Unscheduled section kept. No logic changes. |
| `TimerTaskList.tsx` | restyled minimally | Segmented control and pills become square/hairline; all filters, search, subtasks, complete checkbox untouched. |
| `NowAside.tsx` | new | 340px aside: header "03 DAY" + joined `TIMELINE | TASKS` toggle (same local state as `Timer.tsx:73,646-669`), body = `TimerDayTimeline` or `TimerTaskList`, footer `N unlogged · REVIEW DAY →`. Count = today's `sessions` with `source!=='break' && logged===0` + `adhocEntries` with `logged===0` + proposals `accepted===1 && logged===0` (mirrors `logStore.ts:110,124,140`). Link: `useLogStore.getState().loadDay(today)` then `onNavigate('daily-log')`. |
| `BoundaryConfirmDialog.tsx` | unchanged file | Fix is in Timer: `onOpenSettings={() => { setShowBoundaryDialog(false); setPendingTaskId(undefined); onNavigate('settings'); }}` replacing `window.location.hash` at `Timer.tsx:699`. |
| `CancelConfirmModal.tsx`, `SetIntentionModal.tsx`, `BillableToggle.tsx` | unchanged | Shared with other views; not restyled in Phase 1. |

New behaviour in `Timer.tsx` (the only additions allowed):
- `KICKOFF 2M` → `startKickoff(KICKOFF_SECONDS)` where `KICKOFF_SECONDS = 120` is exported from `timerStore.ts` (main's `cfg.kickoffSeconds` is also 120). Shown in ready-empty and ready-selected; hidden in break/active. See Q2 for whether the selected task should win.
- Enter = Begin Focus: window `keydown` effect next to the `/` handler (`:105-119`). Fire `handleStart()` only if `e.key==='Enter'`, no modifiers, `focusState==='ready-selected'`, `status==='idle'`, `!pickerOpen`, no modal open (`showBoundaryDialog||showIntentionModal||showCancelConfirm` false), and `document.activeElement` is not `INPUT|TEXTAREA|SELECT` or `isContentEditable`. `preventDefault` when handled.

Delete after the rewrite: nothing else in Phase 1 (dead files from inventory §1.10 stay; not in scope).

---

## 2. Now screen: state-by-state spec

Layout in every state: `NowHeader` → main column (`01 FOCUS` block, then `02 TASKS` section when applicable) + `NowAside` (Timeline|Tasks, footer link). Aside is identical in all states except the active hatched block.

| Element | ready-empty | ready-selected | running | paused | break | kickoff (warmup) |
|---|---|---|---|---|---|---|
| Header pill | Ready (grey) | Ready | Focusing (amber, LED pulse) | Paused (amber, static) | Break (emerald) | Kickoff (amber) |
| Label row left | `READY` | `READY` | `FOCUS · 11:40 → 12:05` | `PAUSED · 11:40 → 12:05` | `BREAK · 12:05 → 12:10` | `KICKOFF · ROLLS INTO 25M` |
| Label row right | `SESSION n+1/8` + squares | same | `SESSION n+1/8`, current square glows | same | `n/8 DONE` | `SESSION n+1/8` |
| Digits | `25:00` (per duration), ghost behind, `txt-primary` | same | counting, colon blinks, `txt-primary` | frozen, `txt-secondary` | emerald | counting `02:00`→ |
| Ruler | scaled to duration, no fill | same | amber fill grows | fill frozen, dimmed | emerald fill | 2-minute ruler (labels 00 01 02); after roll-over it becomes the full ruler (`kickoff==='rolled'` behaves as running) |
| Top rule | amber | amber | amber | `drip.border` | emerald | amber |
| Intention row | `SET INTENTION` ghost key (new entry point) or intention + EDIT | same | same (*Revised by owner (parity audit)*: editable, `SET INTENTION` key when none) | same | same (*Revised by owner (parity audit)*: shown, editable) | as running |
| Continue CTA slot (44px reserved) | CTA if `previousSession` | same | not rendered | not rendered | rendered (preserves today's behaviour; see Q6) | not rendered |
| Right column | placeholder "Pick a task below" + DurationSegments + KeyButtons: `BEGIN FOCUS ↵` disabled, `KICKOFF 2M` | `TaskCardWithPicker` (id — PROJECT / title, collapsible search-in-place, `beforeNote`=DurationSegments, note input), `BillableToggle` (sm), `BEGIN FOCUS ↵` (amber), `KICKOFF 2M` (outline) | readonly `TaskCard` (or intention-only card as `Timer.tsx:531-535`), keys: `PAUSE` outline, `FINISH` outline, `CANCEL` danger-ghost, `+5 MIN` sm | `RESUME` amber, `FINISH`, `CANCEL` | "Take a breather" + `SKIP BREAK` outline | as running (+5 MIN still allowed, as today) |
| 02 TASKS section | `TaskPicker` (search `/`, Recent by frequency, keycaps 1-3) | hidden (picker lives in the card, as today) | hidden | hidden | *Revised by owner (parity audit):* `TaskPicker` when nothing is selected, else `TaskCardWithPicker` + note + `BillableToggle` (no duration strip, no Begin Focus / Kickoff) — as the old app did during a break | hidden |
| Enter shortcut | no | yes (guarded) | no | no | no | no |
| Cancel confirm | – | – | if elapsed > 300 s | same | – | same |

### Parity checklist (inventory §1.3 → new location)

| §1.3 item | New home |
|---|---|
| Focus states derivation (`Timer.tsx:20,81-85`) | unchanged in `Timer.tsx`; add `'kickoff'` only as a display flag from `kickoff==='warmup'` |
| Header Focus/Deep work/Break + Kickoff/Rolls into Nm (`:322-335`) | `CountdownDisplay` label row (strings kept: `Rolls into Nm` → `ROLLS INTO Nm`) |
| State pill (`:336-347`) | `NowHeader` |
| IntentionRow + Edit → SetIntentionModal (`:351-353`) | `IntentionRow` above the focus block; now also the empty affordance |
| Continue-previous CTA (`:222-237,356-358`) | 44px reserved slot above the focus block |
| Clock ring, RAF arc (`:120-138,363-484`) | `TickRuler` (RAF effect retained) |
| +5 min capsule (`:418-433`) | `+5 MIN` sm key in running/kickoff action row |
| Session window (`:436-447`) | label row left |
| MM:SS + 8 dots (`:461-478`) | `CountdownDisplay` digits + 8 squares |
| DurationSegments (`:484-486`) | right column (`beforeNote` slot in ready-selected; standalone in ready-empty) |
| TaskPicker `/`, ↑↓, Enter, Esc, numeric fetch (`:104-118,497-533`) | `02 TASKS` section in ready-empty; `/` handler unchanged |
| Ranked recent tasks (`:23,152-189`) | unchanged data path; rows get keycaps + `todayMinutes` |
| TaskResultList labels/rows/marker | unchanged strings, restyled |
| TaskCardWithPicker (collapsible id row, search-in-place, Fetching slot, note, footer) | right column in ready-selected |
| BillableToggle on selected task (`:196-204,519-521`) | right column under the note |
| Readonly TaskCard during session (`:525-533`) | right column in running/paused/kickoff |
| Boundary check (`:139-150,206-244`) | unchanged; dialog's `Change Settings` → `onNavigate('settings')` |
| Action bar: Begin Focus / Skip Break / Pause / Resume / Finish / Cancel (`:538-637`) | `KeyButton`s in the right column action row |
| Cancel confirm > 300 s (`:245-259`) | unchanged |
| Finish early, break logic, focus complete, session count, hydration (`timerStore`) | untouched |
| Timeline / Tasks toggle (`:643-666`) | `NowAside` header |
| TimerDayTimeline (week nav, grid, stats, blocks, active block, now line, autoscroll, Unscheduled, FAB → AddEntryModal) | `NowAside` body, restyled, logic untouched |
| TimerTaskList (filters, search, pills, completed, subtasks, list.task_id override, select → task + intention `:668-687`) | `NowAside` body; the `onSelectTask` handler stays in `Timer.tsx` |
| SetIntentionModal (`:691-715`) | unchanged, opened from IntentionRow |
| Kickoff header state | label row |
| New: Kickoff 2M, Enter, Review link, Settings fix | as specified |

---

## 3. Test plan

### 3.1 Vitest / RTL

Extend `src/test/setup.ts` stubs (all `vi.fn(async () => …)`): `window.listsAPI` (`getLists`, `getArchivedLists`, `getListItems`, `getBillableForTask → true`, `archiveOldCompleted → 0`, `unarchiveList`, `updateListItem`), `window.dashboardAPI` (`getDailyIntentions → null`, `setDailyIntentions`), `timerAPI` (`getSessions → []`, `getLastSessionWithTask → null`, `startMainTimer`, `stopMainTimer`, `pauseMainTimer`, `resumeMainTimer`, `extendMainTimer`, `updateTrayTime`, `showNotification`, `showSessionOverlay → {shown:false}`, `hideSessionOverlay`), `logAPI` (`getCalendarProposals → []`, `getAdhocEntries → []`, `getCachedTask → null`). Add a `src/test/timerState.ts` helper: `setTimer(partial)` = `useTimerStore.setState({...})` and `resetTimer()` in `afterEach`.

New test files:

`src/components/Layout/Rail.test.tsx`
- renders five items in order Now, Plan, Review, Insights, Settings; `aria-current="page"` on the active one only
- LED element (`data-testid="rail-led"`) present only inside the active item
- clicking each item calls `onNavigate` with `timer` / `all-lists` / `daily-log` / `progress` / `settings`
- Plan is active for `view='lists'` and `view='all-lists'`
- rail root has `WebkitAppRegion: drag`, buttons `no-drag`

`src/components/Layout/ListsPanel.test.tsx` (mock `useListsStore` state via `setState`)
- "+" calls `onCreateList`
- All Tasks → `selectList(null)` + `onNavigate('all-lists')`
- a list row shows its colour dot and → `selectList(id)` + `onNavigate('lists')`
- with 2 archived lists: "Show archived (2)" toggles to rows; Restore calls `unarchiveList(id)`; no toggle when none archived

`src/App.test.tsx` (`vi.mock` DailyLog, ProgressPage, Settings, ListPlanningView, AllListsOverview, Timer to stubs that render their name)
- boots on Now; each rail click renders the matching stub; `PlanView` shows the ListsPanel for both Plan ids; `CreateListModal` opens from the panel "+"

`src/components/Timer/Timer.test.tsx` (render `<Timer onNavigate={nav}/>`; vi.mock `TimerDayTimeline`/`TimerTaskList` to light stubs to avoid layout code)
- ready-empty: `BEGIN FOCUS` disabled, `KICKOFF 2M` enabled, picker listbox visible, `SET INTENTION` button present when intentions empty, Continue slot has `h-[44px]` even with no previous session
- ready-selected (click a picker row): `BEGIN FOCUS` enabled, `BillableToggle` `role=switch` present, note input present, listbox hidden, DurationSegments inside the card slot
- Enter guard: with task selected and body focused → `startMainTimer` called once; with the note input focused → not called; with no task → not called; with `SetIntentionModal` open → not called
- `KICKOFF 2M` → `startMainTimer(120,'focus',…, rollover 1500)` (assert `kickoffRolloverSeconds` arg)
- running (`setTimer({status:'focus', sessionStartTime, totalDuration:1500, remainingSeconds:1200, currentTaskId:'600001'})`): PAUSE / FINISH / CANCEL / `+5 MIN` present, BEGIN FOCUS absent, session window text present, pill "Focusing", `role=timer` shows `20:00`
- paused: RESUME present, PAUSE absent
- Cancel at elapsed 400 s opens `CancelConfirmModal`; at 60 s calls `stopMainTimer` directly
- break (`status:'break'`): `SKIP BREAK` only; no duration strip. *Revised by owner (parity audit):* the intention row stays (editable) and the task picker / selected-task card renders in `02 TASKS` (see fix 2)
- kickoff (`kickoff:'warmup'`): label contains `KICKOFF` and `ROLLS INTO 25M`
- Boundary dialog "Change Settings" → `nav('settings')` (force `enableBoundaryCheck` via `getSettings` stub and a `workdayEndTime` of `00:00`)
- aside footer: with 2 unlogged sessions + 1 logged, text `2 unlogged`; click → `nav('daily-log')`
- IntentionRow with one intention shows text + EDIT; EDIT opens SetIntentionModal

`src/components/Timer/TickRuler.test.tsx`: 25 min → 26 ticks, 6 labels 00…25; 90 min → labels every 15; elapsed 600 s of 1500 → first 10 ticks carry the amber class.

Existing 66 tests: `TaskPicker.test.tsx`, `TaskResultList.test.tsx`, `TaskCardWithPicker.test.tsx` keep passing because strings/roles/`maxHeight` are preserved. If the restyle changes the label to mono uppercase via text (not CSS), update `TaskPicker.test.tsx:29,123` accordingly, but prefer CSS.

### 3.2 E2E smoke (Playwright `_electron`)

Files (outside `src`, so tsc count is unaffected): `e2e/smoke.mjs`, `e2e/db-guard.mjs`, `e2e/screenshots/` (gitignored). npm scripts: `"e2e:smoke": "node e2e/smoke.mjs"`.

Two tiny tooling gates required (test-only, no behaviour change in normal runs):
- `vite.config.ts:14-16`: `onstart(options) { if (process.env.DRIP_E2E !== '1') options.startup() }` so `npx vite` serves the renderer and emits `dist-electron/` without launching its own Electron (which would fight the single-instance lock).
- `electron/main.ts:130`: `if (process.env.DRIP_TEST_MODE !== '1') mainWindow.webContents.openDevTools()`; a docked devtools panel would shrink the viewport and corrupt screenshots.

Flow of `smoke.mjs`:
1. Refuse to run if `DRIP_ALLOW_API_WRITES` is set in the environment, if `pgrep -x Drip` finds the installed app, or if port 5173 is already bound.
2. `db-guard.mjs prepare` (§4 a-b).
3. Spawn `npx vite` with `DRIP_E2E=1`; `npx wait-on http://localhost:5173` and wait for `dist-electron/main.js`.
4. `_electron.launch({ args: ['dist-electron/main.js'], env: { ...process.env, DRIP_TEST_MODE: '1', DRIP_E2E: '1' } })`; capture stdout/stderr to `e2e/screenshots/<ts>/main.log`.
5. `page = await app.firstWindow()`; wait for `nav[aria-label="Primary"]`.
6. For each size in `[[1200,800],[800,600]]` (`app.evaluate(({BrowserWindow},[w,h]) => BrowserWindow.getAllWindows()[0].setSize(w,h))`), walk and screenshot:
   - `now-ready-empty`
   - click first `role=option` in the picker → `now-ready-selected` (skip with a warning if no recent tasks; never type an id, that would hit the API and write `task_cache`)
   - click `SET INTENTION` → `now-intention-modal` → Esc (no add)
   - click `BEGIN FOCUS` → wait for pill "Focusing" → `now-running`
   - click `+5 MIN` (main-process only, no row) → click `PAUSE` → `now-paused` → `RESUME`
   - click `CANCEL` (elapsed < 300 s → no modal, no row) → assert pill "Ready"
   - click `KICKOFF 2M` → `now-kickoff` → `CANCEL` within 60 s (roll-over is at 120 s; `stopKickoff` is never used)
   - break: `app.evaluate(({app}) => app.emit('open-url', {preventDefault(){}}, 'drip://start-break?duration=5'))` (uses `main.ts:191-197` + `timerStore.ts:883`) → `now-break` → `SKIP BREAK` within 60 s (break-complete would save a row after 60 s)
   - aside `TASKS` toggle → `now-aside-tasks`; back to `TIMELINE`
   - rail Plan → `plan-all-tasks`; click first list row if any → `plan-list`; rail Review → `review`; Insights → `insights`; Settings → `settings` (never click Save / Test Connection / Generate)
   - footer `REVIEW DAY →` from Now → assert Review is shown
7. `await app.close()`; kill vite.
8. `db-guard.mjs verify-and-clean` (§4 c-d); non-zero exit on any violation.

Timing guard: the whole Now sequence must finish in < 240 s of wall time per size; assert elapsed on each timer step.

---

## 4. Real-database safety protocol

DB: `~/Library/Application Support/drip/productivity.db` (WAL mode, `db.ts:16`). All user tables are rowid tables with `TEXT PRIMARY KEY` (`db.ts:21-170`), so `max(rowid)` snapshots identify inserts; tables keyed by date (`daily_intentions`, `shutdown_rituals`, `daily_summaries`, `weekly_summaries`) and `settings` are updated in place, so they are snapshotted by content. Use the `sqlite3` CLI (`/usr/bin/sqlite3`, already what the Raycast extension relies on) rather than `better-sqlite3` from Node, which is rebuilt for Electron's ABI and may not load under system Node.

Precondition (printed and enforced): quit the installed Drip first (`main.ts:227` single-instance lock, same `userData`); stop any `npm run dev`.

(a) Backup, per run: `BK=~/Library/Application\ Support/drip/backups/<UTC-ts>`; `sqlite3 productivity.db ".backup '$BK/productivity.db'"` (consistent snapshot including WAL content), then `cp` `productivity.db-wal` / `-shm` if they exist. Print the path. Never delete backups automatically.

(b) Snapshot, written to `$BK/snapshot.json`: `run_start_utc = strftime('%Y-%m-%d %H:%M:%S','now')` from SQLite (so timestamps compare in the DB's own clock); `SELECT max(rowid), count(*)` for `pomodoro_sessions, adhoc_entries, calendar_proposals, list_items, lists, task_cache, log_templates, task_preferences`; full dump of `settings` (key,value); full rows for `daily_intentions`, `shutdown_rituals`, `daily_summaries`, `weekly_summaries`; `SELECT id, archived, completed, "column", "order" FROM list_items` (to detect `archiveOldCompleted` and any accidental moves); `SELECT id, logged, log_sent_at, server_entry_id FROM pomodoro_sessions/adhoc_entries/calendar_proposals WHERE logged=1` counts.

(c) Cleanup + report, after the app has exited:
- Inserts: for each rowid table, `SELECT * WHERE rowid > snapshot.max` → print, then `DELETE` exactly those rowids. Expected: zero in `pomodoro_sessions`, `adhoc_entries`, `lists`, `list_items`, `task_cache`, `log_templates`, `task_preferences`; possibly >0 in `calendar_proposals` (see unavoidable list) — delete only rows with `accepted=0 AND dismissed=0 AND task_id IS NULL AND comment IS NULL` and report any others without deleting.
- Updates: `settings` diff → restore every changed/added key to the snapshot value (`INSERT OR REPLACE`, delete keys that did not exist). Expect `timer_state` and possibly `lastSessionDate`/`sessionCount`. Date-keyed tables: diff against snapshot; restore any changed row; report. `list_items` archived/column/order diff → report only (auto-archive is idempotent app behaviour that the installed app would apply at its next launch; do not revert, see Q7).
- Report: a table of `table | inserted | deleted | updated | restored` plus the backup path, written to `$BK/report.txt` and stdout.

(d) No time entry posted: (1) assert `DRIP_ALLOW_API_WRITES` was absent from the launch env; (2) grep `main.log` for `Posting time entry to:` and `[Safety] Blocked` — both must be 0 (the second would mean a POST was attempted at all); (3) `SELECT count(*) FROM pomodoro_sessions/adhoc_entries/calendar_proposals WHERE log_sent_at >= run_start_utc OR (logged=1 AND rowid > snapshot.max)` must be 0 and logged counts must equal the snapshot.

Data the e2e creates (unavoidable, all handled above): `settings.timer_state` on every timer action; `settings.lastSessionDate/sessionCount` if the run is the first launch of the day; `calendar_proposals` inserts/updates from the ICS sync on Review and on Now's `loadSessions` (network to the ICS URL also happens); `list_items.archived` flips from `archiveOldCompleted`; `calendar-feed-cache.ics` file rewrite. Everything else in the flow is read-only by construction (verified against `timerStore.ts:628-656` for cancel, `:482-510` for skip, `:199-204` for kickoff, `:250-292` for break start).

---

## 5. Build sequence (one commit each; each ends with `npm test` = 66+ green, `npx tsc --noEmit | grep -c "error TS"` ≤ 39, `npx vite build` OK)

1. **Tokens + fonts + test stubs.** `tokens.js`, `tailwind.config.js`, `index.css` classes, `index.html` font, `setup.ts` stubs, `timerState.ts` helper. No UI change.
2. **Rail + views.ts + App routing.** Add `Rail.tsx`, `views.ts`, `Rail.test.tsx`, `App.test.tsx`; App renders Rail alongside the old Sidebar temporarily hidden? No: keep it simple, App switches to Rail but `Sidebar` still exists on disk unreferenced for one commit. Timer gets the `onNavigate` prop and the BoundaryConfirmDialog fix.
3. **ListsPanel + PlanView; delete Sidebar; intention affordance.** `ListsPanel.tsx`, `PlanView.tsx`, `ListsPanel.test.tsx`; `IntentionRow` empty state; `git rm Sidebar.tsx`. From here nothing is lost.
4. **KeyButton, TickRuler, CountdownDisplay, DurationSegments restyle** (+ `TickRuler.test.tsx`), not yet wired into Timer.
5. **Timer JSX rewrite: FocusBlock + NowHeader for ready states** (ready-empty, ready-selected), including Enter shortcut, KICKOFF 2M, 44px Continue slot; `Timer.test.tsx` ready/shortcut/kickoff cases. Picker/card restyle in the same commit (they are what the ready states show); the three existing picker test files must stay green.
6. **Running / paused / break / kickoff states** in FocusBlock; Timer tests for those states, cancel confirm, +5 min.
7. **NowAside**: toggle, `TimerDayTimeline` restyle (NOW tag, 12-segment bar), `TimerTaskList` hairlines, footer link; tests for count + navigation.
8. **E2E tooling**: vite.config and devtools gates, `e2e/db-guard.mjs`, `e2e/smoke.mjs`, npm script, `.gitignore` entry for `e2e/screenshots/`. Run it once with the installed app quit; attach the report and screenshots to the review.
9. **Cleanup**: delete `.focus-timer-display`, `.led-running` if unused; update `Prompts & Docs/UI_DESIGN_SYSTEM.md` with the Now tokens (KeyButton, hairline, LED) so Phase 2 has a reference.

---

## 6. Risks and open questions for the owner

**Q1. Ruler scale for 15/50/90-minute sessions.** The mockup is hard-wired to 25. Recommendation: one tick per minute, majors every 5, labels every 5 (15/25), 10 (50), 15 (90). Alternative: always 26 ticks as percent with minute labels, which produces odd labels (18, 36…) for 90.

**Q2. KICKOFF 2M with a selected task.** `startKickoff` (`timerStore.ts:199-204`) ignores the UI selection and uses current > today's last session > `lastTaskId`. Recommendation: when a task is selected, pass it (`startFocus(selectedTask.task_id, currentBillable, false, 120)`, which is the same call `startKickoff` makes internally); otherwise call `startKickoff(120)` verbatim. Also: kickoff bypasses the boundary check (as the nudge path does today). Confirm both.

**Q3. Ready-selected layout.** To keep `TaskCardWithPicker` and its 3 tests intact, the `02 TASKS` section is hidden once a task is selected and re-selection goes through the card's search-in-place (today's behaviour). The mockup shows the Tasks list under a selected task. Recommendation: accept the conservative version for Phase 1; revisit with the Today group in Phase 2.

**Q4. Keycaps 1-3.** In the mockup they number Today's 3 (out of scope). Recommendation: render them on the first three Recent rows as visual affordances only, no key binding (binding would be new behaviour). If you would rather not ship inert keycaps, drop them until Phase 2.

**Q5. 12-segment day bar denominator.** There is no capacity setting (capacity lines are out of scope). Recommendation: constant `DAY_TARGET_MINUTES = 360` in `TimerDayTimeline` labelled `focus / 6h`; wire it to a setting in Phase 2.

**Q6. Continue CTA during break.** Today the CTA renders in break because `focusState` is still `ready-*` (`Timer.tsx:359`), and pressing it starts a focus without saving the break. Recommendation: preserve as is (hard rule), but flag as a candidate fix.

**Q7. `archiveOldCompleted` side effect in e2e.** The Plan walk flips `list_items.archived` for completed items older than 7 days; the installed app would do the same at its next launch. Recommendation: report, do not revert. Say so if you want it reverted instead.

**Q8. 800×600.** With a 72px rail and 340px aside, the focus block gets ~390px, too narrow for 160px digits plus the right column. Recommendation: below 1000px window width, aside shrinks to 280px, digits scale to 120px, and the right column wraps under the digits. The 800×600 screenshots will confirm.

**Q9. Section labels.** You wrote `01 FOCUS · SESSION n/8`; the mockup shows `READY` / `SESSION 3/8`. Recommendation: hairline section headers `01 FOCUS`, `02 TASKS`, `03 DAY`, and the label row inside the block shows the state word (`READY`, `FOCUS`, `PAUSED`, `BREAK`, `KICKOFF`) on the left and `SESSION n/8` on the right.

Risks: `Timer.tsx` is a 718-line rewrite of JSX with an untested store behind it (inventory §5.1); the state-by-state tests in §3.1 are the guard. `TimerDayTimeline` overlap maths must not be touched while restyling. The picker tests assert an inline `maxHeight: 280` and `.picker-list`; keep those or update the test in the same commit.

### Critical Files for Implementation
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/components/Timer/Timer.tsx`
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/App.tsx`
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/components/Layout/Sidebar.tsx` (source for `Rail.tsx` + `ListsPanel.tsx`, then deleted)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/stores/timerStore.ts`
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/components/Timer/TimerDayTimeline.tsx`

---

## 7. Owner decisions (2026-09-25)

- Q1 Ruler: accepted. One tick per minute, majors every 5, labels every 5 (15/25), 10 (50), 15 (90).
- Q2 Kickoff: accepted. The selected task wins; otherwise the task comes from `startKickoff(120)`. Kickoff bypasses the boundary check.
- Q3 Ready-selected: accepted, conservative. The Tasks section hides once a task is selected; re-select through the card.
- Q4 Keycaps 1-3: DROP for Phase 1. No inert affordances. They come back with Today's 3 in the task-hygiene phase.
- Q5 Day bar: 12 segments of 30 minutes against a constant `DAY_TARGET_MINUTES = 360`, labelled `FOCUS / 6H` (owner confirmed 6h). It may become a setting later.
- Q6 Continue CTA during break: preserve as is and flag in the report.
- Q7 archiveOldCompleted: report, do not revert.
- Q8 Below 1000px: accepted. Aside 280px, digits 120px, right column wraps.
- Q9 Labels: accepted. Section headers `01 FOCUS` / `02 TASKS` / `03 DAY`; the block label row shows state + SESSION n/8.

### Owner decisions (2026-09-28, post-1.1.0 fixes)

- Q10 Break = ready for the next task. Supersedes §2's break rows (no duration strip / Begin Focus in break). During a break the state column matches ready: duration strip, task card + note + billable, `Begin Focus ↵` (disabled with `title="Pick a task first"` until a task is picked) next to `Skip Break`; no Kickoff. Begin Focus / Enter first saves the break so far as a `break` row when it ran ≥ 1 min (`timerStore.startFocusFromBreak`), then starts the focus. A length picked mid-break changes only the next focus. Continue previous keeps Q6 (no break row).
- Q11 Break pill: main hides the overlay's `break-running` pill on every break → non-break transition of its timer (`electron/timer.ts` `setStatus` → `overlayWindow.hideBreakPill`): Skip break, `drip://skip-break` / `stop`, a focus started mid-break, the break's own end. Pausing keeps it.
- Q12 02 Tasks has a `Recent tasks | Planned` switch (also in the card's picker): Planned = Plan's open Today then This week items, grouped, list name on the right, `No task ID` for items with none. Opens on Planned when something is planned; the choice persists (`localStorage` `now_pickerSource`). Picking one works like `Start on` (task selected, item title → note); an item with no task only sets the note and keeps the picker open.
- Q13 One project name on the task card (header `id — project`); the bottom line keeps only `Today · n/8 sessions`.
- Q15 The Now window mirrors the session-end card, for when that card is on another screen: after a focus completes (or finishes early) Now prompts for the break — pill `Break due`, label `SESSION DONE`, the line `Session done. Take a N-minute break, or pick the next task below`, and `Start break Nm` as the amber primary key (Begin Focus drops to outline) (`timerStore.pendingBreakMinutes`, set by the completion, cleared by any break / focus start, reset or the card's dismiss); it runs `startBreakFromModal`, so an open card collapses into the break pill. During a break Now has `Pause` / `Resume` (label `BREAK · PAUSED`) next to `Skip Break`.
- Q14 `SetIntentionModal`: `Done` and a backdrop click save a typed draft; Esc and × discard it; a failed save shows `role=alert` and keeps the modal.

## 8. Roadmap scope (owner, 2026-09-25)

Only surfaces covered by the design proposal get redesigned:
- Phase 1: rail + Now
- Phase 2: Plan
- Phase 3: Review
- Phase 4: idle nudge + Kickoff overlays

Settings, Insights (Progress) and every other view are out of scope. They stay hosted unchanged behind the rail.

## 9. Calm running state — added by owner (2026-09-26)

Spec: `mockups/Running.dc.html` (880×360, "Focus running — calm state"). The two-column focus block felt crowded while a session runs. Running, paused and the kickoff warmup on Now become a single column inside the same bordered block; ready states and break keep the split layout (`CountdownDisplay` + right column) untouched.

### Mapping (mockup → code)

| Mockup element | Implementation |
|---|---|
| Single-column block, amber top rule | `FocusBlock` gets an optional `countdown`; without it the section renders its children in one column (same border / top rule / padding). Top rule stays `dim` when paused |
| Header row: LED dot + `FOCUS`, task id, spacer, `ENDS 22:06` | New `ActiveFocus.tsx` (`data-testid=focus-header`): `.now-label`, state word in `text-focus` with the 4px LED (`bg-focus shadow-led`; `bg-txt-dim` when paused, word `PAUSED` in muted), id mono muted (never `#`), `ENDS <primary>hh:mm</primary>` from `sessionStartTime + totalDuration` (so `+5 min` moves it; paused keeps it, as the old `PAUSED ·` window did). Kickoff: word `KICKOFF`, right side `ROLLS INTO 25M` (existing semantics) instead of ENDS |
| Title 28px Outfit 500 | `font-display text-[28px] font-medium leading-[1.2] tracking-[-0.3px] truncate` with `title=`. Falls back to the intention text (secondary, 15px) or `No task attached` (muted) exactly as the old right column did. A session note, when set, stays as the quiet 13px `border-l-2` line under the title (parity; not in the mockup) |
| Countdown 124px + ruler at 330px, labels 00/05/10/15 | Existing `.now-digits` (160px, 120px below `wide:`) over the ghost `88:88`, extracted into `CountdownDigits.tsx` and shared with `CountdownDisplay`; `TickRuler` directly beneath in the same `w-full wide:w-[330px]` group, `ref={clockRef}` so the RAF `--progress` wiring is unchanged; `dimmed` when paused |
| PAUSE solid light keycap | `KeyButton variant="light"` (new: `bg-txt-primary text-drip-bg shadow-key-light`, token `key-light: 0 3px 0 txt.dim`). Paused: `RESUME` uses the same light key |
| FINISH outline keycap | `KeyButton variant="outline"` (unchanged) |
| `+5 MIN`, `CANCEL` quiet text buttons | `KeyButton variant="text"` (new: no border, no drop edge, `text-txt-secondary` → primary on hover) and `variant="text-danger"` (muted → `text-alert` on hover). `+5 min` only while running (kickoff included), never paused; Cancel keeps the > 300 s confirm |
| Radii | mockup 3px → existing `KeyButton` `rounded-[3px]`; nothing else rounded |

### Dropped from running / paused / kickoff by design
- The start time (`11:40 →`) — only `ENDS hh:mm` remains.
- `SESSION n/8` + the 8 squares (still shown in ready states and in break).
- Project name: today's running card already passes `project_name: null`, so nothing visible is lost.

### Kept exactly (parity checks — each has a test)
- Pause ⇄ Resume, Finish (`finishEarly` + selection cleared), Cancel (confirm when elapsed > 300 s, immediate otherwise), `+5 min` → `extendMainTimer(300)` only while running.
- RAF-driven ruler progress (`clockRef`, `--progress`), ruler scale = `totalDuration` (2 minutes in kickoff, full duration after roll-over).
- Intention row with SET INTENTION / EDIT above the block in every state; NowHeader pill; aside; keyboard handlers; billable state; `01 FOCUS` section header; break layout; Q8 responsive rules (digits group is full width below `wide:`, the action row wraps).
- e2e `smoke.mjs` selectors (`/^pause$/i`, `/^resume$/i`, `/\+5 min/i`, `/^cancel$/i`) unchanged.

### Tests
- Updated (assertions that pinned removed elements): running window label `FOCUS · 11:40 → 12:05` → header `FOCUS` + id + `ENDS 12:05`; `PAUSED ·` → header `PAUSED` + ENDS; kickoff `KICKOFF · ROLLS INTO 25M` single text node → header text; kickoff compact counter / squares → no counter, no squares; running `SESSION 1/8` → no counter, no start time.
- Added: header row per state, key set + variants per state, `+5 min` absent while paused, ruler present with the `--progress` wiring, no-task fallbacks.
