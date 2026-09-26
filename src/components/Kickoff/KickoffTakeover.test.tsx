import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KickoffTakeover from './KickoffTakeover';
import { resetTimer, setTimer } from '../../test/timerState';
import { useTimerStore } from '../../stores/timerStore';

vi.mock('../../hooks/useTaskName', () => ({
  useTaskName: (id: string | null) => (id === '689742' ? 'Automatizovať dokumentáciu' : null),
}));

type Snapshot = Parameters<typeof setTimer>[0];

const warmup: Snapshot = {
  status: 'focus',
  kickoff: 'warmup',
  kickoffSource: 'auto',
  kickoffEscalateMinutes: 15,
  raycastFocus: true,
  isPaused: false,
  remainingSeconds: 97,
  totalDuration: 120,
  currentTaskId: '689742',
  intention: '',
  durationMinutes: 25,
  sessionStartTime: new Date(Date.now() - 23_000),
  intervalId: 1,
};

function draw(overrides: Snapshot = {}) {
  setTimer({ ...warmup, ...overrides });
  render(<KickoffTakeover />);
}

const dialog = () => screen.queryByRole('dialog', { name: 'Kickoff' });
const key = (name: RegExp | string) => screen.getByRole('button', { name });

describe('KickoffTakeover — visibility', () => {
  afterEach(() => resetTimer());

  it('is hidden when idle, once the kickoff has rolled over, and during a break', () => {
    draw({ status: 'idle', kickoff: null });
    expect(dialog()).toBeNull();
    cleanup();
    resetTimer();
    draw({ kickoff: 'rolled' });
    expect(dialog()).toBeNull();
    cleanup();
    resetTimer();
    draw({ status: 'break', kickoff: null });
    expect(dialog()).toBeNull();
  });

  it('fills the window as a modal dialog with the Kickoff label during the warmup', () => {
    draw();
    const d = dialog()!;
    expect(d).toBeInTheDocument();
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(d).toHaveClass('fixed', 'inset-0', 'z-50');
    expect(screen.getByText('Kickoff', { selector: '.now-label' })).toBeInTheDocument();
  });
});

describe('KickoffTakeover — content', () => {
  afterEach(() => resetTimer());

  it('digits read 1:37 for 97 s, amber, colon blinking; progress is 19 %', () => {
    draw();
    const digits = screen.getByRole('timer', { name: 'Kickoff remaining' });
    expect(digits).toHaveTextContent('1:37');
    expect(digits.parentElement).toHaveClass('text-focus', 'now-digits');
    expect(digits.querySelector('.colon-blink')).not.toBeNull();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '19');
  });

  it('shows the id pill (never a #) and the task title', () => {
    draw();
    const pill = screen.getByTestId('kickoff-task-id');
    expect(pill).toHaveTextContent('689742');
    expect(pill.textContent).not.toContain('#');
    expect(pill).toHaveClass('font-mono', 'text-focus');
    expect(screen.getByText('Automatizovať dokumentáciu')).toBeInTheDocument();
  });

  it('without a task: No task attached, or the intention when set', () => {
    draw({ currentTaskId: null });
    expect(screen.getByText('No task attached')).toBeInTheDocument();
    expect(screen.queryByTestId('kickoff-task-id')).toBeNull();
    cleanup();
    resetTimer();
    draw({ currentTaskId: null, intention: 'Write the brief' });
    expect(screen.getByText('Write the brief')).toBeInTheDocument();
    expect(screen.queryByText('No task attached')).toBeNull();
  });

  it('copy names the focus length it rolls into', () => {
    draw({ durationMinutes: 25 });
    expect(screen.getByTestId('kickoff-copy')).toHaveTextContent('Just start. At 0:00 this rolls into a 25m focus session.');
    cleanup();
    resetTimer();
    draw({ durationMinutes: 50 });
    expect(screen.getByTestId('kickoff-copy')).toHaveTextContent('rolls into a 50m focus session.');
  });

  it('Raycast pill: on with the block list, off otherwise', () => {
    draw({ raycastFocus: true });
    expect(screen.getByTestId('kickoff-raycast')).toHaveTextContent('Raycast Focus on · social, streaming, gaming blocked');
    cleanup();
    resetTimer();
    draw({ raycastFocus: false });
    expect(screen.getByTestId('kickoff-raycast')).toHaveTextContent('Raycast Focus off');
  });

  it.each([
    ['auto', 15, 'Started automatically after 15m idle'],
    ['nudge', 15, 'Started from the nudge'],
    ['deeplink', 15, 'Started from Raycast'],
    ['now', null, 'Started from Now'],
  ] as const)('source %s → "%s"', (source, minutes, text) => {
    draw({ kickoffSource: source, kickoffEscalateMinutes: minutes });
    expect(screen.getByTestId('kickoff-source')).toHaveTextContent(text);
  });

  it('paused: digits dim, colon static, paused copy, Resume instead of Pause, no +5 min', () => {
    draw({ isPaused: true });
    const digits = screen.getByRole('timer', { name: 'Kickoff remaining' });
    expect(digits.parentElement).toHaveClass('text-txt-secondary');
    expect(digits.querySelector('.colon-blink')).toBeNull();
    expect(screen.getByTestId('kickoff-copy')).toHaveTextContent('Paused — resume or stop.');
    expect(key('Resume')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('button', { name: /\+5 min/ })).toBeNull();
  });
});

describe('KickoffTakeover — Stop (K2) and the esc hint (N3)', () => {
  beforeEach(() => {
    window.timerAPI.saveSession = vi.fn(async () => 'x');
  });
  afterEach(() => {
    resetTimer();
    vi.restoreAllMocks();
  });

  it('Stop has exactly Now\'s Cancel effects: reset, no row, note cleared, task selection cleared', async () => {
    draw({ intention: 'Write the brief' });
    const tokenBefore = useTimerStore.getState().selectionResetToken;
    await userEvent.setup().click(key(/^Stop/));
    expect(window.timerAPI.stopMainTimer).toHaveBeenCalled();
    expect(window.timerAPI.saveSession).not.toHaveBeenCalled();
    const s = useTimerStore.getState();
    expect(s.status).toBe('idle');
    expect(s.kickoff).toBeNull();
    expect(s.kickoffSource).toBeNull();
    expect(s.raycastFocus).toBe(false);
    expect(s.intention).toBe('');
    expect(s.selectionResetToken).toBe(tokenBefore + 1);
    expect(dialog()).toBeNull();
  });

  it('Escape does the same, and unmounts the takeover', async () => {
    draw({ intention: 'Write the brief' });
    const tokenBefore = useTimerStore.getState().selectionResetToken;
    fireEvent.keyDown(window, { key: 'Escape' });
    await vi.waitFor(() => expect(useTimerStore.getState().status).toBe('idle'));
    expect(window.timerAPI.stopMainTimer).toHaveBeenCalled();
    expect(window.timerAPI.saveSession).not.toHaveBeenCalled();
    expect(useTimerStore.getState().intention).toBe('');
    expect(useTimerStore.getState().selectionResetToken).toBe(tokenBefore + 1);
    expect(dialog()).toBeNull();
  });

  it('Escape inside an input does nothing', () => {
    draw();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(window.timerAPI.stopMainTimer).not.toHaveBeenCalled();
    expect(useTimerStore.getState().status).toBe('focus');
    input.remove();
  });

  it('the esc hint renders only while the window has focus', () => {
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    draw();
    expect(key(/^Stop/).querySelector('kbd')).toBeNull();
    fireEvent(window, new Event('focus'));
    expect(key(/^Stop/).querySelector('kbd')).toHaveTextContent('esc');
    fireEvent(window, new Event('blur'));
    expect(key(/^Stop/).querySelector('kbd')).toBeNull();
  });
});

describe('KickoffTakeover — secondary row (K3 override): the same handlers Now uses', () => {
  beforeEach(() => {
    window.timerAPI.saveSession = vi.fn(async () => 'x');
  });
  afterEach(() => resetTimer());

  it('the row is quiet (low contrast, ghost sm keys) and sits left of Stop', () => {
    draw();
    const row = screen.getByTestId('kickoff-secondary');
    expect(row).toHaveClass('opacity-60');
    for (const name of ['Pause', 'Finish', '+5 min']) {
      const k = screen.getByRole('button', { name });
      expect(row).toContainElement(k);
      expect(k).toHaveClass('h-7', 'font-mono');
    }
    expect(row.nextElementSibling).toBe(key(/^Stop/));
  });

  it('Pause → pauseMainTimer and the store pauses', async () => {
    draw();
    await userEvent.setup().click(key('Pause'));
    expect(window.timerAPI.pauseMainTimer).toHaveBeenCalled();
    expect(useTimerStore.getState().isPaused).toBe(true);
    expect(key('Resume')).toBeInTheDocument();
  });

  it('Resume → resumeMainTimer and the store resumes', async () => {
    draw({ isPaused: true });
    await userEvent.setup().click(key('Resume'));
    expect(window.timerAPI.resumeMainTimer).toHaveBeenCalled();
    expect(useTimerStore.getState().isPaused).toBe(false);
    expect(key('Pause')).toBeInTheDocument();
  });

  it('+5 min → extendMainTimer(300)', async () => {
    draw();
    await userEvent.setup().click(key('+5 min'));
    expect(window.timerAPI.extendMainTimer).toHaveBeenCalledWith(300);
  });

  it('Finish has exactly Now\'s Finish effects: finishEarly saves the Kickoff row, leaves the warmup, clears the task selection', async () => {
    draw({ sessionStartTime: new Date(Date.now() - 90_000) });
    const tokenBefore = useTimerStore.getState().selectionResetToken;
    await userEvent.setup().click(key('Finish'));
    await vi.waitFor(() => expect(useTimerStore.getState().status).toBe('idle'));
    expect(window.timerAPI.stopMainTimer).toHaveBeenCalled();
    expect(window.timerAPI.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'Kickoff', task_id: '689742', duration_minutes: 2 })
    );
    expect(useTimerStore.getState().selectionResetToken).toBe(tokenBefore + 1);
    expect(dialog()).toBeNull();
  });
});
