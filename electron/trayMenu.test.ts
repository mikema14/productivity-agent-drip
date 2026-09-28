import { describe, expect, it, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { buildTrayMenuTemplate, trayToolTip, type TrayMenuActions } from './trayMenu';

const WED_10 = new Date(2026, 8, 23, 10, 0).getTime();

function actions(): TrayMenuActions {
  return { showApp: vi.fn(), quit: vi.fn(), pauseNudges: vi.fn(), resumeNudges: vi.fn() };
}

function labels(items: MenuItemConstructorOptions[]): string[] {
  return items.map((i) => (i.type === 'separator' ? '—' : String(i.label)));
}

function find(items: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions {
  const item = items.find((i) => i.label === label);
  if (!item) throw new Error(`no menu item ${label}`);
  return item;
}

describe('buildTrayMenuTemplate', () => {
  it('not paused: Show App, a Pause nudges submenu with 15 minutes / 1 hour / Rest of day, Quit', () => {
    const a = actions();
    const menu = buildTrayMenuTemplate(null, WED_10, a);
    expect(labels(menu)).toEqual(['Show App', '—', 'Pause nudges', '—', 'Quit']);
    const sub = find(menu, 'Pause nudges').submenu as MenuItemConstructorOptions[];
    expect(labels(sub)).toEqual(['15 minutes', '1 hour', 'Rest of day']);
    expect(labels(menu)).not.toContain('Resume nudges');
  });

  it.each([
    ['15 minutes', '15m'],
    ['1 hour', '1h'],
    ['Rest of day', 'day'],
  ])('%s → pauseNudges(%s)', (label, choice) => {
    const a = actions();
    const sub = find(buildTrayMenuTemplate(null, WED_10, a), 'Pause nudges').submenu as MenuItemConstructorOptions[];
    (find(sub, label).click as () => void)();
    expect(a.pauseNudges).toHaveBeenCalledWith(choice);
    expect(a.pauseNudges).toHaveBeenCalledTimes(1);
  });

  it('paused: a disabled "Nudges paused until HH:MM" line and Resume nudges instead of the submenu', () => {
    const a = actions();
    const until = new Date(2026, 8, 23, 14, 30).getTime();
    const menu = buildTrayMenuTemplate(until, WED_10, a);
    expect(labels(menu)).toEqual(['Show App', '—', 'Nudges paused until 14:30', 'Resume nudges', '—', 'Quit']);
    expect(find(menu, 'Nudges paused until 14:30').enabled).toBe(false);
    (find(menu, 'Resume nudges').click as () => void)();
    expect(a.resumeNudges).toHaveBeenCalledTimes(1);
  });

  it('paused into the next day reads "until tomorrow"', () => {
    const menu = buildTrayMenuTemplate(new Date(2026, 8, 24, 0, 0).getTime(), WED_10, actions());
    expect(labels(menu)).toContain('Nudges paused until tomorrow');
  });

  it('Show App and Quit call through', () => {
    const a = actions();
    const menu = buildTrayMenuTemplate(null, WED_10, a);
    (find(menu, 'Show App').click as () => void)();
    (find(menu, 'Quit').click as () => void)();
    expect(a.showApp).toHaveBeenCalledTimes(1);
    expect(a.quit).toHaveBeenCalledTimes(1);
  });
});

describe('trayToolTip', () => {
  it('is Drip, or names the pause', () => {
    expect(trayToolTip(null, WED_10)).toBe('Drip');
    expect(trayToolTip(new Date(2026, 8, 23, 14, 30).getTime(), WED_10)).toBe('Drip — nudges paused until 14:30');
  });
});
