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
    escalateMinutes: 15,
    taskId: '689742',
    taskTitle: 'Automatizovať dokumentáciu',
    raycastFocus: true,
  };

  it('renders the red nudge with its idle time and three actions', () => {
    show(idle);
    expect(screen.getByTestId('idle-nudge')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByTestId('nudge-title')).toHaveTextContent('Nothing running · 12m');
    expect(screen.getByTestId('nudge-takeover')).toHaveTextContent(/^1[45]:\d\d$/);
    expect(screen.getByRole('button', { name: /Start focus/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kickoff\s*2m/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Snooze\s*15m/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('the takeover countdown ticks on the 1 s clock', () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      show({ ...idle, kickoffAt: new Date(now + 872_000).toISOString() });
      expect(screen.getByTestId('nudge-takeover')).toHaveTextContent('14:32');
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByTestId('nudge-takeover')).toHaveTextContent('14:31');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Enter on the window relays idle-start-focus for the nudge, not for the prompt', () => {
    show(idle);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(overlayAPI.action).toHaveBeenCalledWith('idle-start-focus');

    act(() => push({ kind: 'kickoff-continue', focusMinutes: 25, countdownSeconds: 10 }));
    vi.mocked(overlayAPI.action).mockClear();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(overlayAPI.action).not.toHaveBeenCalled();
  });

  it('fixture: renders from ?state=idle and never calls overlayAPI.action when the bridge is absent', () => {
    window.history.replaceState({}, '', '/?state=idle');
    (window as { overlayAPI?: OverlayAPI }).overlayAPI = undefined;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      render(<SessionEndOverlay />);
      expect(screen.getByTestId('idle-nudge')).toBeInTheDocument();
      expect(screen.getByTestId('nudge-copy')).toHaveTextContent(
        'Then Raycast Focus turns on and a 2-minute kickoff starts on 689742.'
      );
      fireEvent.click(screen.getByRole('button', { name: /Start focus/ }));
      expect(overlayAPI.action).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('[Overlay] fixture action: idle-start-focus');
    } finally {
      log.mockRestore();
      window.history.replaceState({}, '', '/');
    }
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

// ---------------------------------------------------------------------------
// Phase 4 step 1: the session-end, break-end and break-pill cards pinned as they
// are today, before the idle branch is extracted (PHASE4_PLAN.md §6.1).
// ---------------------------------------------------------------------------

vi.mock('./chime', () => ({ playEscalationChime: vi.fn() }));

const focusDone: SessionOverlayPayload = {
  kind: 'focus-complete',
  sessionId: 's1',
  taskId: '643749',
  taskTitle: 'Session-end overlay window',
  durationMinutes: 25,
  startedAt: new Date(2026, 8, 25, 9, 0).toISOString(),
  endedAt: new Date(2026, 8, 25, 9, 25).toISOString(),
  note: '',
  nextBreakMinutes: 5,
  isLongBreak: false,
};

describe('SessionEndOverlay — focus-complete card (pinned)', () => {
  it('renders the label, time range, id, focused note input and the three keys', () => {
    show(focusDone);
    expect(screen.getByText('Focus complete')).toBeInTheDocument();
    expect(screen.getByText('09:00 – 09:25')).toBeInTheDocument();
    expect(screen.getByText('643749')).toBeInTheDocument();
    expect(screen.getByText('Session-end overlay window')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('What did you get done?');
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: /Start break\s*5m/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next focus' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('typing in the note debounces saveNote(sessionId, value) by 400 ms', () => {
    vi.useFakeTimers();
    try {
      show(focusDone);
      fireEvent.change(screen.getByPlaceholderText('What did you get done?'), { target: { value: 'shipped it' } });
      act(() => {
        vi.advanceTimersByTime(399);
      });
      expect(overlayAPI.saveNote).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(overlayAPI.saveNote).toHaveBeenCalledWith('s1', 'shipped it');
    } finally {
      vi.useRealTimers();
    }
  });

  it('Enter in the note relays start-break; Escape relays dismiss', () => {
    show(focusDone);
    const input = screen.getByPlaceholderText('What did you get done?');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(overlayAPI.action).toHaveBeenCalledWith('start-break');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(overlayAPI.action).toHaveBeenCalledWith('dismiss');
  });

  it('Start break / Next focus / Dismiss relay their actions', () => {
    show(focusDone);
    fireEvent.click(screen.getByRole('button', { name: /Start break/ }));
    expect(overlayAPI.action).toHaveBeenCalledWith('start-break');
    fireEvent.click(screen.getByRole('button', { name: 'Next focus' }));
    expect(overlayAPI.action).toHaveBeenCalledWith('next-focus');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(overlayAPI.action).toHaveBeenCalledWith('dismiss');
  });

  it('escalates after 60 s (halo + setEscalated(true)) and hovering the card stops it', () => {
    vi.useFakeTimers();
    // The real overlay window is raised with showInactive(), so the note's
    // auto-focus does not fire a focus event (which would stop the escalation).
    // jsdom fires it regardless, so the auto-focus is neutralised here.
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
    try {
      show(focusDone);
      act(() => {
        vi.advanceTimersByTime(59_000);
      });
      expect(overlayAPI.setEscalated).not.toHaveBeenCalled();
      expect(document.querySelector('[style*="drip-halo"]')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(overlayAPI.setEscalated).toHaveBeenCalledWith(true);
      expect(document.querySelector('[style*="drip-halo"]')).not.toBeNull();

      // jsdom rects are all zero, so a move at (0,0) lands inside the card
      fireEvent.mouseMove(window, { clientX: 0, clientY: 0 });
      expect(overlayAPI.setEscalated).toHaveBeenLastCalledWith(false);
      expect(document.querySelector('[style*="drip-halo"]')).toBeNull();
    } finally {
      focusSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('focusing the note stops the escalation clock', () => {
    vi.useFakeTimers();
    try {
      show(focusDone); // jsdom auto-focuses the note, which is the "user is typing" case
      act(() => {
        vi.advanceTimersByTime(120_000);
      });
      expect(overlayAPI.setEscalated).not.toHaveBeenCalledWith(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SessionEndOverlay — break-complete card and break pill (pinned)', () => {
  it('break-complete renders Break over and Start focus 25m → next-focus', () => {
    show({ kind: 'break-complete', nextFocusMinutes: 25 });
    expect(screen.getByText('Break over')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start focus\s*25m/ }));
    expect(overlayAPI.action).toHaveBeenCalledWith('next-focus');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(overlayAPI.action).toHaveBeenCalledWith('dismiss');
  });

  it('break-running renders the pill with its countdown, and onTick updates the digits', () => {
    let tick: (seconds: number) => void = () => {};
    overlayAPI.onTick = vi.fn((cb) => {
      tick = cb;
    });
    show({ kind: 'break-running', totalSeconds: 300, remainingSeconds: 222, isLong: false });
    expect(screen.getByText('Break')).toBeInTheDocument();
    expect(screen.getByText('3:42')).toBeInTheDocument();
    act(() => tick(100));
    expect(screen.getByText('1:40')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a long break is labelled Long break', () => {
    show({ kind: 'break-running', totalSeconds: 600, remainingSeconds: 600, isLong: true });
    expect(screen.getByText('Long break')).toBeInTheDocument();
  });
});

describe('SessionEndOverlay — dev fixtures without the bridge', () => {
  it('?state=card renders from the URL and clicking Start break calls nothing when overlayAPI is absent', () => {
    window.history.replaceState({}, '', '/?state=card');
    (window as { overlayAPI?: OverlayAPI }).overlayAPI = undefined;
    try {
      render(<SessionEndOverlay />);
      expect(screen.getByText('Focus complete')).toBeInTheDocument();
      expect(() => fireEvent.click(screen.getByRole('button', { name: /Start break/ }))).not.toThrow();
      expect(overlayAPI.action).not.toHaveBeenCalled();
      expect(overlayAPI.saveNote).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });
});
