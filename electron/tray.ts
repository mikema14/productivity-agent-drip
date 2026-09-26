import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { join } from 'path';
import { getNudgePausedUntil, onNudgePauseChange, pauseNudges, resumeNudges } from './idleNudge';
import { buildTrayMenuTemplate, trayToolTip } from './trayMenu';

let tray: Tray | null = null;
let unsubscribePause: (() => void) | null = null;

export function createTray(mainWindow: BrowserWindow | null) {
  // Don't create duplicate tray icons
  if (tray) return;

  // Create a simple icon (you can replace this with an actual icon file)
  const icon = createTrayIcon();

  tray = new Tray(icon);

  updateTrayMenu(mainWindow);
  // "Pause nudges" ↔ "Resume nudges": the menu follows the pause wherever it
  // came from (the nudge card's Snooze, this menu, expiry, a focus starting).
  unsubscribePause = onNudgePauseChange(() => updateTrayMenu(mainWindow));

  // Show window on tray click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function updateTrayMenu(mainWindow: BrowserWindow | null) {
  if (!tray) return;

  const pausedUntil = getNudgePausedUntil();
  const now = Date.now();
  const contextMenu = Menu.buildFromTemplate(
    buildTrayMenuTemplate(pausedUntil, now, {
      showApp: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
      quit: () => {
        app.isQuitting = true;
        app.quit();
      },
      pauseNudges: (choice) => pauseNudges(choice),
      resumeNudges: () => resumeNudges()
    })
  );

  tray.setContextMenu(contextMenu);
  tray.setToolTip(trayToolTip(pausedUntil, now));
}

let lastTrayTitle = '';

export function updateTray(title: string) {
  if (!tray) {
    console.warn('Tray not initialized, cannot update title');
    return;
  }

  // Skip update if title hasn't changed (throttling)
  if (title === lastTrayTitle) {
    return;
  }

  try {
    tray.setTitle(title);
    lastTrayTitle = title;
  } catch (error) {
    console.error('Failed to update tray title:', error);
  }
}

export function destroyTray() {
  if (unsubscribePause) {
    unsubscribePause();
    unsubscribePause = null;
  }
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

// Create a simple tray icon
// In production, you should use an actual icon file from public/
function createTrayIcon() {
  // Try to load icon from public directory
  try {
    const iconPath = join(__dirname, '../public/icon.png');
    return nativeImage.createFromPath(iconPath);
  } catch (error) {
    // Fallback: create a simple template icon
    // For macOS, template icons should be monochrome and named with "Template" suffix
    const size = 16;
    const canvas = createCanvas(size);

    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw a simple clock icon
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.lineTo(size / 2, 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.lineTo(size - 4, size / 2);
        ctx.stroke();
      }

      return nativeImage.createFromDataURL(canvas.toDataURL());
    }
  }

  // Final fallback: empty image
  return nativeImage.createEmpty();
}

// Simple canvas polyfill for Node.js environment
function createCanvas(size: number): HTMLCanvasElement | null {
  // In a real Node.js environment without a canvas library,
  // this would return null. For Electron, you might want to
  // use a proper icon file instead.
  return null;
}
