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

interface OverlayState {
  win: BrowserWindow | null;
  /**
   * Full-width strips along the top edge of EVERY display, shown only on
   * escalation. One per display: a window lives on a single display, so a
   * single strip would leave whichever screen the user is looking at bare.
   */
  edges: Array<{ displayId: number; win: BrowserWindow }>;
  loaded: boolean;
  /** Payload that arrived before the renderer finished loading. */
  pendingState: SessionOverlayPayload | null;
  lastKind: SessionOverlayPayload['kind'] | null;
  /**
   * Display the user was last seen working on. Sampled while a timer runs, so
   * a pointer parked on another screen doesn't send the overlay to the wrong
   * one — the common case when working fullscreen on a second display.
   */
  lastActiveDisplayId: number | null;
  /** The user's setting, not lifecycle state — resetState() leaves it alone. */
  enabled: boolean;
}

const state: OverlayState = {
  win: null,
  edges: [],
  loaded: false,
  pendingState: null,
  lastKind: null,
  lastActiveDisplayId: null,
  enabled: true,
};

/** Clears everything tied to the overlay window's lifetime. */
function resetState(): void {
  state.win = null;
  state.loaded = false;
  state.pendingState = null;
  state.lastKind = null;
}

const isDev = !app.isPackaged;

export function initOverlayEnabled(): void {
  try {
    state.enabled = getSetting('sessionEndOverlay') !== 'false';
  } catch {
    state.enabled = true;
  }
}

export function isOverlayEnabled(): boolean {
  return state.enabled;
}

export function setOverlayEnabled(value: boolean): void {
  state.enabled = value;
  if (!value) destroyOverlay();
}

export function sampleActiveDisplay(): void {
  try {
    state.lastActiveDisplayId = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
  } catch {
    // A display can disappear mid-sample; the next one will pick it up.
  }
}

function targetWorkArea() {
  const displays = screen.getAllDisplays();
  const remembered = displays.find((d) => d.id === state.lastActiveDisplayId);
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

  state.loaded = false;
  win.webContents.on('did-finish-load', () => {
    state.loaded = true;
    if (state.pendingState) {
      win.webContents.send('overlay:state', state.pendingState);
      state.pendingState = null;
    }
  });

  win.on('closed', resetState);

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
  const displays = screen.getAllDisplays();
  const live = state.edges.filter(({ win }) => !win.isDestroyed());
  const sameDisplays =
    live.length === displays.length && displays.every((d) => live.some((e) => e.displayId === d.id));

  // Displays unchanged: move the strips we already have. Rebuilding a
  // BrowserWindow per display on every reposition is visibly slower.
  if (sameDisplays) {
    try {
      for (const { displayId, win } of live) {
        const { workArea } = displays.find((d) => d.id === displayId)!;
        win.setBounds({ x: workArea.x, y: workArea.y, width: workArea.width, height: EDGE_H });
        if (!win.isVisible()) win.showInactive();
      }
      state.edges = live;
      return;
    } catch (error) {
      console.error('[Overlay] Failed to reposition edge glow, rebuilding:', error);
    }
  }

  hideEdgeGlow();
  for (const display of displays) {
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
      state.edges.push({ displayId: display.id, win });
    } catch (error) {
      console.error(`[Overlay] Failed to show edge glow on display ${display.id}:`, error);
    }
  }
}

function hideEdgeGlow(): void {
  for (const { win } of state.edges) {
    if (!win.isDestroyed()) win.destroy();
  }
  state.edges = [];
}

function isEdgeGlowVisible(): boolean {
  return state.edges.some(({ win }) => !win.isDestroyed() && win.isVisible());
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
  if (isOverlayVisible()) {
    positionOverlay(state.win!);
  }
  showEdgeGlow();
}

function ensureOverlay(): BrowserWindow | null {
  if (state.win && !state.win.isDestroyed()) return state.win;
  try {
    state.win = createOverlay();
    return state.win;
  } catch (error) {
    console.error('[Overlay] Failed to create window:', error);
    resetState();
    return null;
  }
}

export function sendOverlayState(payload: SessionOverlayPayload): boolean {
  const win = ensureOverlay();
  if (!win) return false;

  state.lastKind = payload.kind;
  hideEdgeGlow();
  if (state.loaded) {
    win.webContents.send('overlay:state', payload);
  } else {
    state.pendingState = payload;
  }
  return true;
}

/**
 * `force` skips the session-end toggle: the idle nudge and the kickoff prompt
 * have their own switch ("Idle nudge") and must work with the card turned off.
 */
export function showOverlay(payload: SessionOverlayPayload, { force = false }: { force?: boolean } = {}): boolean {
  if (!state.enabled && !force) return false;
  if (!sendOverlayState(payload)) return false;

  const win = state.win!;
  positionOverlay(win);
  if (!win.isVisible()) {
    // Never show()/focus() — the overlay must not steal keyboard focus.
    win.showInactive();
  }
  return true;
}

export function hideOverlay(): void {
  if (isOverlayVisible()) {
    state.win!.setIgnoreMouseEvents(true, { forward: true });
    state.win!.hide();
  }
  hideEdgeGlow();
  state.lastKind = null;
}

export function setOverlayInteractive(interactive: boolean): void {
  if (!state.win || state.win.isDestroyed()) return;
  if (interactive) {
    // `forward` is only meaningful while ignoring; passing it here is undefined
    // behaviour on macOS.
    state.win.setIgnoreMouseEvents(false);
  } else {
    state.win.setIgnoreMouseEvents(true, { forward: true });
  }
}

export function sendTickToOverlay(status: 'idle' | 'focus' | 'break', remainingSeconds: number): void {
  if (!isOverlayVisible()) return;
  if (status !== 'break' || state.lastKind !== 'break-running') return;
  state.win!.webContents.send('overlay:tick', remainingSeconds);
}

export function repositionOverlayIfVisible(): void {
  if (isOverlayVisible()) {
    positionOverlay(state.win!);
  }
  // Displays changed: rebuild the strips so a new screen gets one and a
  // removed screen's window goes away.
  if (isEdgeGlowVisible()) {
    showEdgeGlow();
  }
}

/** What the overlay is showing, or null when hidden. */
export function getVisibleOverlayKind(): SessionOverlayPayload['kind'] | null {
  return isOverlayVisible() ? state.lastKind : null;
}

export function isOverlayVisible(): boolean {
  return !!state.win && !state.win.isDestroyed() && state.win.isVisible();
}

export function destroyOverlay(): void {
  hideEdgeGlow();
  if (state.win && !state.win.isDestroyed()) {
    state.win.destroy();
  }
  resetState();
}
