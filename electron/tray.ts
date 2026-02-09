import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { join } from 'path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow | null) {
  // Create a simple icon (you can replace this with an actual icon file)
  const icon = createTrayIcon();

  tray = new Tray(icon);
  tray.setToolTip('Drip');

  updateTrayMenu(mainWindow);

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

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
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
