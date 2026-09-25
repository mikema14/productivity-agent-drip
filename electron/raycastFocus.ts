import { app } from 'electron';
import { spawn, execFileSync } from 'child_process';
import { getSetting, getCachedTask } from '../src/services/db';

/**
 * Mirrors Drip focus sessions into Raycast Focus (the app/website blocker).
 *
 * Drip is master: timer.ts calls start/end on every focus transition, and
 * Raycast never drives Drip. Raycast has no status API, so `active` only
 * tracks whether Drip started the current Raycast session.
 *
 * Links go through `open -g` rather than shell.openExternal — Raycast acts on
 * both instantly, but openExternal's promise can hang ~30s, and `-g` keeps
 * Raycast from coming to the front.
 */

/** Raycast refuses `start` while any session is active, so we `complete` first. */
const START_DELAY_MS = 300;
/**
 * Raycast's built-in blocklist category ids. Deeplinks don't reuse the last
 * selection from Raycast's own form — without this nothing gets blocked.
 */
const BLOCK_CATEGORIES = 'social,streaming,gaming';

let active = false;
let pendingStart: NodeJS.Timeout | null = null;

function openInBackground(url: string): void {
  try {
    const child = spawn('/usr/bin/open', ['-g', url], { detached: true, stdio: 'ignore' });
    child.on('error', (error) => console.error('[RaycastFocus] Failed to open', url, error));
    child.on('exit', (code) => {
      if (code) console.warn(`[RaycastFocus] open exited with ${code} for ${url}`);
    });
    child.unref();
  } catch (error) {
    console.error('[RaycastFocus] Failed to open', url, error);
  }
}

function isEnabled(): boolean {
  // DRIP_TEST_MODE: agent/QA runs must not start Raycast Focus on the user's Mac
  if (process.env.DRIP_TEST_MODE === '1') return false;
  try {
    return getSetting('raycastFocusEnabled') !== 'false'
      && app.getApplicationNameForProtocol('raycast://') !== '';
  } catch {
    return false;
  }
}

function isRaycastRunning(): boolean {
  try {
    execFileSync('/usr/bin/pgrep', ['-xq', 'Raycast']);
    return true;
  } catch {
    return false;
  }
}

function sessionGoal(taskId: string | null | undefined): string {
  if (!taskId) return 'Drip focus';
  try {
    const task = getCachedTask(taskId) as { title?: string } | undefined;
    if (task?.title) return task.title;
  } catch {
    // Fall through to the bare task ID
  }
  return `Task ${taskId}`;
}

function clearPendingStart(): void {
  if (pendingStart) {
    clearTimeout(pendingStart);
    pendingStart = null;
  }
}

/** Start (or restart) a Raycast Focus session lasting `seconds`. */
export function raycastFocusStart(seconds: number, taskId?: string | null): void {
  if (seconds <= 0 || !isEnabled()) return;

  clearPendingStart();

  const url = `raycast://focus/start?goal=${encodeURIComponent(sessionGoal(taskId))}`
    + `&duration=${Math.round(seconds)}&mode=block&categories=${BLOCK_CATEGORIES}`;

  // On a cold launch Raycast handles queued links out of order (start, then
  // complete), and there is no session to clear anyway — so send start alone.
  if (!isRaycastRunning()) {
    openInBackground(url);
    active = true;
    console.log(`[RaycastFocus] Started ${Math.round(seconds)}s session (cold launch)`);
    return;
  }

  openInBackground('raycast://focus/complete');
  pendingStart = setTimeout(() => {
    pendingStart = null;
    openInBackground(url);
    active = true;
    console.log(`[RaycastFocus] Started ${Math.round(seconds)}s session`);
  }, START_DELAY_MS);
}

/**
 * End the Raycast session Drip started, if any. Ignores the setting on
 * purpose, so switching the toggle off mid-session still ends it cleanly.
 */
export function raycastFocusEnd(): void {
  clearPendingStart();
  if (!active) return;

  active = false;
  openInBackground('raycast://focus/complete');
  console.log('[RaycastFocus] Completed session');
}
