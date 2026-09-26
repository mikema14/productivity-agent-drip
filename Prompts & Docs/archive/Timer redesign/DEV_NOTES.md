# Focus Panel — Dev Notes for Claude Code Handoff

Captured from Marek's review of `Pomodoro Redesign.html` (2026-04-23).
These are behavioral / product notes that the mockup alone can't fully
express. Hand them to Claude Code alongside the HTML mockup.

---

## 1. Intention panel — conditional visibility

The "intention" row at the top of the focus panel **must only render when an
intention has been set for the day**. When no intention exists, hide the
panel entirely — do not show a placeholder or empty state. The focus panel
should feel non-intrusive because intentions are used infrequently.

**Sources that populate the day's intention** (either one creates it):
1. Previous day's **debrief flow** — user picks tomorrow's focus.
2. A small **"Set intention"** affordance elsewhere in the app (sidebar or
   header — not inside the focus panel itself).

The focus panel never *sets* the intention; it only *reflects* it.

## 2. Duration picker (15 / 25 / 50 / 90 min) — new functionality

The mockup exposes a duration segmented control. **Today the timer is
hard-coded to 25 minutes.** Implementation work required:

- Allow user to select session duration before starting.
- Persist last-used duration as the default.
- Ensure break lengths and daily/weekly aggregates all handle variable
  session durations correctly.
- Consider surfacing duration in the Daily Log entries and Progress views
  (today they assume 25-minute "pomodoros").

## 3. Cancel action — copy & confirmation

Cancel discards the session without logging time. Consider a confirm step
if the session is >5 min in to avoid accidental data loss. Finish logs the
elapsed time and ends early.

## 4. Empty / first-open task state

When the panel opens with **no task selected**, the primary affordance is a
task picker, not a text field. Flow:

1. Empty state shows a task picker (search + recent tasks list).
2. User types an ID OR selects from recent tasks.
3. Once a task is selected, the card fills in (ID chip, title, client) and
   the session note field appears.
4. Begin Focus only becomes enabled once a task is attached.

Recent-tasks list should surface the last ~5 tasks the user has logged
against, ordered by recency.

## 5. Resume / continue banner

The "Continue previous session" affordance is used frequently and should
be visually prominent — same size as the intention panel, similar styling
to the Begin Focus primary button. Clicking it pre-fills the task card
with the previous session's task + note and starts the timer.

## 6. App chrome

The focus panel lives inside the main Drip app shell (sidebar, timeline,
etc., per the original screenshot). The mockup's faux window chrome is
for presentation only — **do not port it to the real app**.

## 7. General

- Dark theme is authoritative. A light-mode pass is out of scope for this
  round.
- The amber accent is Drip's existing brand color — reuse the token from
  the current codebase rather than introducing a new one.
- Tabular numerals on the timer digits are required (SF Pro Display
  `font-variant-numeric: tabular-nums`).
