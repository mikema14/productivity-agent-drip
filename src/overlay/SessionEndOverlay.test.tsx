import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverlayAPI, SessionOverlayPayload } from '../types';
import { SessionEndOverlay } from './SessionEndOverlay';

let push: (payload: SessionOverlayPayload) => void;
let overlayAPI: OverlayAPI;

beforeEach(() => {
  overlayAPI = {
    onState: vi.fn((cb) => {
      push = cb;
    }),
    onTick: vi.fn(),
    action: vi.fn(),
    saveNote: vi.fn(async () => undefined),
    setInteractive: vi.fn(),
    setEscalated: vi.fn(),
  };
  window.overlayAPI = overlayAPI;
});

function show(payload: SessionOverlayPayload) {
  render(<SessionEndOverlay />);
  act(() => push(payload));
}

describe('SessionEndOverlay — idle nudge', () => {
  const idle: SessionOverlayPayload = {
    kind: 'idle',
    idleSince: new Date(Date.now() - 12 * 60_000).toISOString(),
    kickoffAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    kickoffSeconds: 120,
    snoozeSeconds: 900,
  };

  it('renders the red nudge with its idle time and three actions', () => {
    show(idle);
    expect(screen.getByText('Nothing running')).toBeInTheDocument();
    expect(screen.getByText('· 12m')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start focus/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kickoff\s*2m/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Snooze\s*15m/ })).toBeInTheDocument();
  });

  it.each([
    [/Start focus/, 'idle-start-focus'],
    [/Kickoff/, 'idle-kickoff'],
    [/Snooze/, 'idle-snooze'],
    [/Dismiss/, 'dismiss'],
  ])('%s sends %s', (name, action) => {
    show(idle);
    fireEvent.click(screen.getByRole('button', { name }));
    expect(overlayAPI.action).toHaveBeenCalledWith(action);
  });

  it('does not run the amber escalation (main owns the idle clock)', () => {
    vi.useFakeTimers();
    try {
      show(idle);
      act(() => {
        vi.advanceTimersByTime(120_000);
      });
      expect(overlayAPI.setEscalated).not.toHaveBeenCalledWith(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SessionEndOverlay — kickoff prompt', () => {
  it('renders Keep going / Stop and relays them', () => {
    show({ kind: 'kickoff-continue', focusMinutes: 25, countdownSeconds: 10 });
    expect(screen.getByText('Kickoff done')).toBeInTheDocument();
    expect(screen.getByText('0:10')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(overlayAPI.action).toHaveBeenCalledWith('kickoff-keep');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(overlayAPI.action).toHaveBeenCalledWith('kickoff-stop');
  });
});
