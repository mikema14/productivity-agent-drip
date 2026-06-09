# Focus Panel Redesign — Handoff Blueprint

**Audience:** Claude Code (implementation)
**Source of truth:** `Pomodoro Redesign.html` + `focus-panel.jsx` + `tweaks-panel.jsx`
**Status:** Design approved · Ready to build
**Last updated:** 2026-04-23

---

## 1. Summary

Redesign of the Focus / Pomodoro panel at the center of the Drip app. The
panel is the user's primary daily time logger: it starts and stops work
sessions against a task ID, captures a session note, and records elapsed
time into the Daily Log and Progress views.

The redesign keeps the existing functional surface but modernizes it to
match an Apple-native aesthetic (SF Pro, dark warm-black surface, soft
translucent capsules, amber brand accent). It also adds two structural
improvements:

- A proper **empty state** (task picker) when no task is selected.
- A prominent **"Continue previous session"** CTA, promoted to primary-
  action visual weight because it's used frequently.

### What changes at a product level

| Area | Before | After |
|---|---|---|
| Intention row | Always visible, placeholder copy | **Only visible when an intention is set** (populated from debrief or a small "Set intention" button elsewhere in the app) |
| Continue session | Small ghost row | Full-width primary-tinted CTA, same height as intention row, with an amber "Continue →" pill |
| Task entry | Two loose text inputs for ID + note | Unified task card; empty state shows search + recent tasks picker |
| Session duration | Hard-coded 25m | 15 / 25 / 50 / 90 segmented picker (**new functionality — see §5**) |
| Running state | Bigger timer, hidden form | Same frame, contents swap; task card becomes read-only amber summary |
| Cancel action | Inconspicuous ✕ glyph | Framed "Cancel" button, quieter than Pause/Finish but part of the action bar |
| App chrome | — | Mockup shows fake window chrome; **do not ship** — the panel is embedded in the existing Drip app shell |

---

## 2. States

The panel has four mutually exclusive states. They all share the same
outer frame; only the middle content and action bar swap.

### 2.1 `ready-empty` — No task selected (first open of the day)
- Header: "Focus" / "Start your session" + `Ready` state pill.
- Intention row (conditional — see §3).
- Continue-previous CTA (if a previous session exists — see §4).
- Clock shows `25:00` (or last-used duration), ring dim, no ticking.
- Duration segmented control visible.
- **Task picker** (search input + recent tasks list) replaces the task card.
- Primary action: **Begin Focus** (disabled until a task is picked).

### 2.2 `ready-selected` — Task attached, not yet started
- Same as above, but the task picker is replaced by the **task card**:
  editable `#ID` field + task title + session-note input + client/session
  foot.
- Chevron on the ID row returns the user to the picker (changes task).
- Begin Focus enabled.

### 2.3 `running` — Session in progress
- Header: "Deep work" / "Session N of M" + amber pulsing `Focusing` pill.
- Intention row still conditional.
- Continue-previous CTA **hidden**.
- Clock: progress ring animates around the dial; digits tick; colon blinks.
- Inside the dial: `+5 min` capsule + session window (`22:01 → 22:26`).
- Task card rendered **read-only** in amber-tinted variant.
- Duration picker hidden.
- Action bar: **Pause** (secondary) · **Finish** (secondary) · **Cancel** (quiet danger).

### 2.4 `paused` — Session paused
- Same as running but the `Focusing` pill reads `Paused` (no pulse), and
  Pause swaps to **Resume** (primary amber). Clock stops ticking; progress
  ring frozen.

---

## 3. Intention row (conditional)

Renders only when `day.intention` is a non-empty string.

**Data sources** (whichever fires first sets the day's intention):
1. The **previous day's debrief** — user picks tomorrow's focus there.
2. A small **"Set intention"** affordance located elsewhere in the app
   (sidebar or header — *not inside the focus panel*). The focus panel
   never *sets* the intention; it only reflects it.

**When present:** shows `🎯 Today's intention · <text>` with a small
`Edit` button that opens the same modal used by the sidebar affordance.
The entry has `role="group"` and should be announced by AT as
"Today's intention: <text>".

**When absent:** render nothing (no placeholder, no empty state, no
"No intention set" copy). The panel should feel non-intrusive; this row
is infrequent signal.

---

## 4. Continue previous session

- Visible only in `ready-*` states, only when a previous unfinished or
  previously-logged session exists within the same day (or previous work
  session if still relevant — confirm rule with Marek).
- Same height as the intention row (56 px) — visually one of the two
  prominent panel rows.
- Amber-tinted surface with the accent-button styled "Continue →" on
  the right.
- Clicking it:
  1. Populates the task card with the previous task (`#id`, title, client).
  2. Carries over the last session note as the active note.
  3. Transitions straight into `running` state (no intermediate confirmation).

---

## 5. Session duration picker — **new functionality**

Today the timer is hard-coded to 25 minutes. The mockup surfaces a
15 / 25 / 50 / 90 minute segmented control. Work required:

- Settings model: `user.defaultSessionDuration` (minutes, default 25).
- Per-session override via the segmented control; persists back to
  `defaultSessionDuration` when changed.
- `+5 min` capsule inside the clock extends the running session by 5 min
  and updates the end-time window; persist the new total on the session
  record (not on the default).
- Break length logic: if breaks are auto-scheduled, recompute break
  duration proportionally — a 90-min session should probably trigger a
  longer break than a 25-min one. **Decision needed.**
- Daily Log aggregation: entries currently assume 25-min pomodoros.
  Audit the "7 sessions · 3h 5m focus" style strings and replace with
  actual summed durations.
- Progress / reporting: sessions-per-day counts become less meaningful —
  prefer summed focus-minutes as the primary metric.

---

## 6. Empty task state & picker

### Flow
1. Panel opens with no task → render the picker card (search field +
   recent tasks list).
2. User either types an ID (free text) or clicks a recent task row.
3. Selection fills in the task card (ID, title, client) and reveals the
   session-note input.
4. Begin Focus becomes enabled.
5. User can return to the picker via the chevron on the ID row.

### Picker contents
- **Search field** with `#` prefix, placeholder "Search task ID or title…",
  and a `⌘K` keyboard hint on the right. Typing filters the recent list
  by ID substring or title (case-insensitive).
- **Recent tasks section** — last ~5 tasks the user has logged against,
  ordered by recency. Each row: `#id` chip (amber), title, `<client>` in
  mono, relative time (`2h`, `Yesterday`, `2d`).
- If no match: `No matching tasks. Press Enter to create #<query>.`
  (Creation flow should open the task-create sheet with the ID prefilled.)

### Keyboard
- `↑ / ↓` navigates rows; `Enter` selects or creates.
- `⌘K` (or `Ctrl+K`) focuses the search field from anywhere on the panel.
- `Esc` closes the picker and returns to the previous state (if any task
  was previously selected).

---

## 7. Cancel action

Framed "Cancel" button, same height (44 px) as Pause/Finish, quieter
styling (hairline border, text-3 color, red hover tint only). Placed at
the end of the action bar.

**Confirmation rule:** if `elapsedSeconds > 300` (5 min), confirm before
discarding. One-click dismiss for shorter sessions. Confirmation copy:

> Cancel this session? You'll lose the 12 min you've logged so far.
> [Keep focusing] [Cancel session]

Cancel discards; does *not* write anything to Daily Log. Finish logs the
elapsed time as a completed session regardless of whether the timer hit
zero.

---

## 8. Visual system / tokens

Reuse existing Drip tokens where possible. If they don't exist yet,
introduce with the names below.

### Color (dark theme, authoritative)
```
--bg            oklch(0.18 0.008 60)   /* warm near-black */
--bg-deep       oklch(0.14 0.006 60)   /* app backdrop */
--surface       oklch(0.22 0.008 60)   /* card fill */
--hairline      oklch(1 0 0 / 0.08)
--hairline-strong oklch(1 0 0 / 0.14)
--text          oklch(0.98 0 0)        /* 100% */
--text-2        oklch(0.98 0 0 / 0.64) /* secondary */
--text-3        oklch(0.98 0 0 / 0.42) /* tertiary / placeholders */
--text-4        oklch(0.98 0 0 / 0.24) /* disabled / ticks */
--accent        oklch(0.78 0.14 70)    /* Drip amber — REUSE existing token */
--accent-soft   oklch(0.78 0.14 70 / 0.18)
--accent-dim    oklch(0.78 0.14 70 / 0.42)
--danger        oklch(0.72 0.16 25)    /* used for cancel hover */
```

The amber should be pulled from the current codebase (existing brand
token). Do not introduce a parallel palette.

A light-mode pass is **out of scope** for this round.

### Typography
- Sans: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif`
- Mono: `ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace`
- Timer digits: 86 px, weight 300, `font-variant-numeric: tabular-nums`, letter-spacing -0.04em.
- Body: 13–13.5 px / 1.4.
- Small caps / labels: 10.5–11 px uppercase, letter-spacing 0.06–0.08em.

### Shape
- Panel radii: outer 22 px, cards 14 px, inputs/segments 10 px, buttons 12 px, pills 999 px.
- Hairlines at `0.5 px` solid.

### Spacing rhythm
- Panel padding: 36 px top/bottom, 40 px sides.
- Major row gap: 24 px.
- Intra-card gap: 10–12 px.
- Button height: 44 px. Input/segment height: 40 px. Capsule pill height: 28 px.

### Motion
- State transitions: 200 ms ease for fades, 150 ms for background/border.
- `:active` press: `transform: scale(0.98)` for buttons, `0.995` for the resume CTA.
- Running-state LED: 1.6 s infinite box-shadow pulse.
- Colon blink: 1 s step-end while running.
- Progress ring: 600 ms linear when progress updates (smooth on the second, not jitter on every frame).

---

## 9. Component anatomy (for the engineer)

```
<FocusPanel>
├── Header
│   ├── Title + subtitle
│   └── StatePill (Ready | Focusing | Paused)
├── IntentionRow           (hasIntention ? show : null)
├── ContinuePreviousCTA    (state==='ready-*' && hasPrevious ? show : null)
├── Clock
│   ├── DialRing (conic-gradient progress)
│   ├── Ticks (60 marks, every 5th "major")
│   └── Face
│       ├── AddFiveMinPill      (running only)
│       ├── SessionWindow        (running only, "HH:mm → HH:mm")
│       └── TimeDigits (tabular)
├── SessionDots
├── DurationSegments       (state==='ready-*' ? show : null)
├── TaskArea
│   ├── TaskPicker          (ready-empty)
│   ├── EditableTaskCard    (ready-selected)
│   └── ReadonlyTaskCard    (running / paused — amber-tinted)
└── ActionBar
    ├── BeginFocus (primary, disabled when !hasTask)    // ready
    └── Pause/Resume + Finish + Cancel                   // running/paused
```

### Props / state contract (suggested)

```ts
type FocusState = 'ready-empty' | 'ready-selected' | 'running' | 'paused';

interface FocusPanelProps {
  state: FocusState;
  day: { intention: string | null };
  previous?: { taskId: string; title: string; client: string; note: string } | null;
  task?: { id: string; title: string; client: string } | null;
  note: string;
  durationMinutes: number;           // user-selectable, persisted default
  elapsedSeconds: number;
  completedSessions: number;
  totalSessions: number;
  recentTasks: Array<{ id: string; title: string; client: string; lastUsedAt: Date }>;
  onBegin(): void;
  onPause(): void;
  onResume(): void;
  onFinish(): void;                  // logs elapsed, ends session
  onCancel(): void;                  // discards, may need confirm
  onAddFiveMinutes(): void;
  onPickTask(taskId: string): void;
  onClearTask(): void;                // returns to picker
  onNoteChange(note: string): void;
  onDurationChange(minutes: number): void;
  onContinuePrevious(): void;
  onEditIntention(): void;
}
```

---

## 10. Accessibility

- Action buttons use `<button>` elements with explicit text labels; the
  Cancel button's red-only-on-hover styling must not be the sole signal —
  the text "Cancel" is the label.
- State pill announced as `aria-live="polite"` when it changes.
- Clock digits wrapped in `role="timer"` with `aria-label="Time remaining"`
  and updated once per second (not per render).
- Session dots: `aria-label="3 of 8 sessions complete"`.
- Keyboard shortcuts:
  - `Space` — toggle Pause / Resume while running or paused.
  - `Enter` — Begin Focus when ready-selected.
  - `⌘K` — focus the task-picker search.
  - `Esc` — cancel (with confirm if >5 min), or close picker.
- Focus ring must be visible on all interactive elements (SF-style 2 px
  amber halo at 30 % opacity).
- Color contrast: verify amber-on-dark at the small-text sizes; the
  monospace 11 px amber IDs should meet AA.

---

## 11. Analytics / telemetry

Emit the following events (Segment/PostHog, same pipeline as current panel):

- `focus.session.started` — `{ taskId, clientId, durationMinutes, sourcedFrom: 'begin' | 'continue' | 'hotkey' }`
- `focus.session.paused` / `focus.session.resumed`
- `focus.session.finished` — `{ taskId, elapsedSeconds, plannedSeconds }`
- `focus.session.cancelled` — `{ taskId, elapsedSeconds }`
- `focus.session.extended` — `{ taskId, addedMinutes: 5 }`
- `focus.duration.changed` — `{ from, to }`
- `focus.task.picked` — `{ source: 'recent' | 'typed' | 'created' }`
- `focus.intention.edited` — triggered from the panel's Edit button

---

## 12. Known deferrals / follow-ups

- Light-mode palette — out of scope this round.
- Break-timer flow — not redesigned here; current behavior preserved.
- Break duration scaling against variable session duration — decision needed.
- Mobile / narrow-width layout — desktop first; mobile breakpoints TBD.
- Task-creation sheet from the picker's "Press Enter to create" path —
  reuse the existing create-task modal.
- Confirm dialog component for Cancel — reuse existing confirm primitive
  if one exists, otherwise add a small system modal matching the panel's
  radii/tokens.

---

## 13. Deliverables & reference files

| File | Purpose |
|---|---|
| `Pomodoro Redesign.html` | Canonical visual reference; open in a browser to toggle states via the Tweaks panel |
| `focus-panel.jsx` | React component source for the mockup (not production-grade; reference only) |
| `tweaks-panel.jsx` | Demo-only scaffolding; **not part of the ship** |
| `DEV_NOTES.md` | Marek's original contextual notes (this blueprint supersedes; kept for provenance) |
| `HANDOFF.md` | **This document** |

---

## 14. Open questions for product

1. Break duration scaling for 50/90-min sessions — 1:5 ratio? Fixed 10 min?
2. Does "previous session" mean unfinished-today, or last-finished-regardless-of-day?
3. Should `⌘K` open a global command palette instead of scoping to the task picker?
4. Do we want a "discard last 5 min" micro-action inside the running card
   (user took a phone call, wants to subtract time without cancelling)?
5. Confirm amber token name / path in the current codebase.
