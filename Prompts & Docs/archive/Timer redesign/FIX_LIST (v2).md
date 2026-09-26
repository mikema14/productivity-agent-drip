# Focus Panel — Precision Fix List (Round 2)

**Target:** Match the approved mockup (`Pomodoro Redesign.html`) as closely
as possible at the pixel level.
**Reference material:**
- `Pomodoro Redesign.html` — canonical visual source. Open locally and
  toggle `state`, `hasTaskSelected`, `intention`, `hasPreviousSession`
  in the Tweaks panel (bottom-right) to view every phase.
- `reference/01-ready-empty.png`, `reference/02-ready-selected.png`,
  `reference/03-running.png` — baked screenshots of each state.
- `uploads/pasted-1776974516622-0.png` — Marek's original Drip
  running-state reference (the source of truth for the analog ticks,
  progress ring direction, and inner layout).

**Priority legend:** 🔴 blocking · 🟡 polish · 🟢 nice-to-have

**How to self-check:** open your build at **640 px** viewport and compare
every element to the matching screenshot above. No line-by-line
spec survives a side-by-side better than the mockup itself.

---

## State 1 — Ready · no task selected

### A. 🔴 Continue-previous CTA — refresh icon color & visual weight

**Currently:** amber-tinted row is correct in size, but the left
refresh-arrow icon renders in a muted grey. In the mockup it's the same
amber as the text labels (`var(--accent)`).

**Fix:** set `color: var(--accent)` on the icon. Stroke width 1.6 px.
Also make sure the icon sits in a 20 × 20 px box with 14 px horizontal
padding before the text block.

### B. 🔴 Clock ring direction — ticks face INWARD, not outward

**Currently:** tick marks radiate *outward* from the circle (short lines
pointing away from center). Marek flagged this as wrong.

**Fix:** ticks live **inside** the ring, pointing *toward* the center.
Reference: `uploads/pasted-1776974516622-0.png`. Implementation:

```css
.clock { position: relative; width: 320px; height: 320px; }
.ticks { position: absolute; inset: 28px; pointer-events: none; }
.ticks i {
  position: absolute;
  left: 50%; top: 0;
  width: 1.5px; height: 9px;
  margin-left: -0.75px;
  background: var(--text-4);
  transform-origin: 50% 132px;   /* = (320/2 - inset) = 160 - 28 */
  border-radius: 2px;
}
.ticks i.major { height: 14px; width: 2px; background: var(--text-3); }
```

The key is that ticks are positioned at the **top** of a container that's
inset from the ring edge, and rotated around a center point. The ring
itself stays *outside* the ticks. Every 5th tick is "major" (thicker,
brighter). Total of 60 ticks.

### C. 🔴 Progress ring needs a hairline outer rail

**Currently:** the dim track is barely visible; in the mockup the ring
has a faint but clearly-defined circular rail that the amber arc rides
along.

**Fix:** the conic-gradient ring lives in a 3 px annulus, masked:

```css
.ring {
  position: absolute; inset: 14px;
  border-radius: 50%;
  background: conic-gradient(
    from -90deg,
    var(--accent) calc(var(--progress) * 360deg),
    oklch(1 0 0 / 0.08) 0
  );
  -webkit-mask: radial-gradient(farthest-side,
                 transparent calc(100% - 3px),
                 #000 calc(100% - 2.5px));
          mask: radial-gradient(farthest-side,
                 transparent calc(100% - 3px),
                 #000 calc(100% - 2.5px));
}
```

Note `from -90deg` — the progress arc starts at **12 o'clock**. The rest
of the circle at all times carries the `oklch(1 0 0 / 0.08)` track color,
so even at progress 0 you see a complete thin circular outline.

### D. 🔴 Duration picker — constrain width, do not stretch

**Currently:** segmented control stretches the full panel width
(~560 px), so each segment is enormous and the control looks like a
nav bar.

**Fix:** the segment control is a **self-centered inline element**,
fixed to its content width. Implementation:

```css
.segments {
  display: inline-flex;
  align-self: center;                 /* critical */
  padding: 3px;
  background: oklch(1 0 0 / 0.04);
  border: .5px solid var(--hairline);
  border-radius: 10px;
  gap: 2px;
}
.seg { height: 28px; padding: 0 14px; border-radius: 8px; }
```

The parent is a flex column (the panel). `align-self: center` makes
the control hug its own content, centered. Total width ends up ~280 px,
not 560 px. Segments stay 14 px padded — do not make them `flex: 1`.

### E. 🔴 Task picker — missing outer "modal" bracket

**Currently:** the picker is just a search field sitting above a bare
stack of rows. The rows each have their own outlined capsule, creating
visual noise.

**Fix in the mockup** — the picker is a **single card** with:

1. **One outer rounded container** (14 px radius, hairline border,
   `oklch(1 0 0 / 0.03)` background) that wraps both the search field
   AND the recent-tasks list.
2. **Inside that card**, the search field is a sub-capsule at the top
   (40 px tall, 10 px radius, slightly lighter fill).
3. **A small section label** ("RECENT TASKS" 10.5 px uppercase amber-text,
   0.08em letter-spacing) below the search.
4. **Recent task rows are borderless** — no individual capsule outlines.
   Just: `#id` chip + title + `<client>` + relative-time, separated by
   row padding (8 px vertical). Hover state lifts the row with
   `background: oklch(1 0 0 / 0.05); border-radius: 9px`.

```
┌─────────────────────────────────────────┐  ← outer card (hairline)
│ ┌───────────────────────────────────┐   │
│ │ 🔍  Search task ID or title…  ⌘K  │   │  ← inner search (sub-capsule)
│ └───────────────────────────────────┘   │
│                                         │
│ RECENT TASKS                            │  ← section label
│  ┌──────┐                               │
│  │667776│  ER to Raynet integ…  2h      │  ← row (no outline)
│  └──────┘                               │
│  ┌──────┐                               │
│  │653793│  ER Calendar to form… 14h     │
│  └──────┘                               │
│  …                                      │
└─────────────────────────────────────────┘
```

The shipped build wraps *each row* in its own capsule outline, which is
why it looks clunky. Remove those. Keep only the `#id` chip's
background (`var(--accent-soft)`) as a per-row visual, plus a subtle
hover state.

Row structure:

```html
<div class="picker">                      <!-- outer card -->
  <div class="search">…</div>
  <div class="section">Recent tasks</div>
  <div class="row"><span class="tid">667776</span>
       <span class="title">ER to Raynet integration</span>
       <span class="client">&lt;TopGis&gt;</span>
       <span class="ago">2h</span></div>
  …
</div>
```

The row has **no border and no background at rest** — just padding.

### F. 🔴 Begin Focus button — amber, not muted brown

**Currently:** the primary button renders in a dusty `oklch(~0.5 ~0.1 ~70)`
brown-orange with dark brown text. It looks disabled.

**Expected (from mockup):**

```css
.btn-primary {
  background: var(--accent);             /* oklch(0.78 0.14 70) */
  color: oklch(0.18 0.01 60);            /* warm near-black */
  box-shadow:
    0 1px 0 oklch(1 0 0 / 0.25) inset,    /* top highlight */
    0 8px 20px -8px oklch(0.78 0.14 70 / .55);   /* accent glow */
  height: 44px;
  padding: 0 22px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 500;
}
.btn-primary:hover { background: oklch(0.82 0.14 70); }
.btn-primary[disabled] { opacity: .4; }
```

Also: in the ready-empty state the button should be **disabled**
(no task selected yet). Disabled state = 40 % opacity, no glow, no hover.
The shipped build shows an enabled-looking button even when no task is
picked.

### G. 🟡 Begin Focus should not span the full panel width

Button is content-width, centered in the action bar. Not full-width.
Same `44 px × auto` sizing across all three action-bar buttons.

### H. 🟡 Session dots have wrong color in ready state

**Currently:** dots show as amber filled (looks like all sessions
are completed).

**Expected:** in ready state, completed dots are amber; remaining dots
are `var(--text-4)` (24 % white). The shipped build appears to render
everything amber — verify the `completedSessions` prop is wired to the
actual value and not `totalSessions`.

---

## State 2 — Ready · task selected

### I. 🔴 Selected task card — wrong structure

**Currently** (screenshot 3): the card shows a chevron on the left, an
ID chip, and the task title, then a **"Session note"** label row with
`CLIENTS_Easy8.ai` printed in mono underneath. That's the wrong content
mapping — `CLIENTS_Easy8.ai` is the **client**, not the session note.
The session note field is missing entirely.

**Expected layout:**

```
┌──────────────────────────────────────────────┐
│ [#] 667776  ER to Raynet integration      ⌄  │   ← id-field row
├──────────────────────────────────────────────┤
│ 📝  [type your session note…________________]│   ← note row
├──────────────────────────────────────────────┤
│ Client <TopGis>       Today · 3/8 sessions   │   ← meta foot
└──────────────────────────────────────────────┘
```

Three visually distinct zones inside one card, separated by padding
only (no dividers inside — the outer card has a single 14 px radius
hairline). Reference: the `.task-card` + `.id-field` + `.tc-note-row`
+ `.meta-foot` blocks in `Pomodoro Redesign.html`.

- **Row 1 (`id-field`)**: full-width sub-capsule, 40 px tall, `#`
  mono prefix, editable task ID, then the task title in text-3 mono,
  chevron on the far right that returns to the picker. The chevron
  points **down** (`⌄`) not **left** — it opens a dropdown, it isn't
  a back arrow.
- **Row 2 (`tc-note-row`)**: bare (no border), a note icon in text-3
  then a placeholder-styled input `"Session note (optional)"`.
- **Row 3 (`meta-foot`)**: two ends — client on the left, today's
  session count on the right — both in 11.5 px text-3.

The "Session note" **label** should not be visible as a standalone
line. The note field itself carries the placeholder copy.

### J. 🔴 Chevron icon direction

The shipped build shows `<` (a left-pointing back arrow). Replace with a
down chevron `⌄` (SVG path `m4 6 4 4 4-4`). Clicking it should
collapse the card back to the picker.

---

## State 3 — Running

### K. 🔴 Running-state inner clock face is missing everything but digits

**Currently:** only `49:47` digits render inside the ring.

**Expected (top → bottom, all centered inside the ring):**

1. **`+5 min` capsule** — 24 px tall, 10 px horizontal padding, 999 px
   radius, background `oklch(1 0 0 / 0.06)`, hairline border, text-2
   color, 11 px weight 500. Clickable; extends session by 5 min.
2. **Session window** — mono 11.5 px, text-3 color, letter-spacing
   0.04em: `22:01 → 22:26`. The `→` arrow is opacity 0.55.
3. **~4 px gap.**
4. **Digits** — 86 px weight 300, tabular-nums, letter-spacing -0.04em.
   Colon weight 200, baseline-shifted up 6 px. Blinks once/second
   while running using `step-end` easing (not fade).

### L. 🔴 State pill must show "Focusing" with amber pulse

**Currently:** shipped build still reads "Ready" even when the timer
starts. Implementation:

```jsx
const label = running ? 'Focusing' : paused ? 'Paused' : 'Ready';
```

- Running: background `var(--accent-soft)`, color `var(--accent)`, no
  border. LED dot pulses (`@keyframes pulse`) from a solid amber center
  outward to transparent over 1.6 s.
- Paused: same background/color as running, LED static (no pulse).
- Ready: background `oklch(1 0 0 / 0.06)`, hairline border, text-2
  color, LED in text-3 static.

### M. 🔴 Header sub-label in running state

**Currently:** `Session 0`.
**Expected:** `Session ${completedSessions + 1} of ${totalSessions}`
(e.g. `Session 4 of 8`). If `totalSessions` isn't available, fall back
to `Session ${completedSessions + 1}` — never display a bare `0`.

### N. 🔴 Running-state task card — amber read-only variant

**Currently:** the running card is the same neutral card as ready;
also the note reads `test` which is fine for testing but needs to pull
from `activeSession.note`.

**Expected:** task card in running state uses the **`.readonly`**
variant — amber-tinted background, amber border:

```css
.task-card.readonly {
  background: linear-gradient(180deg,
    oklch(0.78 0.14 70 / 0.06),
    oklch(0.78 0.14 70 / 0.02));
  border-color: oklch(0.78 0.14 70 / 0.22);
}
```

Inside:

- Row 1: `#id` chip (amber on accent-soft, mono 12 px weight 500) +
  task title in white 13.5 px weight 500 + `<client>` in mono 11.5 px
  text-3 tail.
- Hairline divider spanning the full card (0.5 px `var(--hairline)`,
  margin -16 px to cover the card's horizontal padding).
- Row 2: note icon (text-3) + note text in text-2 13 px.
- **No inputs.** This card is read-only while a session is running.

### O. 🟡 Cancel action bar button — framed, not bare

**Currently:** Cancel appears as a bare `Cancel` text button next to
Pause / Finish. Needs a frame matching the secondary button style:

```css
.btn-danger {
  background: oklch(1 0 0 / 0.04);
  border: .5px solid var(--hairline);
  color: var(--text-3);
  height: 44px;
  padding: 0 16px;
  border-radius: 12px;
}
.btn-danger:hover {
  background: oklch(0.6 0.17 25 / 0.12);
  color: oklch(0.78 0.14 25);
  border-color: oklch(0.6 0.17 25 / 0.3);
}
```

Red is a hover-only tint; the resting state is neutral grey on a quiet
frame.

### P. 🟡 Pause / Finish buttons — missing chevron on Finish

Finish has a `>` arrow in the original reference indicating a menu
split (finish & break, finish & log, etc.). Keep the text `Finish ›`
with a right-chevron glyph on the right.

---

## State 4 — Paused

Not yet implemented. Must mirror running except:

- Pill reads `Paused`, no LED pulse.
- Colon does not blink.
- Ring freezes at current progress (no transition running).
- Primary action swaps from **Pause** to **Resume** (amber primary fill).

---

## Cross-cutting

### Q. 🔴 Responsive behavior

**Currently:** panel content locks at ~380 px regardless of viewport.

**Expected:**

- Panel fills the middle column between sidebar and timeline.
- `min-width: 360px`, `max-width: 640px`, otherwise `100%` of parent.
- Padding scales: 24 px (≤480 px) / 32 px (≤720 px) / 40 px (default).
- Clock stays fixed at 320 × 320 px regardless of width.
- No element uses a hard-coded width that would force horizontal scroll
  at 360 px. Test matrix: 360 / 480 / 640 / 960 px.

### R. 🔴 Vertical rhythm

The panel is a `flex column` with `gap: 24px`. **Individual** gaps that
differ:

| Between | Gap |
|---|---|
| clock → session dots | 10 px |
| session dots → duration segments | 24 px |
| everything else | 24 px |
| panel padding top / bottom | 36 / 32 px |
| panel padding sides | 40 px (desktop) |

Do **not** use `margin-top` on children. Use the flex `gap` and only
override with `margin-top: -N` where the vertical table specifies.

### S. 🟢 Hook up Tweaks-equivalent toggles for QA

Optional but useful: in a dev build, expose a keyboard shortcut
(Cmd-Shift-D) that cycles through states `ready-empty → ready-selected
→ running → paused`, using the mockup's tweak payload as a guide.

---

## Verification checklist

Before marking done, attach screenshots at **640 px and 480 px** for all
four states:

- [ ] ready-empty matches `reference/01-ready-empty.png`
- [ ] ready-selected matches `reference/02-ready-selected.png`
- [ ] running matches `reference/03-running.png`
- [ ] paused has the static pill + frozen ring + Resume primary button
- [ ] Ticks face **inward** on the clock (verify against Marek's
      original Drip screenshot, `uploads/pasted-1776974516622-0.png`)
- [ ] Progress ring starts at 12 o'clock and grows clockwise with
      elapsed time
- [ ] Task picker is a **single card** with an inner search field and
      borderless rows
- [ ] Begin Focus is bright amber, disabled when no task selected
- [ ] Duration segmented control is content-width and centered, not
      stretched
- [ ] Running state shows `+5 min` capsule + session window + digits
      stacked inside the ring
- [ ] State pill text and color changes correctly with state

If any checkbox fails, don't submit — compare that element to the
mockup pixel-by-pixel and re-apply the spec.
