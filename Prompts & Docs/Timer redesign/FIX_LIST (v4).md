# Focus Panel — Fix List (Round 4)

**Target:** three remaining implementation gaps after Round 3.
**Reference:** `Pomodoro Redesign.html` is the canonical mockup. Use
it side-by-side. Baked screenshots in `reference/`.

---

## 🔴 #1 — Task picker: list is permanently expanded & not scrollable

**Repro (shipped screenshot 2, Dropdown-open state):**
- When the Focus panel first loads, the full 5-row recent-task list
  is already visible below the search input.
- There's no visible collapse control — no chevron on the picker header,
  no `Esc` handler to close it.
- The list itself does **not** scroll: if there are >5 recent tasks,
  rows after #5 are clipped instead of becoming scrollable.
- Once a task is selected, the selection row shows a down-chevron on
  the right (screenshot 1) but **clicking it does nothing** — same bug
  Round 3 called out, still unfixed.

**Required behavior:** the picker has two display modes, driven by a
single `pickerOpen` boolean.

### Collapsed mode (default when a task is selected)
Only the selected-task card is visible (screenshot 1 is correct shape).
Row 1 of the card shows:
- `#` prefix + task ID (mono, amber `#667776`)
- task title on the right side (text-3, mono, truncate with `…`)
- **down-chevron** `⌄` on the far right (text-3 color, 16 × 16 px)

Click behavior (critical — this is the bug):
- The **entire row 1** is the hit target, not just the chevron. Attach
  the handler at the `.id-field` level, not the SVG. Role `button`,
  `tabindex=0`, keyboard `Enter`/`Space` also opens.
- Clicking anywhere in row 1 **opens the picker** (`pickerOpen = true`).
- The chevron rotates 180° on open (`transform: rotate(180deg)`,
  250 ms ease).

### Expanded mode
The card's row 1 stays visible at the top (now acting as the picker
header). Below it:
- Search input (full-width sub-capsule, 40 px tall).
- `RECENT TASKS` section label (10.5 px uppercase amber, 0.08em
  letter-spacing, 12 px top-padding).
- Scrollable row list:

```css
.picker-list {
  max-height: 280px;                   /* ≈5 rows */
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: oklch(1 0 0 / 0.15) transparent;
}
.picker-list::-webkit-scrollbar { width: 4px; }
.picker-list::-webkit-scrollbar-thumb {
  background: oklch(1 0 0 / 0.15);
  border-radius: 4px;
}
```

- Each row is borderless at rest; hover lifts with
  `background: oklch(1 0 0 / 0.05); border-radius: 9px`.
- The currently-selected task row gets a **persistent** amber left
  accent bar (3 × 28 px, `var(--accent)`, 4 px margin-right) so users
  can see what they'll keep if they close without picking again.

Close behavior:
- Selecting a row → sets that as selected task, `pickerOpen = false`.
- `Esc` while focused anywhere inside the picker → closes, keeps
  previous selection.
- Click outside the card (on the panel background) → same as `Esc`.
- Chevron on row 1 also toggles (click while open → close, keep
  selection).

### Keyboard
- `ArrowDown`/`ArrowUp` navigates rows.
- `Enter` picks focused row.
- `/` anywhere in the panel opens the picker and focuses the search.
- `Esc` closes without changing.

---

## 🔴 #2 — Running-state header: task title is too large and stretched

**Repro (shipped screenshot 4):** the task title `E-maily, práce v ESku
a drobná …` renders at ~28 px weight 600, with the ellipsis cutting in
mid-word. It dominates the top of the panel and pushes the "Focusing"
pill into a weird stretched row.

**Expected (screenshot 3 is correct — the "Deep work / Session 4 of 8"
layout from the mockup):**

The running-state header is a two-line stack:

```
┌──────────────────────────────────────┐
│ Deep work                   [●Focusing]│   ← 20 px weight 600
│ Session 4 of 8                         │   ← 13 px text-3
└──────────────────────────────────────┘
```

Copy rules:
- **Line 1: always the string `Deep work`.** Do NOT show the task
  title in the header. The task title lives in the task-card *below*
  the clock. This keeps the header stable across sessions and prevents
  the truncation-in-header problem.
- Line 2: `Session ${n} of ${total}` (never `Session 0`).

Typography:
```css
.run-title { font-size: 20px; font-weight: 600; line-height: 1.2; }
.run-sub   { font-size: 13px; color: var(--text-3); margin-top: 2px; }
```

The "Focusing" pill sits on the same row as line 1, vertically centered,
pinned right. No wrapping.

**If product insists on showing the task title somewhere in the header:**
add it as a tertiary line only if it fits in one line at 13 px; otherwise
omit. But by default: don't.

---

## 🔴 #3 — Pause / Finish / Cancel buttons are stretched full-width

**Repro (screenshot 3):** the three action buttons each consume ~33% of
the panel width (≈220 px each). At 720 px panel width this means the
button row spans ~680 px and reads like a nav bar, not an action bar.

**Expected (screenshot 4 is correct):** buttons are **content-width**,
centered as a group, with 12 px gap between them. Specifically:

```css
.action-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
}

.btn-secondary,
.btn-danger {
  /* NO width, NO flex: 1, NO min-width overrides */
  height: 44px;
  padding: 0 18px;                  /* content-width via padding */
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
```

Remove any `flex: 1`, `width: 100%`, or grid-template that's forcing
buttons to stretch. Each button sizes to its own content + 18 px
horizontal padding.

Pause button variant:
- Background: `oklch(1 0 0 / 0.04)`, hairline border.
- Icon: pause glyph (two vertical bars) in text-2.
- On hover: background brightens to `oklch(1 0 0 / 0.08)`.

Finish button variant:
- Same neutral frame as Pause.
- Trailing `›` chevron indicating menu split.
- Click opens a small menu (`Finish & break`, `Finish & log`,
  `Finish without logging`).

Cancel button variant (keep from Round 3):
- Same neutral frame at rest; red tint only on hover.
- Leading `×` glyph (12 × 12 px, text-3 → danger on hover).

No blue focus ring in Chrome — override with:
```css
.action-bar button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```
(Screenshot 3 shows the default blue UA ring on the Pause button — the
focus state should be amber, matching the rest of the system.)

---

## Verification

- [ ] Picker starts **collapsed** when a task is already selected (the
      selected-task card is visible; the list is hidden).
- [ ] Clicking anywhere on the card's row 1 toggles the list open/close.
      The chevron rotates 180° on open.
- [ ] `Esc` and outside-click close the list and keep the previous
      selection.
- [ ] List is **scrollable** when it contains more than 5 rows; thin
      4 px amber-white scrollbar appears only on hover.
- [ ] Running-state header reads `Deep work` on line 1 and
      `Session N of 8` on line 2 at 20 / 13 px — **never** the task
      title in line 1.
- [ ] Pause / Finish / Cancel are **content-width**, grouped center,
      12 px gaps. No button is wider than ~110 px.
- [ ] Focus ring on action buttons is **amber**, not browser default
      blue.

---

## Out of scope for this round (tracked separately)
- Clock ring + inward ticks polish (Round 3 #2) — screenshot 4 shows this
  actually landed well; screenshot 3 shows a regression where ticks
  became too long and dense. Reconcile with the `.ticks` spec in Round 3
  if they don't match across both reduced and full width.
- Continue-previous button text color (Round 3 #6).
- RAF-driven arc sweep (Round 3 #9).
