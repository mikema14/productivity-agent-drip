# Focus Panel — Implementation Fix List

**Purpose:** Close the gap between the shipped implementation and the approved
design (`Pomodoro Redesign.html`).
**Audience:** Claude Code follow-up session.
**Priority legend:** 🔴 blocking · 🟡 polish · 🟢 nice-to-have
**Reference the mockup side-by-side while working.** If something conflicts
with `HANDOFF.md`, the HTML mockup wins.

---

## 0. How to verify you're matching the design

Open `Pomodoro Redesign.html` in a browser. Toggle states via the Tweaks
panel (`state: ready | running | paused`, `hasTaskSelected`, `intention`,
`hasPreviousSession`). Screenshot each state and compare to your build at
the **same viewport width**. Every item below is a delta between those
two screenshots — not a new idea.

---

## 1. 🔴 Task picker is non-functional

**Symptom:** The recent-tasks list is a static decoration. Clicking a row
does nothing. The search input does not filter.

**Expected behavior** (matches mockup):

1. **Always-visible recent list** — when no task is selected, show the
   top 5 recent tasks immediately (no dropdown, no extra click).
2. **Search filters the list in place** — typing in the search field
   filters the visible rows by `#id` substring or case-insensitive title
   match. Filter runs on every keystroke.
3. **Click a row** → that task becomes the selected task:
   - Task card replaces the picker card.
   - `#id` chip, title, and `<client>` populate.
   - Session note input receives focus.
   - Begin Focus button enables.
4. **Empty search result** → show the create affordance:
   `No matching tasks. Press Enter to create #<query>.`
   Enter opens the existing task-create modal with the ID prefilled.
5. **Keyboard:** ↑/↓ moves selection, Enter picks or creates, Esc clears
   the search.
6. **Change task after selection** → chevron on the `#id` row returns to
   the picker, preserving any note the user already typed.

## 2. 🔴 Panel is not responsive

**Symptom:** Panel stays narrow regardless of viewport width; wide screens
get a column of ~380 px with huge empty side areas.

**Expected behavior:**

- The panel should **fill the available middle column** of the app shell
  (the area between the left sidebar and the right timeline), with:
  - `min-width: 360 px` (mobile fallback)
  - `max-width: 640 px` (prevent the clock from ballooning on ultra-wide)
  - Otherwise `width: 100%` of its parent column
  - Horizontal padding scales: `24 px` at ≤480 px, `32 px` at ≤720 px,
    `40 px` above that
- The clock itself is fixed 320 × 320 px centered. It does **not** scale
  with viewport. Only the surrounding rows stretch.
- Task-picker rows must not overflow — title column shrinks with
  `min-width: 0; overflow: hidden; text-overflow: ellipsis`.
- The intention row, resume CTA, duration segments, task card, and
  action bar all stretch to the panel width; segments center within
  the row.

Test widths: 360 px, 480 px, 640 px, 960 px. No horizontal scrollbar at
any of them.

## 3. 🔴 Progress ring is inverted (counts the wrong direction)

**Symptom:** The orange ring starts full and depletes as time passes —
"counting down from largest to smallest."

**Expected behavior:**

The ring visualizes **elapsed time**, growing from 0° to 360° as the
session runs. Formula:

```
progress = elapsedSeconds / totalSeconds           // 0 → 1 over session
ring = conic-gradient(
  var(--accent)   calc(progress * 360deg),
  var(--track)   0                              // rest of the circle
);
```

So at the **start** of a session, almost all of the ring is the dim
track color and a thin amber arc begins at 12 o'clock. At the **end**,
the ring is fully amber. This mirrors the reference screenshot Marek
provided (at `24:57` remaining out of 25 min, the ring is nearly empty).

**Additional:**

- The ring should start at 12 o'clock (`-90deg` offset on the conic
  gradient, or rotate the whole ring element).
- Track color: `oklch(1 0 0 / 0.08)` (not transparent, not amber-dim).
- Ring thickness: ~3 px — use the radial mask in the mockup:
  `mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px))`
- Animate smoothly: `transition: background 600ms linear` (avoid per-frame
  repaints by only updating the gradient once per second in React).

## 4. 🔴 Running-state clock face is missing content

**Symptom:** The running state shows only the digits and an unlabeled
`+5 min` pill. The session window (start → end times) is missing. Digits
are ~90 px; the mockup uses 86 px but with a specific arrangement.

**Expected (inside the ring, top to bottom):**

1. **`+5 min` capsule** — small amber-on-dim pill, clickable, extends
   the session by 5 min. Visible only while running.
2. **Session window** — `22:01 → 22:26` in mono 11.5 px, text-3 color,
   arrow glyph dimmed. Shows the start time and projected end time; end
   time updates when `+5 min` is pressed.
3. **Gap (~4 px)**.
4. **Digits** — 86 px, weight 300, tabular-nums, letter-spacing -0.04em.
   Colon is weight 200, baseline-shifted up 6 px, blinks once per second
   while running (`step-end` easing, not fade).

All three items are centered inside the ring, stacked vertically. The
ring must not crowd them — the face should have ~24 px of inner padding.

## 5. 🟡 Running-state task card is wrong variant

**Symptom:** The shipped active-state task card uses the plain neutral
card (`background: surface`) and lacks the amber tint.

**Expected:** the running state uses the `task-card.readonly` variant:

```
background: linear-gradient(180deg,
  oklch(0.78 0.14 70 / 0.06),
  oklch(0.78 0.14 70 / 0.02));
border: .5px solid oklch(0.78 0.14 70 / 0.22);
```

Inside the card:
- `#id` chip on the left (amber text on `accent-soft` background, mono).
- Title in white, 13.5 px, weight 500.
- Client in mono at 11.5 px, text-3 color, same row as title.
- Hairline divider (`oklch(1 0 0 / 0.08)`) spanning full card width.
- Note row below with note-icon (text-3) + the note text in text-2.
- Card is read-only in this state — no inputs, no edit affordance.

## 6. 🟡 Header sub-label is truncated ("Session 0")

**Symptom:** Running header shows `Session 0` instead of
`Session 4 of 8` (or however many).

**Expected:** `Session ${completedSessions + 1} of ${totalSessions}`.
`completedSessions` is zero-indexed; the sub-label shows the 1-indexed
*current* session. If totals aren't plumbed through yet, show
`Session ${completedSessions + 1}` with no "of N" suffix rather than
displaying a bare `0`.

## 7. 🟡 State pill styling regression

**Symptom:** Ready pill uses a hard charcoal fill and all-caps `READY`
text. Running pill uses `FOCUSING` all-caps with a different chip shape
than the mockup.

**Expected:**

- Shape: capsule, 28 px tall, 12 px horizontal padding, 8 px gap before
  text.
- Ready pill: background `oklch(1 0 0 / 0.06)`, hairline border,
  text-2 color, label sentence case ("Ready"), LED dot in text-3.
- Running pill: background `accent-soft` (no border), accent-colored
  label ("Focusing"), LED dot `accent` with a 1.6 s pulse
  (`box-shadow` keyframes — see mockup CSS).
- Paused pill: same background as running but label "Paused", LED static
  (no pulse).
- All labels in sentence case. Font size 12 px weight 500, letter-spacing
  0.02em. Not uppercase.

## 8. 🟡 Intention row visibility logic

**Symptom:** The `Set intention` pseudo-row appears in the sidebar rather
than being gated on "is an intention set for today."

**Expected:**

- The intention row inside the focus panel renders **only when
  `day.intention` is a non-empty string**.
- When present: `🎯 Today's intention · <text>` + small `Edit` button.
- When absent: render nothing. No placeholder, no "Set intention" copy
  inside the panel.
- The "Set intention" affordance lives outside the focus panel (sidebar
  / header). That part in the sidebar is correct; remove the in-panel
  fallback copy.

## 9. 🟡 Continue-previous CTA is undersized

**Symptom:** The resume banner in the shipped version is roughly the
same compact height as a status chip, and the `Continue →` button is a
pill that visually reads as secondary.

**Expected:**

- Row is **56 px tall**, matching the intention row. Full panel width.
- Background: `linear-gradient(180deg, oklch(.78 .14 70 / .18), oklch(.78 .14 70 / .08))`
- Border: `0.5 px solid oklch(.78 .14 70 / 0.38)`
- Shadow: subtle amber glow — `0 8px 20px -12px oklch(.78 .14 70 / 0.4)`.
- Left content (vertical stack):
  - Top line: `CONTINUE PREVIOUS` (11 px amber, uppercase, 600 weight,
    letter-spacing 0.08em) + `#667776` as a small amber chip.
  - Bottom line: task title in white, 13.5 px, weight 500.
- Right: `Continue →` as a **primary-button sibling** (amber fill, dark
  text, 40 px tall, 16 px horizontal padding, 10 px radius, right-aligned
  arrow glyph, 600 weight). Not a pill — a button.

## 10. 🟡 Cancel button style

**Symptom:** Cancel is a bare text link, no frame, unclear affordance.

**Expected:** framed secondary button, same 44 px height as Pause/Finish:

```
background: oklch(1 0 0 / 0.04);
border: .5px solid var(--hairline);
color: var(--text-3);
padding: 0 16px;
border-radius: 12px;
```

Hover: background `oklch(0.6 0.17 25 / 0.12)`, color `oklch(0.78 0.14 25)`,
border `oklch(0.6 0.17 25 / 0.3)`. Red is a hover-only accent, not the
resting state. Label reads "Cancel" with the ✕ glyph on the left.

## 11. 🟡 Duration segments styling

**Symptom:** The segmented control is close but the active segment fill
is too warm and the inactive labels are too bright.

**Expected (per mockup):**

- Container: 3 px inner padding, radius 10 px, background
  `oklch(1 0 0 / 0.04)`, hairline border, 2 px gap between segments.
- Segment: 28 px tall, 14 px horizontal padding, radius 8 px, 12 px font
  weight 500, `font-variant-numeric: tabular-nums`.
- Inactive label: `var(--text-3)` (42% white), hover raises to `text-2`.
- Active segment: background `oklch(1 0 0 / 0.10)` (neutral white — NOT
  amber), label `var(--text)`, inner highlight
  `box-shadow: 0 1px 0 oklch(1 0 0 / 0.06) inset`.

The active segment is a neutral lift, not an amber pill.

## 12. 🟢 Session dots placement

**Symptom:** Dots are missing from the running state and misaligned
below the clock in ready state.

**Expected:**

- Centered horizontally, 10 px below the clock.
- Row of circles, 6 px × 6 px, 6 px gap.
- Completed: `var(--accent)`.
- Current (during running state): `var(--accent)` + 3 px halo
  (`box-shadow: 0 0 0 3px var(--accent-soft)`).
- Remaining: `var(--text-4)` (24% white).
- Count equals `day.plannedSessions` (default 8).

## 13. 🟢 Spacing rhythm

**Symptom:** Rows feel cramped; some gaps are 12 px where the mockup is
24 px, making the panel feel dense.

**Expected vertical rhythm (top to bottom, panel content):**

```
padding-top          36 px
header               auto
gap                  24 px
intention (if any)   44 px
gap                  24 px
resume CTA (if any)  56 px
gap                  24 px
clock                320 px
gap                  10 px
session dots         6 px
gap                  24 px
duration segments    34 px (ready only)
gap                  24 px
task card / picker   auto
gap                  24 px
action bar           44 px
padding-bottom       32 px
```

Use `display: flex; flex-direction: column; gap: 24 px` at the panel
level; override individual gaps only where this table specifies a
different number. Do not introduce `margin-top` on children.

## 14. 🟢 Typography polish

- Header title "Focus" / "Deep work": 22 px, weight 600, letter-spacing
  -0.02em. Currently reads slightly lighter than spec.
- Header sub-label: 13 px, `var(--text-3)`.
- Timer digits: 86 px (not 90+). Make sure the CSS is not scaling to the
  container.
- Every numeric display (timer, session window, dots count) must set
  `font-variant-numeric: tabular-nums`.

---

## 15. Out of scope / don't touch

- Right-hand timeline column — unchanged.
- Sidebar — unchanged.
- The "Set intention" button position in the sidebar is correct.
- Light theme — still out of scope.

---

## 16. Acceptance criteria

For each numbered item above, attach a before/after screenshot at 1280 px
and at 480 px viewport widths. The running-state screenshot must show
the session window (`HH:mm → HH:mm`) and the ring partially filled from
the top at roughly `elapsed / total` coverage. The ready-empty state
screenshot must show a filterable recent-tasks list with at least 5 rows.
