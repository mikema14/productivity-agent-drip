# Drip UI Design System

## Design Principles

- **Transparent backgrounds**: Prefer `bg-transparent` over solid fills for inputs and containers
- **Orange (`focus`) accent color**: Every interactive element, border, and state indicator uses the `focus` token (amber/orange)
- **No grey glass remnants**: The old `glass-*` utility classes are deprecated in Timer-view files — use orange accent equivalents
- **Consistent rounding**: `rounded-xl` for inputs/buttons/cards, `rounded-2xl` for modals, `rounded-full` for pills/badges

---

## Token Reference

| Element | Tailwind Classes |
|---------|-----------------|
| **Input (resting)** | `bg-transparent border border-focus/30 rounded-xl` |
| **Input (focus ring)** | `focus:ring-2 focus:ring-focus/30 focus:border-focus/30` |
| **Primary button** | `bg-focus text-drip-bg rounded-2xl shadow-glow-focus hover:scale-[1.02]` |
| **Secondary button** | `px-4 py-2 bg-focus/10 border border-focus/20 text-focus rounded-xl hover:bg-focus/20` |
| **Ghost / neutral button** | `px-4 py-2 bg-transparent border border-focus/20 text-txt-muted rounded-xl hover:bg-focus/5 transition-all` |
| **Destructive ghost** | `text-txt-dim hover:text-red-400 transition-colors` |
| **Toggle (active)** | `bg-focus/15 text-focus border border-focus/30` |
| **Toggle (inactive)** | `text-txt-secondary hover:text-txt-primary hover:bg-focus/5` |
| **Billable toggle** | Shared `BillableToggle` pill — active `bg-focus/15 text-focus border-focus/30` (with `✓`), inactive `bg-transparent text-txt-secondary border-focus/20 hover:bg-focus/5`, `rounded-full`. Use it for any billable control (timer, lists, items, log entries) instead of a raw checkbox. See `BILLABLE_FEATURE.md`. |
| **Filter pill (active)** | `bg-focus/15 text-focus` |
| **Filter pill (inactive)** | `text-txt-muted hover:text-txt-secondary hover:bg-focus/5` |
| **Container / card** | `bg-transparent border border-focus/30 rounded-xl` |
| **Content card (subtle)** | `bg-focus/5 border border-focus/20 rounded-xl` |
| **Modal surface** | `bg-drip-bg/95 backdrop-blur-2xl border border-focus/30 rounded-2xl shadow-glass` |
| **Divider border** | `border-focus/20` |
| **Section border (header/footer)** | `border-b border-focus/20` / `border-t border-focus/20` |
| **Dropdown container** | `bg-drip-elevated border border-focus/30 rounded-xl shadow-glass` |
| **Dropdown item hover** | `hover:bg-focus/5` |
| **Progress bar track** | `bg-focus/10` |
| **Pill / badge** | `bg-focus/5 border border-focus/20 rounded-full` |
| **Hour line dashes** | `border-dashed border-focus/10` |
| **Hover state (generic)** | `hover:bg-focus/5` |
| **Checkbox border** | `border border-focus/20 hover:border-focus/50` |

---

## Semantic Color Palette

| Semantic role | Token | Color |
|---------------|-------|-------|
| Focus sessions / primary accent | `focus` | Amber/orange |
| Break sessions | `break` | Emerald green |
| Calendar events | `blue-500` | Blue |
| Adhoc entries | `focus` (subtle) | Orange-tinted |
| Error / destructive | `red-400` / `red-500` | Red |
| Primary text | `txt-primary` | — |
| Secondary text | `txt-secondary` | — |
| Muted text | `txt-muted` | — |
| Dim text | `txt-dim` | — |

---

## Legacy Patterns to Avoid

These classes still exist in DailyLog, Lists, and Settings views — **do not use them in new code** and migrate when touching those views:

| Legacy class | Replacement |
|-------------|-------------|
| `glass-button` | `px-4 py-2 bg-transparent border border-focus/20 text-txt-muted rounded-xl hover:bg-focus/5 transition-all` |
| `glass-surface-elevated` | `bg-drip-bg/95 backdrop-blur-2xl border border-focus/30 rounded-2xl shadow-glass` |
| `bg-glass-bg` | `bg-transparent` (inputs) or `bg-focus/5` (cards) |
| `border-glass-border` | `border-focus/30` (prominent) or `border-focus/20` (subtle) |
| `bg-glass-hover` | `bg-focus/5` |
| `bg-drip-elevated` | Still valid for dropdown backgrounds; replace borders only |

---

## Migration Checklist

When updating an older view to the orange accent design language:

1. Find all `glass-button` usages → replace with ghost button pattern
2. Find all `glass-surface-elevated` → replace with modal surface pattern
3. Find all `bg-glass-bg` → use `bg-transparent` for inputs, `bg-focus/5` for info cards
4. Find all `border-glass-border` → use `border-focus/30` or `border-focus/20`
5. Find all `bg-glass-hover` → use `hover:bg-focus/5`
6. Verify modals: header/footer dividers should be `border-focus/20`
7. Verify dropdowns: container border should be `border-focus/30`, items `hover:bg-focus/5`
8. Verify progress bars: track should be `bg-focus/10`
9. Verify checkboxes: border should be `border-focus/20`

---

## Now Screen Tokens (Phase 1 redesign)

The rail + Now screen introduce a squarer, hairline language that Phase 2 (Plan / Review / Insights) should reuse. Corners are `rounded-[2px]` or none; no `rounded-xl` / `rounded-full` on new surfaces.

| Element | Tailwind / class |
|---------|------------------|
| **Micro-label** (state words, section headers, rail labels) | `.now-label` — mono 10.5px, 500, `tracking-label` (1.5px), uppercase via CSS (keep source text sentence-case so tests match) |
| **Section header** | `SectionHeader` in `Timer/FocusBlock.tsx`: `01 Focus` + `border-t border-drip-elevated` hairline, optional right slot |
| **Countdown digits** | `.now-digits` — `font-condensed` (Barlow Condensed 700) 160px, 120px under 1000px (`wide:` breakpoint); ghost `88:88` behind in `text-drip-ghost` |
| **Key button** | `KeyButton` (`Timer/KeyButton.tsx`) — `variant` amber / outline / ghost / danger, `size` md (44px) / sm (28px), optional `kbd`. Drop edge `shadow-key-amber` / `shadow-key-dark`, presses in with `active:translate-y-[2px] active:shadow-none` |
| **LED** | 4px square `bg-focus shadow-led` (active rail item, selected duration, current session square) |
| **Hairline separator** | `border-drip-elevated` (section separators) / `border-drip-border` (control outlines) |
| **Focus block top rule** | `border-t-2 border-t-focus`; `border-t-break` in break; `border-t-drip-border` when paused |
| **Joined segmented control** | `border border-drip-border`, children `border-l border-drip-border`, active `bg-focus text-drip-bg` (DurationSegments, aside tabs, task-list filters) |
| **Id pill** | `font-mono text-[12px] text-focus bg-focus/10 rounded-[2px] px-1.5` — never a `#` prefix (design rule 6) |
| **Timeline blocks** | `rounded-[2px]` 1px borders: focus `border-focus/30-40`, break `border-break/40`, calendar `border-blue-500/40` (dashed = proposal), adhoc dashed `border-focus/30` |
| **NOW marker** | 7px `bg-focus` square + 1px amber line + inverted `NOW hh:mm` tag |
| **Day bar** | 12 × `h-1.5` segments, `bg-focus` filled / `bg-drip-border` empty, against `DAY_TARGET_MINUTES = 360` |
| **Tokens added** | `drip.ghost #16161b`, `focus.shadow #92560a`, `shadow-key-amber/key-dark/key-sm/led`, `tracking-label`, `font-condensed`, screen `wide` (1000px) |

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

