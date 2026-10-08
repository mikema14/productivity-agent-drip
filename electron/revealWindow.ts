import { BrowserWindow, screen } from 'electron';
import { recoverBounds } from './windowBounds';

const MAIN_WINDOW_SIZE = { width: 1200, height: 800, minWidth: 800, minHeight: 600 };

/**
 * Brings the main window back where the user can see it. Every path that shows
 * the main window goes through here: a window macOS left at 0×0 or off every
 * display is moved back to the primary display first.
 *
 * `inactive` (the idle kickoff) raises it without taking keyboard focus.
 */
export function revealWindow(win: BrowserWindow, { inactive = false }: { inactive?: boolean } = {}): void {
  if (win.isMinimized()) win.restore();
  try {
    const primary = screen.getPrimaryDisplay();
    const others = screen.getAllDisplays().filter((d) => d.id !== primary.id);
    const fix = recoverBounds(
      win.getBounds(),
      [primary, ...others].map((d) => d.workArea),
      MAIN_WINDOW_SIZE,
    );
    if (fix) {
      console.log('[Window] Main window was unreachable, moving it back:', win.getBounds(), '->', fix);
      win.setBounds(fix);
    }
  } catch (error) {
    console.error('[Window] Bounds check failed:', error);
  }
  if (inactive) {
    win.showInactive();
    win.moveTop();
  } else {
    win.show();
    win.focus();
  }
}
