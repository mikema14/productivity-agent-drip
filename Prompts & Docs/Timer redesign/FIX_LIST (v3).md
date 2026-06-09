# Focus Panel — Fix List (Round 3)

**Target:** close the remaining visual gap between the shipped build and
the approved mockup.

**Reference material (open side-by-side while fixing):**
- `Pomodoro Redesign.html` — canonical mockup. All states accessible via
  Tweaks panel (bottom-right).
- `reference/01-ready-empty.png`, `reference/02-ready-selected.png`,
  `reference/03-running.png` — baked screenshots.
- `uploads/pasted-1776974516622-0.png` — original Drip running-state
  reference. **This is the aesthetic target for the clock.**

**Round-2 progress audit** (what was fixed, what wasn't):

| Item | Round 2 status | Round 3 status |
|---|---|---|
| Continue-previous icon color | ✅ |
| Duration picker content-width | ✅ |
| Task picker outer bracket | ✅ |
| `Session 0` bug | ✅ (now reads `Session 1`) |
| `+5 min` + time-window inner face | ✅ |
| Amber tinted running-state task card | ✅ |
| Cancel framed button | ✅ |
| State pill "Focusing" | ✅ |
| Task picker — list opens from a selected-task state | ❌ Still broken |
| Clock visual minimalism & ring weight | ❌ Still wrong |
| Progress arc direction + visibility | ❌ Still wrong |
| Begin Focus — full-bleed, amber, disabled when no task | ⚠️ Part fixed |

Everything marked ❌ or ⚠️ is in scope for Round 3.

---

## 🔴 #1 — Task picker **cannot be reopened** once a task is selected

**Repro (screenshot 2):** After picking a task, the picker collapses
into the selected-task card. Clicking the down-chevron on that card has
no effect — there is no way to return to the list and pick a different
one without a refresh.

**Required behavior:**

- Clicking the chevron (or anywhere on row 1 of the selected-task card,
  *except* the `#id` chip and the title text if/when they become editable)
  **reopens the picker**. The selected task is remembered; the search
  field is pre-populated with nothing; the matching row in the recent
  list is highlighted.
- Keyboard: `Esc` while focused anywhere inside the card also reopens.
- Alternate entry: clicking the `#id` chip or the task title in the
  selected-task card also reopens (whole row is clickable).
- Picker has a clear visible "close without changing selection" affordance:
  when a task is already selected, show an amber `✓ Keep current` chip at
  the top-right of the picker header. Clicking it closes and keeps the
  previous pick. `Esc` does the same.

**Implementation pointer:** this is almost certainly a state-machine
issue — the chevron handler probably no-ops because it's wired to
`onClick` on the chevron SVG itself instead of the row. Bubble it up;
let the whole row 1 be the hit target with `role="button"` and
`tabindex="0"`.

**Secondary:** also wire `/` (forward-slash) anywhere in the panel to
focus the search field and open the picker if collapsed. This matches
our other search affordances.

---

## 🔴 #2 — Clock is still not minimalist or polished

### What's wrong (compare screenshots 1 and 3 to `reference/03-running.png`)

1. **No primary ring.** In the mockup — and especially in the original
   Drip reference — the clock has a single **visible ring** that forms
   the boundary of the dial. In the shipped build, the boundary is so
   faint it reads as absent. The dial looks like "floating ticks + big
   digits" with nothing holding it together.

2. **Ticks are too dense, too dim, and face the wrong way.**
   - Shipped: ~60 equal-weight tiny ticks, all pointing *outward*
     from an invisible ring.
   - Correct: **12 major ticks + 48 minor ticks = 60 total**, pointing
     *inward* from the outer ring. Majors are 2× the weight and length
     of minors. Minors are thin hairlines; majors are solid.

3. **Running-state progress arc is a nub.** Screenshot 3 shows a ~2 mm
   amber vertical line at roughly the 9 o'clock position. That's meant
   to be a **sweeping arc** from 12 o'clock that grows clockwise as
   time elapses. Right now it's rendering as if `--progress: 0.003`
   even when ~14 s have passed — probably because the `conic-gradient`
   stop is computed against seconds instead of elapsed/total, or the
   CSS variable isn't being updated live.

4. **No session dots inside the ring in running state** (mockup has a
   row of 8 small dots near the bottom of the dial indicating
   session progress within the cycle — see original Drip reference).
   The shipped build moves them *outside* the clock, directly under it.
   Move them back **inside**, just above the digits' bottom curve.

### The exact clock spec (apply verbatim)

```css
/* Outer ring: the prominent boundary */
.clock {
  position: relative;
  width: 320px; height: 320px;
  margin: 0 auto;
}
.clock::before {                     /* the visible ring */
  content: "";
  position: absolute; inset: 0;
  border-radius: 50%;
  border: 1px solid oklch(1 0 0 / 0.14);
  /* ring becomes amber when running — see state overrides below */
}

/* Tick marks: inside the ring, pointing inward */
.ticks { position: absolute; inset: 14px; }  /* 14 px inset = ring + 13 px gap */
.tick {
  position: absolute; left: 50%; top: 0;
  width: 1px; height: 6px;
  margin-left: -0.5px;
  background: oklch(1 0 0 / 0.22);
  transform-origin: 50% 146px;       /* = (320/2 - 14) */
  border-radius: 1px;
}
.tick.major {
  width: 1.5px; height: 11px;
  background: oklch(1 0 0 / 0.42);
  margin-left: -0.75px;
}
/* Generate 60 ticks; every 5th gets .major */
/* JSX: Array.from({length: 60}).map((_, i) => (
     <i class={"tick" + (i % 5 === 0 ? " major" : "")}
        style={{transform: `rotate(${i * 6}deg)`}} />)) */

/* Progress arc: sweeps from 12 o'clock */
.arc {
  position: absolute; inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from -90deg,
    var(--accent) calc(var(--progress, 0) * 360deg),
    transparent 0
  );
  -webkit-mask: radial-gradient(farthest-side,
                 transparent calc(100% - 2px),
                 #000 calc(100% - 1.5px) calc(100% - 0.5px),
                 transparent calc(100% - 0.25px));
          mask: radial-gradient(farthest-side,
                 transparent calc(100% - 2px),
                 #000 calc(100% - 1.5px) calc(100% - 0.5px),
                 transparent calc(100% - 0.25px));
  opacity: 0;
  transition: opacity 200ms;
}
.clock.running .arc { opacity: 1; }

/* Running-state ring brightens */
.clock.running::before {
  border-color: oklch(0.78 0.14 70 / 0.35);
  box-shadow: 0 0 48px oklch(0.78 0.14 70 / 0.12);
}
```

**CSS variable update (critical):** `--progress` must be updated with
`requestAnimationFrame`, not on a 1 s `setInterval`. The arc should
visibly grow in real time, not jump every second.

```jsx
useEffect(() => {
  let raf;
  const tick = () => {
    const elapsed = Date.now() - startedAt;
    const total = durationMin * 60 * 1000;
    clockEl.current.style.setProperty('--progress', Math.min(1, elapsed / total));
    raf = requestAnimationFrame(tick);
  };
  if (running) raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [running, startedAt, durationMin]);
```

### Inner face composition (running state only)

Stack, centered, inside the ring (top → bottom):

1. **`+5 min` capsule** — 22 px tall, 10 px horizontal padding,
   border-radius 999 px, `oklch(1 0 0 / 0.05)` fill, 0.5 px
   `var(--hairline)` border, text-2 color, 11 px weight 500. Clickable.
2. **Session window** — mono, 12 px, text-3 color, letter-spacing
   0.04em: `22:01 → 22:26`. The arrow is `→` at 0.55 opacity.
3. **Digits** — 86 px weight 300, tabular-nums, letter-spacing
   -0.035em. `MM:SS` with a blinking colon (step-end 1 s).
4. **Session dots** — 8 dots, 4 px diameter, 6 px apart, horizontal row.
   Current-session dot is filled amber; completed are amber 40 % opacity;
   remaining are text-4.

Current shipped build has items 1-3 correct but **missing the colon**
between digits (it reads `14 46` instead of `14:46` — look at screenshot 3).
Add the colon back.

---

## 🟡 #3 — Begin Focus button sizing

**Currently (screenshot 2):** amber color is now correct, but the button
is a small centered pill — ~120 px wide. That's too small for the
primary action of a panel this wide.

**Expected:**

```css
.btn-primary {
  width: 100%;                    /* full width of the action row */
  max-width: 420px;               /* but cap it */
  margin: 0 auto;                 /* centered */
  height: 48px;                   /* slightly taller */
  font-size: 14px;
  font-weight: 550;
}
```

At 640 px panel width this gives a prominent 420 px-wide amber button
centered below the task card. At 360 px it's full-width minus panel
padding.

Also: the **ready-empty state** (screenshot 1) shows Begin Focus as a
*muted brown* pill — it should be **disabled** here because no task is
selected. Disabled style = 40 % opacity, not a different color. If the
button is currently using the same amber token but with reduced opacity,
verify the background is still rendering `var(--accent)` underneath the
opacity layer, not a pre-dimmed brown.

---

## 🟡 #4 — Task card after selection shows the note placeholder incorrectly

**Screenshot 2:** The selected-task card shows `Session note (optional)`
as a **visible label** with an icon, on its own line, with no input
field visible beneath it.

**Expected:** the placeholder copy lives *inside* an `<input>`:

```html
<input class="note-input"
       placeholder="Session note (optional)"
       aria-label="Session note">
```

Styled:

```css
.note-input {
  width: 100%;
  height: 36px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-1);
  font-size: 13px;
  padding-left: 24px;      /* room for the leading icon */
}
.note-input::placeholder { color: var(--text-3); font-style: italic; }
```

The icon (speech-bubble or pencil) sits absolutely at `left: 0`.
Clicking anywhere in the row focuses the input. Once typed, the
italic placeholder disappears and real text is `var(--text-1)`
(bright white).

---

## 🟡 #5 — Client + session-count foot row order

**Screenshot 2** shows `ATM Automations (n8n Catalogue)` on the left
(client) and `Today · 0/8 sessions` on the right. Structure is correct,
**but**:

- Client text should be in mono `11.5 px text-3`, not bolded amber.
- `ATM` is a favicon — make sure it's 14 × 14 px, not taller.
- The `·` separator in `Today · 0/8 sessions` should be `var(--text-4)`
  and have 6 px of horizontal padding around it.

---

## 🟢 #6 — Continue-previous CTA button has wrong tone

**Screenshot 1:** the `Continue →` button on the amber banner has amber
background + **white** text. Expected (per mockup): amber background +
**warm near-black** text (`oklch(0.18 0.01 60)`), matching the primary
button. White text on amber fails WCAG AA at that size.

---

## 🟢 #7 — `Ready` pill hugs the right edge

**Screenshot 1:** state pill is butted against the right padding of the
panel. Give it `margin-right: 0` but add `right: 40px` alignment so it
aligns with the 40 px panel padding, not the panel edge itself. (It
currently looks like it's hanging off.)

---

## 🟢 #8 — Running-state header ("Deep work · Session 1")

**Screenshot 3:** header reads `Deep work` with `Session 1` beneath.
Two nits:

1. The running-state title should be the **task title**, not a
   generic `Deep work` label. Example: `ER to Raynet integration`.
   Only if the task lacks a title do we fall back to "Focus session".
2. `Session 1` is correct format, but **pad** to match total:
   `Session 1 of 8`. Right now it reads as ambiguous.

---

## Cross-cutting

### #9 🔴 Arc animation must be RAF-driven (see #2 spec block)

The single biggest "feels broken" signal is the arc not sweeping. Fix
that and the running state immediately reads as alive.

### #10 🟡 Clock diameter responsive

At viewport < 480 px, shrink clock from 320 × 320 to 280 × 280; at
< 400 px, 240 × 240. Digits scale to 72 px and 60 px respectively.
Ticks re-compute `transform-origin` from the inset formula above.

---

## Verification checklist

Attach side-by-side screenshots for each item below. If any fails, do
not submit — go back and compare pixel-by-pixel against the named
reference file.

- [ ] **Task picker reopens** when chevron / card row 1 is clicked after
      a task is selected (manual QA)
- [ ] Clock has a **visible ring** at rest (~14 % white border at 1 px)
- [ ] Ticks are **60 total**, **12 major** + **48 minor**, **pointing
      inward** — compare directly to `uploads/pasted-1776974516622-0.png`
- [ ] Running-state progress arc **sweeps** from 12 o'clock clockwise
      and updates at 60 fps (watch it for 10 seconds in the running
      state; the arc visibly grows)
- [ ] Running-state ring **glows amber** (not neutral)
- [ ] Digits show `MM:SS` with a **blinking colon** between
- [ ] Session dots live **inside** the ring, just above digits' baseline
- [ ] Begin Focus is **full-width-up-to-420px** and amber, disabled at
      40 % opacity when no task selected
- [ ] Task note field shows placeholder-only by default and becomes
      editable on focus (no standalone "Session note (optional)" label)
- [ ] Continue-previous button text is **warm black** on amber, not white

If more than two checkboxes fail, re-read each item's "Currently:" and
"Expected:" block before continuing.
