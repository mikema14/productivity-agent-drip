import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getApplicationNameForProtocol: () => 'Raycast' },
}));

const spawn = vi.fn(() => ({ on: vi.fn(), unref: vi.fn() }));
// pgrep: throwing = Raycast is not running, which takes the cold-launch path
// (start sent alone, no 300 ms delay).
const execFileSync = vi.fn(() => {
  throw new Error('no match');
});
vi.mock('child_process', () => ({ spawn, execFileSync }));

vi.mock('../src/services/db', () => ({
  getSetting: vi.fn((key: string) => (key === 'raycastFocusEnabled' ? settings.raycastFocusEnabled : null)),
  getCachedTask: vi.fn(() => ({ title: 'Automatizovať dokumentáciu' })),
}));

const settings: { raycastFocusEnabled: string | null } = { raycastFocusEnabled: null };

async function load() {
  vi.resetModules();
  return import('./raycastFocus');
}

describe('raycastFocus', () => {
  const env = { ...process.env };
  beforeEach(() => {
    delete process.env.DRIP_TEST_MODE;
    settings.raycastFocusEnabled = null;
    spawn.mockClear();
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('start opens raycast://focus/start in the background with mode=block and the shared categories', async () => {
    const { raycastFocusStart, isRaycastFocusEnabled } = await load();
    expect(isRaycastFocusEnabled()).toBe(true);
    raycastFocusStart(1620, '689742');
    expect(spawn).toHaveBeenCalledTimes(1);
    const [bin, args] = spawn.mock.calls[0] as unknown as [string, string[]];
    expect(bin).toBe('/usr/bin/open');
    expect(args[0]).toBe('-g');
    expect(args[1]).toBe(
      'raycast://focus/start?goal=Automatizova%C5%A5%20dokument%C3%A1ciu&duration=1620&mode=block&categories=social,streaming,gaming'
    );
  });

  it('is disabled under DRIP_TEST_MODE=1: nothing is spawned', async () => {
    process.env.DRIP_TEST_MODE = '1';
    const { raycastFocusStart, isRaycastFocusEnabled } = await load();
    expect(isRaycastFocusEnabled()).toBe(false);
    raycastFocusStart(1500, '689742');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('is disabled when the setting is false', async () => {
    settings.raycastFocusEnabled = 'false';
    const { raycastFocusStart, isRaycastFocusEnabled } = await load();
    expect(isRaycastFocusEnabled()).toBe(false);
    raycastFocusStart(1500);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('end is a no-op when nothing was started, and completes the session after a start', async () => {
    const { raycastFocusStart, raycastFocusEnd } = await load();
    raycastFocusEnd();
    expect(spawn).not.toHaveBeenCalled();
    raycastFocusStart(1500);
    raycastFocusEnd();
    expect(spawn).toHaveBeenCalledTimes(2);
    const [, args] = spawn.mock.calls[1] as unknown as [string, string[]];
    expect(args[1]).toBe('raycast://focus/complete');
  });
});
