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

const OVERLAY_W = 420;
const OVERLAY_H = 280;
const MARGIN_X = 12;
/**
 * macOS drops notification banners into the top-right corner, so the overlay
 * clears that band — otherwise a Teams or Mail banner sits on top of the pill.
 */
const MARGIN_Y = 96;

let overlay: BrowserWindow | null = null;
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

function positionOverlay(win: BrowserWindow): void {
  try {
    const point = screen.getCursorScreenPoint();
    const { workArea } = screen.getDisplayNearestPoint(point);
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

  if (isDev) {
    win.loadURL('http://localhost:5173/overlay.html');
    if (process.env.DRIP_OVERLAY_DEVTOOLS === '1') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    win.loadFile(join(__dirname, '../dist/overlay.html'));
  }

  return win;
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
  lastKind = null;
}

export function setOverlayInteractive(interactive: boolean): void {
  if (!overlay || overlay.isDestroyed()) return;
  overlay.setIgnoreMouseEvents(!interactive, { forward: true });
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
}

export function isOverlayVisible(): boolean {
  return !!overlay && !overlay.isDestroyed() && overlay.isVisible();
}

export function destroyOverlay(): void {
  if (overlay && !overlay.isDestroyed()) {
    overlay.destroy();
  }
  overlay = null;
  loaded = false;
  pendingState = null;
  lastKind = null;
}
