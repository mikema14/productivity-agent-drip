import type { MenuItemConstructorOptions } from 'electron';
import type { SnoozeChoice } from '../src/types';
import { formatPausedUntil } from '../src/utils/nudgePause';

/**
 * The menu-bar icon's context menu, as a template so it can be unit-tested
 * without Electron. tray.ts turns it into a Menu and rebuilds it whenever the
 * nudge pause changes.
 */
export interface TrayMenuActions {
  showApp: () => void;
  quit: () => void;
  pauseNudges: (choice: SnoozeChoice) => void;
  resumeNudges: () => void;
}

export const PAUSE_CHOICES: ReadonlyArray<{ choice: SnoozeChoice; label: string }> = [
  { choice: '15m', label: '15 minutes' },
  { choice: '1h', label: '1 hour' },
  { choice: 'day', label: 'Rest of day' },
];

export function buildTrayMenuTemplate(
  pausedUntil: number | null,
  now: number,
  actions: TrayMenuActions
): MenuItemConstructorOptions[] {
  const nudges: MenuItemConstructorOptions[] =
    pausedUntil !== null
      ? [
          { label: `Nudges paused ${formatPausedUntil(pausedUntil, now)}`, enabled: false },
          { label: 'Resume nudges', click: () => actions.resumeNudges() },
        ]
      : [
          {
            label: 'Pause nudges',
            submenu: PAUSE_CHOICES.map(({ choice, label }) => ({ label, click: () => actions.pauseNudges(choice) })),
          },
        ];

  return [
    { label: 'Show App', click: () => actions.showApp() },
    { type: 'separator' },
    ...nudges,
    { type: 'separator' },
    { label: 'Quit', click: () => actions.quit() },
  ];
}

/** Tooltip for the icon: the pause is the only state worth a word there. */
export function trayToolTip(pausedUntil: number | null, now: number): string {
  return pausedUntil === null ? 'Drip' : `Drip — nudges paused ${formatPausedUntil(pausedUntil, now)}`;
}
