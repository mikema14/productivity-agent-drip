import { BrowserWindow, app, screen } from 'electron';
import { join } from 'path';
import { getSetting } from '../src/services/db';
import type { SessionOverlayPayload } from '../src/types';

/**
 * The always-on-top session-end overlay.
 *
 * One fixed-size transparent window; the three visual states (ambient pill,
 * expanded card, break pill) are CSS-only transitions inside it. Resizing a
 * transparent macOS window per state janks and clips the halo, so we never do.
 *
 * Deliberately imports nothing from ./timer — overlay actions are relayed to
 * the main window renderer, which owns all timer logic.
 */

/**
 * The window is deliberately larger than the widest shape (384px card) so the
 * drop shadow and the escalation halo have room. At a smaller size the shadow
 * gets clipped by the window edge and shows as a hard dark line.
 */
const OVERLAY_W = 560;
const OVERLAY_H = 400;
/** Height of the top-edge attention strip window. */
const EDGE_H = 26;
const MARGIN_X = 12;
/**
 * macOS drops notification banners into the top-right corner, so the overlay
 * clears that band — otherwise a Teams or Mail banner sits on top of the pill.
 */
const MARGIN_Y = 96;

let overlay: BrowserWindow | null = null;
/**
 * Full-width strips along the top edge of EVERY display, shown only on
 * escalation. One per display: a window lives on a single display, so a single
 * strip would leave whichever screen the user is actually looking at bare.
 */
let edges: BrowserWindow[] = [];
let enabled = true;
let loaded = false;
/** Payload that arrived before the renderer finished loading. */
let pendingState: SessionOverlayPayload | null = null;
let lastKind: SessionOverlayPayload['kind'] | null = null;

const isDev = !app.isPackaged;

export function initOverlayEnabled(): void {
  try {
    enabled = getSetting('sessionEndOverlay') !== 'false';
  } catch {
    enabled = true;
  }
}

export function isOverlayEnabled(): boolean {
  return enabled;
}

export function setOverlayEnabled(value: boolean): void {
  enabled = value;
  if (!value) destroyOverlay();
}

/**
 * Display the user was last seen working on. Sampled while a timer runs, so a
 * pointer parked on another screen doesn't send the overlay to the wrong one —
 * which is the common case when working fullscreen on a second display.
 */
let lastActiveDisplayId: number | null = null;

export function sampleActiveDisplay(): void {
  try {
    lastActiveDisplayId = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
  } catch {
    // A display can disappear mid-sample; the next one will pick it up.
  }
}

function targetWorkArea() {
  const displays = screen.getAllDisplays();
  const remembered = displays.find((d) => d.id === lastActiveDisplayId);
  if (remembered) return remembered.workArea;
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}

function positionOverlay(win: BrowserWindow): void {
  try {
    const workArea = targetWorkArea();
    win.setBounds({
      x: Math.round(workArea.x + workArea.width - OVERLAY_W - MARGIN_X),
      y: Math.round(workArea.y + MARGIN_Y),
      width: OVERLAY_W,
      height: OVERLAY_H,
    });
  } catch (error) {
    console.error('[Overlay] Failed to position:', error);
  }
}

function createOverlay(): BrowserWindow {
  const win = new BrowserWindow({
    width: OVERLAY_W,
    height: OVERLAY_H,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false, // an OS shadow would trace the square window, not the pill
    resizable: false,
    // Not movable: a -webkit-app-region drag handle swallows mouse events on
    // macOS, so dragging and hover/click cannot coexist on the same surface.
    // See "Prompts & Docs/OVERLAY_DRAGGABLE_NOTES.md".
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    acceptFirstMouse: true,
    focusable: true, // must stay true or the note input cannot receive keys
    roundedCorners: false, // CSS owns the radius
    webPreferences: {
      preload: join(__dirname, 'overlayPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Click-through by default; `forward: true` still delivers mousemove so the
  // renderer can ask for interactivity when the cursor enters the shape.
  win.setIgnoreMouseEvents(true, { forward: true });

  loaded = false;
  win.webContents.on('did-finish-load', () => {
    loaded = true;
    if (pendingState) {
      win.webContents.send('overlay:state', pendingState);
      pendingState = null;
    }
  });

  win.on('closed', () => {
    overlay = null;
    loaded = false;
    lastKind = null;
  });

  loadOverlayHtml(win);
  if (isDev && process.env.DRIP_OVERLAY_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  return win;
}

function loadOverlayHtml(win: BrowserWindow, search?: string): void {
  if (isDev) {
    win.loadURL(`http://localhost:5173/overlay.html${search ? `?${search}` : ''}`);
  } else {
    win.loadFile(join(__dirname, '../dist/overlay.html'), search ? { search } : undefined);
  }
}

/**
 * The escalation cue: a breathing amber strip across the whole top edge of the
 * active display. A small static card in a corner is what peripheral vision
 * filters out; full-width motion is not. Never interactive, covers no content.
 */
function showEdgeGlow(): void {
  hideEdgeGlow();
  for (const display of screen.getAllDisplays()) {
    try {
      const { workArea } = display;
      const win = new BrowserWindow({
        x: workArea.x,
        y: workArea.y,
        width: workArea.width,
        height: EDGE_H,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        focusable: false, // nothing to click; never take focus
        roundedCorners: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          backgroundThrottling: false,
        },
      });

      win.setAlwaysOnTop(true, 'screen-saver');
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.setIgnoreMouseEvents(true);

      loadOverlayHtml(win, 'edge=1');
      // setBounds again after load: a transparent window can be nudged by the
      // compositor before its first paint.
      win.setBounds({ x: workArea.x, y: workArea.y, width: workArea.width, height: EDGE_H });
      win.showInactive();
      edges.push(win);
    } catch (error) {
      console.error(`[Overlay] Failed to show edge glow on display ${display.id}:`, error);
    }
  }
}

function hideEdgeGlow(): void {
  for (const win of edges) {
    if (!win.isDestroyed()) win.destroy();
  }
  edges = [];
}

function isEdgeGlowVisible(): boolean {
  return edges.some((win) => !win.isDestroyed() && win.isVisible());
}

export function setOverlayEscalated(escalated: boolean): void {
  if (!escalated) {
    hideEdgeGlow();
    return;
  }

  // Escalation happens a minute after the session ended, by which time the
  // timer has stopped sampling — so re-read where the user is now and bring
  // the card to that display before lighting every screen.
  sampleActiveDisplay();
  if (overlay && !overlay.isDestroyed() && overlay.isVisible()) {
    positionOverlay(overlay);
  }
  showEdgeGlow();
}

function ensureOverlay(): BrowserWindow | null {
  if (overlay && !overlay.isDestroyed()) return overlay;
  try {
    overlay = createOverlay();
    return overlay;
  } catch (error) {
    console.error('[Overlay] Failed to create window:', error);
    overlay = null;
    return null;
  }
}

export function sendOverlayState(payload: SessionOverlayPayload): boolean {
  const win = ensureOverlay();
  if (!win) return false;

  lastKind = payload.kind;
  hideEdgeGlow();
  if (loaded) {
    win.webContents.send('overlay:state', payload);
  } else {
    pendingState = payload;
  }
  return true;
}

export function showOverlay(payload: SessionOverlayPayload): boolean {
  if (!enabled) return false;
  if (!sendOverlayState(payload)) return false;

  const win = overlay!;
  positionOverlay(win);
  if (!win.isVisible()) {
    // Never show()/focus() — the overlay must not steal keyboard focus.
    win.showInactive();
  }
  return true;
}

export function hideOverlay(): void {
  if (overlay && !overlay.isDestroyed() && overlay.isVisible()) {
    overlay.setIgnoreMouseEvents(true, { forward: true });
    overlay.hide();
  }
  hideEdgeGlow();
  lastKind = null;
}

export function setOverlayInteractive(interactive: boolean): void {
  if (!overlay || overlay.isDestroyed()) return;
  if (interactive) {
    // `forward` is only meaningful while ignoring; passing it here is undefined
    // behaviour on macOS.
    overlay.setIgnoreMouseEvents(false);
  } else {
    overlay.setIgnoreMouseEvents(true, { forward: true });
  }
}

export function sendTickToOverlay(status: 'idle' | 'focus' | 'break', remainingSeconds: number): void {
  if (!overlay || overlay.isDestroyed() || !overlay.isVisible()) return;
  if (status !== 'break' || lastKind !== 'break-running') return;
  overlay.webContents.send('overlay:tick', remainingSeconds);
}

export function repositionOverlayIfVisible(): void {
  if (overlay && !overlay.isDestroyed() && overlay.isVisible()) {
    positionOverlay(overlay);
  }
  // Displays changed: rebuild the strips so a new screen gets one and a
  // removed screen's window goes away.
  if (isEdgeGlowVisible()) {
    showEdgeGlow();
  }
}

export function isOverlayVisible(): boolean {
  return !!overlay && !overlay.isDestroyed() && overlay.isVisible();
}

export function destroyOverlay(): void {
  hideEdgeGlow();
  if (overlay && !overlay.isDestroyed()) {
    overlay.destroy();
  }
  overlay = null;
  loaded = false;
  pendingState = null;
  lastKind = null;
}
