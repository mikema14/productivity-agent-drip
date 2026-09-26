import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IdleNudgePayload } from '../types';
import { IdleNudgeCard } from './IdleNudgeCard';

const now = new Date(2026, 8, 23, 10, 0).getTime();

const base: IdleNudgePayload = {
  kind: 'idle',
  idleSince: new Date(now - 12 * 60_000).toISOString(),
  kickoffAt: new Date(now + 872_000).toISOString(),
  kickoffSeconds: 120,
  snoozeSeconds: 900,
  escalateMinutes: 15,
  taskId: '689742',
  taskTitle: 'Automatizovať dokumentáciu',
  raycastFocus: true,
};

function draw(overrides: Partial<IdleNudgePayload> = {}, opts: { now?: number; focused?: boolean } = {}) {
  const act = vi.fn();
  const view = render(
    <IdleNudgeCard
      payload={{ ...base, ...overrides }}
      now={opts.now ?? now}
      windowFocused={opts.focused ?? false}
      shapeRef={createRef<HTMLDivElement>()}
      act={act}
    />
  );
  return { act, view };
}

describe('IdleNudgeCard', () => {
  it('shows the Idle label, the takeover countdown and the Nothing running title', () => {
    draw();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByTestId('nudge-takeover')).toHaveTextContent('14:32');
    expect(screen.getByTestId('nudge-title')).toHaveTextContent('Nothing running · 12m');
    expect(screen.getByRole('alertdialog', { name: 'Nothing running' })).toBeInTheDocument();
  });

  it('the countdown follows the clock and floors at 0:00', () => {
    const { view } = draw({}, { now: now + 1000 });
    expect(screen.getByTestId('nudge-takeover')).toHaveTextContent('14:31');
    view.rerender(
      <IdleNudgeCard payload={base} now={now + 900_000} windowFocused={false} shapeRef={createRef<HTMLDivElement>()} act={vi.fn()} />
    );
    expect(screen.getByTestId('nudge-takeover')).toHaveTextContent('0:00');
  });

  it('Raycast + task: the mockup sentence, the id in its own amber mono span with the title as tooltip, never a #', () => {
    draw();
    const copy = screen.getByTestId('nudge-copy');
    expect(copy).toHaveTextContent('Then Raycast Focus turns on and a 2-minute kickoff starts on 689742.');
    expect(copy.textContent).not.toContain('#');
    const id = screen.getByText('689742');
    expect(id.tagName).toBe('SPAN');
    expect(id).toHaveAttribute('title', 'Automatizovať dokumentáciu');
    expect(id.style.color).toBe('rgb(245, 158, 11)');
  });

  it('Raycast off: Then a 2-minute kickoff starts on 689742.', () => {
    draw({ raycastFocus: false });
    expect(screen.getByTestId('nudge-copy')).toHaveTextContent('Then a 2-minute kickoff starts on 689742.');
  });

  it('no task: … starts on your last task.', () => {
    draw({ taskId: null, taskTitle: null });
    expect(screen.getByTestId('nudge-copy')).toHaveTextContent(
      'Then Raycast Focus turns on and a 2-minute kickoff starts on your last task.'
    );
  });

  it('neither: Then a 2-minute kickoff starts.', () => {
    draw({ taskId: null, taskTitle: null, raycastFocus: false });
    expect(screen.getByTestId('nudge-copy')).toHaveTextContent(/^Then a 2-minute kickoff starts\.$/);
  });

  it('DRIP_IDLE_FAST lengths: 20-second kickoff, Kickoff 20s, Snooze 30s', () => {
    draw({ kickoffSeconds: 20, snoozeSeconds: 30, raycastFocus: false });
    expect(screen.getByTestId('nudge-copy')).toHaveTextContent('Then a 20-second kickoff starts on 689742.');
    expect(screen.getByRole('button', { name: /Kickoff\s*20s/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Snooze\s*30s/ })).toBeInTheDocument();
  });

  it('the ↵ hint is printed only while the window has focus (N3)', () => {
    const { view } = draw({}, { focused: false });
    expect(screen.queryByText('↵')).toBeNull();
    view.unmount();
    draw({}, { focused: true });
    expect(screen.getByText('↵')).toBeInTheDocument();
    expect(screen.getByText('↵').tagName).toBe('KBD');
  });

  it.each([
    [/Start focus/, 'idle-start-focus'],
    [/Kickoff\s*2m/, 'idle-kickoff'],
    [/Snooze\s*15m/, 'idle-snooze'],
    ['Dismiss', 'dismiss'],
  ])('%s relays %s', (name, action) => {
    const { act } = draw();
    fireEvent.click(screen.getByRole('button', { name }));
    expect(act).toHaveBeenCalledWith(action);
    expect(act).toHaveBeenCalledTimes(1);
  });

  it('carries the red hairline and halo on the glass shell', () => {
    draw();
    const card = screen.getByTestId('idle-nudge');
    expect(card.style.border).toContain('rgba(239, 68, 68, 0.45)');
    expect(card.style.boxShadow).toContain('rgba(239, 68, 68, 0.16)');
    expect(card.style.borderRadius).toBe('24px');
    expect(card.style.width).toBe('440px');
  });

  it('Start focus is the solid amber key; Snooze sits after the spacer as a ghost key', () => {
    draw();
    const start = screen.getByRole('button', { name: /Start focus/ });
    expect(start.style.background).toBe('rgb(245, 158, 11)');
    const snooze = screen.getByRole('button', { name: /Snooze/ });
    expect(snooze.style.background).toBe('transparent');
    expect(snooze.previousElementSibling).toHaveStyle({ flexGrow: 1 });
  });
});
