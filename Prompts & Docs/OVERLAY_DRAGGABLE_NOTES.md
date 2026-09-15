# Session-end overlay — making it draggable (deferred)

Status: **attempted, reverted 2026-09-10.** The overlay is pinned to the
top-right of the active display's work area (12px right, 96px down to clear the
macOS notification band). Hover expands the pill into the card.

## Why it matters

On a laptop-only display the pinned overlay can cover editor text or settings
controls in whatever app is underneath. On a large external monitor the fixed
corner is fine. Worth revisiting.

## What was tried

`electron/overlayWindow.ts`: `movable: true`, `-webkit-app-region: drag` on the
pill/card surface, `-webkit-app-region: no-drag` on the buttons, ✕ and note
input. Position persisted to the `overlayPosition` setting as an inset from the
display work area's top-right (not absolute coords, so it stays sane across
displays of different sizes), clamped into the work area on show.

Dragging itself **worked**.

## Why it was reverted

**A `-webkit-app-region: drag` surface swallows mouse events on macOS.** Inside
a drag region, `click`, `mousedown` and `mouseup` never reach the renderer, so:

- Hover-to-expand kept working (that is driven by window-level `mousemove`,
  which `setIgnoreMouseEvents(true, { forward: true })` still forwards).
- Click-to-expand did not fire at all.
- Inferring a click from a press/release pair with no movement did not work
  either — neither event arrives.

So drag and click cannot share a surface. Two further problems surfaced:

1. **Hover-expand is incompatible with dragging even in principle.** While
   dragging, the cursor is by definition over the shape, so the card stays
   expanded; after the drop it is still under the cursor and stays open. The
   collapse trigger (cursor leaves the shape) can never fire during the gesture
   the user just performed.
2. **`setBounds()` also emits `moved`.** A position clamped to fit a smaller
   display was written back as the user's preference, so one appearance on the
   laptop would permanently overwrite the position chosen on the external
   monitor. Fixed at the time with a `positioningProgrammatically` guard — keep
   that if this is revisited.

## Viable approaches if picked up again

- **Dedicated grip.** Keep hover-expand on the body and put the drag region on
  a small explicit handle (e.g. a 16px grab strip at the card's left edge, or
  the header row only). Costs a visual element in a design that is deliberately
  bare.
- **Modifier drag.** Drag only while a modifier is held, implemented manually:
  no drag region at all, `mousedown` + `mousemove` in the renderer calling a
  `setBounds` IPC. Keeps clicks and hover intact and needs no app-region. This
  is the most promising route — the window is already `frame: false`, so
  nothing prevents moving it from JS.
- **Position preference instead of dragging.** A Settings control for corner
  (top-left / top-right / bottom-right / bottom-left) plus an offset. Solves the
  laptop-occlusion problem without any gesture conflict, and is much less code.

If revisiting, restore the `positioningProgrammatically` guard and the
inset-from-work-area persistence shape; both were correct.
