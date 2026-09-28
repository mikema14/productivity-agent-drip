import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NowHeader from './NowHeader';

const wed10 = new Date(2026, 8, 23, 10, 0);

describe('NowHeader — nudges paused line', () => {
  it('is absent while nudges are not paused', () => {
    render(<NowHeader state="ready" date={wed10} />);
    expect(screen.queryByTestId('now-nudge-paused')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    expect(screen.getByTestId('now-pill')).toHaveTextContent('Ready');
  });

  it('shows "Nudges paused until 14:30 · Resume" next to the date while paused', () => {
    render(<NowHeader state="ready" date={wed10} nudgePausedUntil={new Date(2026, 8, 23, 14, 30).getTime()} />);
    const line = screen.getByTestId('now-nudge-paused');
    expect(line).toHaveTextContent('Nudges paused until 14:30 · Resume');
    expect(screen.getByText(/23 Sep/).nextElementSibling).toBe(line);
  });

  it('reads "until tomorrow" when the pause ends on a later day', () => {
    render(<NowHeader state="ready" date={wed10} nudgePausedUntil={new Date(2026, 8, 24, 0, 0).getTime()} />);
    expect(screen.getByTestId('now-nudge-paused')).toHaveTextContent('Nudges paused until tomorrow · Resume');
  });

  it('Resume calls onResumeNudges and is clickable inside the drag region', () => {
    const onResume = vi.fn();
    render(
      <NowHeader state="ready" date={wed10} nudgePausedUntil={new Date(2026, 8, 23, 14, 30).getTime()} onResumeNudges={onResume} />
    );
    const resume = screen.getByRole('button', { name: 'Resume' });
    expect((resume.style as CSSStyleDeclaration & { WebkitAppRegion?: string }).WebkitAppRegion ?? resume.getAttribute('style')).toMatch(/no-drag/);
    fireEvent.click(resume);
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
