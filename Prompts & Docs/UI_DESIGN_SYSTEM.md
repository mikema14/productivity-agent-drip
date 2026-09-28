# Drip UI Design System

Token and pattern reference for the redesign language (rail + Now, Plan, Review, overlay nudge and
kickoff takeover). The rules themselves — what is allowed, what is forbidden, the design context — live
in the project `CLAUDE.md` §6; this file says *which class* implements each rule and records the
per-screen patterns that shipped. When the two disagree, `CLAUDE.md` wins and this file is stale.

## Tokens

Colours come from `src/theme/tokens.js` (`COLOR`), which both `tailwind.config.js` and the overlay
renderer's inline styles (`src/overlay/glass.ts`) import. Components never carry hex values.

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `drip.bg` | `#0a0a0c` | `bg-drip-bg` | window / takeover background |
| `drip.surface` | `#141418` | `bg-drip-surface` | cards that need a fill |
| `drip.elevated` | `#1c1c22` | `bg-drip-elevated`, `border-drip-elevated` | dropdown fill; **section hairlines** |
| `drip.border` | `#2a2a32` | `border-drip-border` | **control outlines**, dot grille, empty day-bar segments |
| `drip.ghost` | `#16161b` | `text-drip-ghost` | the unlit `88:88` behind the countdown |
| `focus` | `#f59e0b` (`light #fbbf24`, `dark #d97706`, `shadow #92560a`) | `text-focus`, `bg-focus`, `border-focus/30`, `bg-focus/10`, `hover:bg-focus/5` | the one accent: active state, current item, primary key, id pills, Today container |
| `break` | `#34d399` | `text-break`, `border-break/40`, `bg-break/15` | break state, done checks, logged rows |
| `alert` | `#ef4444` (`light #f87171`) | `text-alert`, `border-alert/40` | errors, Delete hover, the idle nudge |
| `blue-500` / `blue-400` | Tailwind | `border-blue-500/40`, `bg-blue-400` | calendar rows and blocks only |
| `txt` | primary `#f0f0f2` · secondary `#a0a0b0` · muted `#8585a0` · dim `#45455a` | `text-txt-*` | type hierarchy; `border-txt-dim` on outline keys |

| Token | Tailwind / CSS | Notes |
|---|---|---|
| Fonts | `font-display` Outfit · `font-mono` JetBrains Mono · `font-condensed` Barlow Condensed 700 | loaded from Google Fonts in `index.html` |
| `.now-digits` | condensed 700, 160px (120px below `wide:`), line-height .8, tabular | countdown; the takeover overrides to 240px |
| `.now-label` | mono 10.5px 500, `tracking-label` (1.5px), uppercase via CSS | every micro-label and section header; source text stays sentence-case |
| Radii | `rounded-[2px]` surfaces and pills, `rounded-[3px]` keys, none on hairlines | no `rounded-xl` / `rounded-full` on redesigned surfaces |
| Shadows | `shadow-key-amber`, `shadow-key-dark`, `shadow-key-sm` (keycap drop edges), `shadow-led` (4px LED) | `shadow-glass` remains only on the old modals |
| Breakpoint | `wide:` = 1000px | aside 280px / digits 120px / horizontal scroll below it |
| Motion | `transition-* duration-150` (200 max), `active:translate-y-[2px] active:shadow-none` on keys, `.colon-blink` 1 s, `led-running` pulse | glow / breathe only for the timer state |
| Overlay glass | `GLASS` (fill, blur, `radiusCard` 24, `shadowCard`, `haloAlert`), `CARD_W` 440, `WINDOW` 560×400 inset 44 | overlay window only; not the main-window language |

## Shared primitives

Reuse these; never re-implement one inline.

| Primitive | File | Contract |
|---|---|---|
| `KeyButton` | `src/components/Timer/KeyButton.tsx` | `variant` amber / outline / ghost / danger, `size` md (44px) / sm (28px), `kbd` hint; mono uppercase, `rounded-[3px]`, keycap drop edge, presses in; `disabled:opacity-40` |
| `Pill` | `src/components/shared/Pill.tsx` | 26px hairline toggle, `aria-pressed`; pressed `border-focus/30 bg-focus/10 text-txt-primary` |
| `SectionHeader` | `src/components/Timer/FocusBlock.tsx` | `.now-label text-txt-muted` label + `border-t border-drip-elevated` hairline + optional right slot (`01 Focus`, `02 Tasks`, `03 Day`) |
| Id pill | `TaskIdBadge plain` (`src/components/shared/TaskIdBadge.tsx`) or inline `font-mono text-[12px] text-focus bg-focus/10 rounded-[2px] px-1.5` | never a `#`; cached title as `title=` |
| `BillableToggle` | `src/components/shared/BillableToggle.tsx` | `role=switch` pill, sizes; the only billable control (lists, items, entries, timer) |
| `TickRuler` | `src/components/Timer/TickRuler.tsx` | one tick per minute, majors every 5, labels every 5 / 10 / 15 for 15–25 / 50 / 90 min; amber fill via `--progress`, emerald in break |
| LED | `w-1 h-1 bg-focus shadow-led` | active rail item, selected duration, current session square |
| Joined segmented control | `border border-drip-border`, children `border-l border-drip-border`, active `bg-focus text-drip-bg` | `DurationSegments`, aside tabs, List \| Timeline |
| Hover actions | `.plan-card-actions` / `.row-actions` (`src/index.css`) | `opacity-0 pointer-events-none` until `group-hover` / `group-focus-within` — hidden actions never catch clicks |
| Hairline pill | `border-drip-border rounded-[2px] px-2.5 py-1 text-[12px]` + 6px square dot | header state pills (`NowHeader`), takeover Raycast pill |
| Quiet scroller | `.scroll-x-quiet` | toolbars that must not wrap below `wide:` |
| Key hints | `hooks/useWindowFocus` | print `↵` / `esc` only while `document.hasFocus()`; the binding exists regardless |

## Legacy surfaces

Settings (`src/components/Settings/*`), Insights (`src/components/Progress/*`) and the modals the mockups
do not draw (`AddEntryModal`, `EndDayModal`, `TemplateManagerModal`, `CalendarPopover`, `LogTimeModal`,
`CreateListModal`, `SetIntentionModal`, `CancelConfirmModal`, `BoundaryConfirmDialog`) keep their older
`rounded-xl` / `shadow-glass` / `bg-focus/5` styling. Leave them alone unless a task names them; when you
do touch one, re-token to `rounded-[2px]` + hairlines, drop emoji or `#` prefixes, and change nothing
else. No `glass-*` utility classes exist any more; do not reintroduce them.

---

## Now Screen Tokens (Phase 1 redesign)

The rail + Now screen introduced the square, hairline language every later screen reuses. Owner decisions Q1–Q9 are recorded in `Redesign/PHASE1_PLAN.md` §7. Shared primitives are described above; this table records the Now-specific patterns.

| Element | Tailwind / class |
|---------|------------------|
| **Micro-label** (state words, section headers, rail labels) | `.now-label` — mono 10.5px, 500, `tracking-label` (1.5px), uppercase via CSS (keep source text sentence-case so tests match) |
| **Section header** | `SectionHeader` in `Timer/FocusBlock.tsx`: `01 Focus` + `border-t border-drip-elevated` hairline, optional right slot |
| **Countdown digits** | `.now-digits` — `font-condensed` (Barlow Condensed 700) 160px, 120px under 1000px (`wide:` breakpoint); ghost `88:88` behind in `text-drip-ghost` |
| **Key button** | `KeyButton` (`Timer/KeyButton.tsx`) — `variant` amber / light (solid `txt-primary` keycap) / outline / ghost / danger / text / text-danger (quiet, no border or drop edge), `size` md (44px) / sm (28px), optional `kbd`, `data-variant` for tests. Drop edge `shadow-key-amber` / `shadow-key-light` / `shadow-key-dark`, presses in with `active:translate-y-[2px] active:shadow-none` |
| **Calm running block** | `Timer/ActiveFocus.tsx` inside `FocusBlock` without a `countdown` (single column; `data-layout=calm`): `.now-label` header `data-testid=focus-header` — 4px LED (`bg-focus shadow-led`, `bg-txt-dim` paused) + `Focus` / `Paused` / `Kickoff`, task id (never `#`), spacer, `Ends <primary>hh:mm</primary>` (kickoff: `Rolls into Nm`); title `font-display text-[28px] font-medium leading-[1.2] tracking-[-0.3px] truncate`; `CountdownDigits` + `TickRuler` in a `w-full wide:w-[330px]` group; keys `light` Pause / Resume, `outline` Finish, spacer, `text` +5 min (running only), `text-danger` Cancel. Ready and break keep the split `CountdownDisplay` layout with the session counter (PHASE1_PLAN.md §9) |
| **LED** | 4px square `bg-focus shadow-led` (active rail item, selected duration, current session square) |
| **Hairline separator** | `border-drip-elevated` (section separators) / `border-drip-border` (control outlines) |
| **Focus block top rule** | `border-t-2 border-t-focus`; `border-t-break` in break; `border-t-drip-border` when paused |
| **Joined segmented control** | `border border-drip-border`, children `border-l border-drip-border`, active `bg-focus text-drip-bg` (DurationSegments, aside tabs, task-list filters) |
| **Id pill** | `font-mono text-[12px] text-focus bg-focus/10 rounded-[2px] px-1.5` — never a `#` prefix (CLAUDE.md §6 rule 4) |
| **Timeline blocks** | `rounded-[2px]` 1px borders: focus `border-focus/30-40`, break `border-break/40`, calendar `border-blue-500/40` (dashed = proposal), adhoc dashed `border-focus/30` |
| **NOW marker** | 7px `bg-focus` square + 1px amber line + inverted `NOW hh:mm` tag |
| **Day bar** | 12 × `h-1.5` segments, `bg-focus` filled / `bg-drip-border` empty, against `DAY_TARGET_MINUTES = 360` |

---

## Plan Screen Tokens (Phase 2 redesign)

Plan reuses the Now language (square corners, hairlines, `.now-label`, `KeyButton`). Owner decisions P1–P21 are recorded in `Redesign/PHASE2_PLAN.md` §9.

| Element | Tailwind / class |
|---------|------------------|
| **Plan header** | `Plan/PlanHeader.tsx` — 52px drag region, `h1` 15px/500 + `Week 39 · <mono>21–27 Sep</mono>` (static ISO week, no arrows) |
| **Lists aside** | `Layout/ListsPanel.tsx` — `aside[aria-label=Lists]` 212px, `p-3 pt-4`, `.now-label` header + 24px `New list` key; rows `rounded-[2px]`, active `bg-focus/10 text-focus`, idle `hover:bg-focus/5`; subtitle `logs to <id>` (mono 10.5px) / `billable` / `not billable`; open count mono 11.5px; bottom `Archived · n` (`aria-pressed`) |
| **Sub-header** | `Plan/PlanSubheader.tsx` — 48px, `border-b border-drip-elevated`, `px-7`; all scope `All tasks` 13.5px/500 + `N across M lists` muted; list scope dot + name + id pill + `BillableToggle sm` + hairline + remaining + Archive icon key |
| **Pill toggle** | `Pill` in `PlanSubheader.tsx` — 26px, `border-drip-border rounded-[2px]` 12px, pressed `border-focus/30 bg-focus/10 text-txt-primary`, `aria-pressed` (Group by list / Done / IDs / list filters) |
| **Board grid** | `p-6 gap-3`; `flex overflow-x-auto` with `min-w-[220px]` columns below `wide:`, `wide:grid wide:grid-cols-3` (`-4` with Done) above |
| **Column** | `Plan/BoardColumn.tsx` — `section[aria-label]`, `border border-drip-elevated rounded-[2px] p-3.5`; Today `border-focus/30` with an amber `.now-label`; count mono 12px `{open}` + muted `· {done} done`; subtitle 12px muted (capacity / week line); list-scope progress bar `h-1 bg-focus/10` filled in the list colour |
| **Group row** | `.now-label text-txt-muted` + mono count (list groups carry the colour dot; backlog groups `New this week` / `Older than 14 days` / `Everything else`) |
| **Card** | `Plan/TaskCard.tsx` — `.plan-card` `border border-drip-elevated hover:border-drip-border rounded-[2px] px-3 py-2.5`; row 1 title 13.5px `hover:text-focus`, row 2 `pl-[22px]` 11.5px muted: id pill (`TaskIdBadge plain`, mono amber, never `#`) or `No task ID` · list · `from call · <date>` · `Nd` · tracked time mono |
| **Complete control** | 14px `rounded-[2px]` button: 7px dot in the list colour at rest, hairline checkbox on card hover / focus, done = `bg-break/15 text-break` check; done cards `opacity-50` + `line-through` |
| **Hover actions** | `.plan-card-actions` (`index.css`): `opacity-0`, visible on `group-hover` and `group-focus-within`; 24px icon keys `hover:bg-focus/10`, Delete `hover:text-alert` |
| **Move-to-list menu** | `role=menu` `bg-drip-elevated border-drip-border rounded-[2px]`, current list `text-focus` + tick |
| **Dashed footer** | 52px `border border-dashed border-drip-border rounded-[2px]` 12.5px muted: `Add a task` (list scope, opens `AddItemInline` in place) / `Drop a task here` (all scope); `Drop here` + `border-focus/40 text-focus` during a drag |
| **Start on CTA** | `Plan/StartOnCTA.tsx` — `KeyButton variant=amber size=md` full width under Today's cards, `Start on <id>`; hands the task to Now via `timerStore.pendingSelection` |
| **Capacity line** | `boardLogic.capacityLine` — `3h 05m focus · 2h 55m to 6h` (`formatMinutesPadded`) against `DAY_TARGET_MINUTES` from `TimerDayTimeline.tsx` |
| **Drag overlay** | `bg-drip-elevated border-focus/30 rounded-[2px]` with the 7px list dot + title |

## Review Screen Tokens (Phase 3 redesign)

Review reuses the Now / Plan language (2px radii, hairlines, `.now-label`, `KeyButton`, `Pill`). Owner decisions R1–R21 are recorded in `Redesign/PHASE3_PLAN.md` §9. This screen posts time entries to Easy8: the `post-time-entry` guard in `electron/main.ts` and the dev throw in `src/services/api.ts` are never touched, and every log path is tested through the IPC stub only.

| Element | Tailwind / class |
|---------|------------------|
| **Review header** | `DailyLog/ReviewHeader.tsx` — 52px drag region, `h1 Review` 15px/500, `‹ Fri 25 Sep ›` 13px with muted `· Today`, date button opens `CalendarPopover`; `Sync calendar` 26px icon key (`animate-spin` while syncing); stats right: `<mono>5h 40m</mono> tracked · billable · <amber>N</amber> to log` + `Nm break` / `N logged` only when > 0 |
| **Layout** | `flex flex-col h-full` → header → `flex flex-1 min-h-0` → main `p-7 gap-5 flex flex-col overflow-hidden` (`TodaysThree` + `EntriesTable`) + `TomorrowAside` |
| **Today section** | `DailyLog/TodaysThree.tsx` — `section[aria-label=Today]` `border border-focus/30 rounded-[2px] p-3.5`; `.now-label text-focus` `Today · N` (no caps), subtitle `Carry-overs stay in Today`; 48px rows: `TaskIdBadge plain` or `No task ID`, 14px title (done: muted + `line-through`), outcome `role=group aria-label=Outcome` of four 24px `Pill`s — Done ⇔ completed, Carry ⇔ open (no write), To week → `this_week`, Drop → `backlog` (never deletes) |
| **Entries table** | `DailyLog/EntriesTable.tsx` — `section[aria-label="Time entries"]` `border border-drip-elevated rounded-[2px]`; 40px toolbar (`List | Timeline` joined `now-label` tabs with `aria-pressed`, `Group by task` Pill in list mode, right: `Select all` / `Unselect all`, `Move to…` when marked, `Templates`); body `overflow-auto` with `min-w-[640px] wide:min-w-0`; 60px footer `<mono>N</mono> selected · <mono>1h 45m</mono> · <amber>M need a task</amber>` + `KeyButton outline` `+ Entry` + `KeyButton amber` `Log N to Easy8` (disabled + `title="Mark entries to log"` at 0, `Logging…` in flight) |
| **Row grid** | `EntryRow.ROW_GRID` = `grid-cols-[52px_44px_150px_minmax(0,1fr)_84px_28px_88px] gap-3 px-4`; column header 38px `.now-label` (list mode only); rows `min-h-[48px] border-b border-drip-elevated`, `hover:bg-focus/[0.03]` |
| **Row cells** | time / dur mono 12px; 6px dot (`bg-focus` work, `bg-blue-400` calendar, `bg-break` break) + id pill mono 12px amber (never `#`, cached title as `title=`) or dashed `Assign task` key or `No task`; comment 13.5px = title + muted `· comment` when it differs + `N sessions` badge when merged; `Billable` Pill (`aria-pressed`, live write, `rounded-full`) or static `Billable` / `Not billable` on logged rows; log = checkbox `accent-focus` / disabled on proposals / emerald check `Logged` on logged rows |
| **Row states** | proposal `bg-focus/[0.04]` + `data-kind=proposal`; break / logged `text-txt-muted`; `data-kind` ∈ `open` `proposal` `logged` `break` |
| **Hover actions** | `.row-actions` (same CSS rule as `.plan-card-actions`): Accept (`text-break`) / Dismiss on proposals; Edit / Move / Delete (`hover:text-alert`) on open rows |
| **Inline editor** | `data-testid=entry-editor` `px-4 py-3 bg-focus/5 border-y border-focus/20`: `TaskIdInput`, Title, Duration, Comment (`h-8 px-3 text-sm rounded-[2px] border-drip-border`), `BillableToggle sm`, `KeyButton sm` Save (amber) / Cancel (ghost) |
| **Log errors** | per row `role=alert` 24px `text-alert` with the server message; 401 / API not configured add `Open Settings` (underline) and a `data-testid=auth-banner` above the table (`border-alert/40 rounded-[2px]`) |
| **Success toast** | `fixed bottom-4 right-4 bg-drip-elevated border-break/40 text-break rounded-[2px]` — `✓ N entries logged` + `View in Easy Project →` (`reviewLogic.buildEPLink`) |
| **Timeline view** | `DailyLog/TimelineView.tsx` — 80px hours, `rounded-[2px]` blocks (`bg-focus/10 border-focus/30`; calendar `border-blue-500/40`, proposals dashed; adhoc dashed `border-focus/30`; break `bg-break/10 border-break/40`), amber `NOW hh:mm` tag (Now pattern), `Unscheduled` `.now-label` section |
| **Tomorrow aside** | `DailyLog/TomorrowAside.tsx` — `aside[aria-label=Tomorrow]` `w-[280px] wide:w-[320px] p-6 border-l border-drip-elevated`; `Tomorrow · <muted>Mon 28 Sep</muted>` (next workday); `.now-label` groups `Starts in Today` (40px hairline rows, `Nothing carried over`), `Calendar` (`<mono blue>N</mono> meetings · 1h 30m` / `4h 30m free of 6h` from `DAY_TARGET_MINUTES`, or `Calendar unavailable`), `One line on today` textarea (`border-focus/30 rounded-[2px]`, seeds `EndDayModal.initialReflection`); `KeyButton amber` `End day` full width or 44px hairline `Day ended` + saved reflection |
| **Modals** | `AddEntryModal`, `EndDayModal`, `TemplateManagerModal`, `CalendarPopover` keep their layouts with `rounded-[2px]`, no emoji section prefixes and no `#` on task chips |


## Overlay & Kickoff Tokens (Phase 4 redesign)

The idle nudge lives in the always-on-top overlay window (inline styles from `src/overlay/glass.ts` + `parts.tsx`, no Tailwind); the kickoff takeover is a layer of the main window and reuses the Now tokens. Owner decisions N1–N5, K1–K8, E1–E3, D1 are recorded in `Redesign/PHASE4_PLAN.md` §9 (K3 overridden: the takeover keeps working controls).

| Element | Style |
|---------|-------|
| **Nudge shell** | `overlay/IdleNudgeCard.tsx` — the session-end `GLASS` card (fill, `blur`, `radiusCard` 24, `drip-arrive`) at `CARD_W` 440 with `1px solid withAlpha(ALERT.base, .45)` and `boxShadow: GLASS.shadowCard + GLASS.haloAlert` (`0 0 0 4px rgba(239,68,68,.06), 0 0 48px rgba(239,68,68,.16)`); red radial wash at the top. `role=alertdialog`, `data-testid=idle-nudge` |
| **Nudge header** | 6px `ALERT.base` dot + `label(ALERT.light, 600)` `Idle` · spacer · mono 11.5px muted `takeover in` + `ALERT.light` `mm:ss` (`nudgeCopy.takeoverIn`, ticks on the 1 s clock) · `DismissButton` |
| **Nudge title / copy** | `Nothing running · <mono 400>12m</mono>` 22px/500 (`data-testid=nudge-title`); 13px `TXT.secondary` copy from `nudgeCopy.explain` — four shapes, the id as a `FOCUS.base` mono span with the cached title as `title=`, never a `#` |
| **Nudge keys** | `ActionButton solid` (amber fill, `#0a0a0c` text, 600) `Start focus` + `<kbd>↵</kbd>` only while `useWindowFocus()` is true · `ActionButton primary` (`.16` fill) `Kickoff 2m` · spacer · ghost `Snooze 15m`. Esc → `dismiss`, Enter (window, not in an input) → `idle-start-focus` |
| **Kickoff prompt** | `overlay/KickoffPromptCard.tsx` — extracted verbatim, hairline shell, `Kickoff done` / `0:10` / `Keep going` + `Stop`; `data-testid=kickoff-prompt` |
| **Overlay parts** | `overlay/parts.tsx`: `DismissButton`, `Dot`, `ActionButton` (`primary` / `solid` / `grow`), `label()`, `withAlpha()`, `mmss()`, `span()`, `mono` |
| **Takeover layer** | `components/Kickoff/KickoffTakeover.tsx` — `fixed inset-0 z-50 bg-drip-bg flex flex-col px-12 py-10`, `role=dialog aria-modal aria-label=Kickoff`, mounted in `App.tsx` after `MainContent`; renders only while `status=focus && kickoff=warmup`. Header row is `WebkitAppRegion: drag` |
| **Takeover header** | `.now-label text-focus` `Kickoff` · Raycast pill `data-testid=kickoff-raycast`: `border-drip-border rounded-[2px] px-3 py-1.5 text-[12.5px]` with a 6px square dot (`bg-focus shadow-led` on / `bg-txt-dim` off), text from `kickoffCopy.raycastLine` (`RAYCAST_BLOCK_CATEGORIES` spelled out) |
| **Takeover digits** | `.now-digits text-[160px] wide:text-[240px] leading-[0.8] tracking-[-5px] wide:tracking-[-8px]`, `m:ss` (`kickoffCopy.formatKickoff`), `text-focus` + `.colon-blink` running, `text-txt-secondary` static paused; `role=timer aria-label="Kickoff remaining"` |
| **Takeover task** | id pill `font-mono text-[15px] text-focus bg-focus/10 rounded-[2px] px-2 py-0.5` (never `#`) + 18px `text-txt-secondary` title (`useTaskName`, falls back to the intention); `No task attached` in `text-txt-muted` without a task |
| **Takeover progress** | `role=progressbar` `h-[3px] w-[520px] max-w-full bg-drip-elevated`, `bg-focus` fill (`bg-txt-dim` paused), `transition-[width] duration-1000 ease-linear`, square |
| **Takeover copy** | 14px `text-txt-muted` `Just start. At 0:00 this rolls into a 25m focus session.` / `Paused — resume or stop.` (`data-testid=kickoff-copy`) |
| **Takeover footer** | 12.5px muted source line (`kickoffCopy.sourceLine`: `Started automatically after 15m idle` / `from the nudge` / `from Raycast` / `from Now`, `data-testid=kickoff-source`) · secondary row `data-testid=kickoff-secondary` (`opacity-60 hover:opacity-100`, `KeyButton ghost sm` Pause⇄Resume, Finish, `+5 min` hidden while paused — the store's own handlers) · `KeyButton outline sm` `Stop` with `kbd="esc"` only while the window has focus. Esc (window, not in an input) → `reset()`: no row |
| **Hint-when-focused rule** | Both windows are raised with `showInactive()`. A printed key hint (`↵`, `esc`) is rendered only while `document.hasFocus()` (`hooks/useWindowFocus.ts`); the binding exists regardless. Never print a hint the window cannot honour |
| **Fixtures** | `overlay.html?state=idle|kickoff|card|break-complete|break` render without the bridge; `act()` logs `[Overlay] fixture action: <type>` instead of sending. The e2e opens them in preload-less windows only |
