import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Rail from './Rail';
import type { ViewId } from './views';

function renderRail(view: ViewId = 'timer') {
  const onNavigate = vi.fn();
  const { unmount } = render(<Rail view={view} onNavigate={onNavigate} />);
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  return { onNavigate, nav, unmount, buttons: within(nav).getAllByRole('button') };
}

describe('Rail', () => {
  it('renders Now, Plan, Review, Insights, Settings in order with aria-current on the active one only', () => {
    const { buttons } = renderRail('timer');
    expect(buttons.map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Now', 'Plan', 'Review', 'Insights', 'Settings']);
    expect(buttons[0]).toHaveAttribute('aria-current', 'page');
    buttons.slice(1).forEach(b => expect(b).not.toHaveAttribute('aria-current'));
  });

  it('shows the LED only inside the active item', () => {
    const { buttons } = renderRail('daily-log');
    const leds = screen.getAllByTestId('rail-led');
    expect(leds).toHaveLength(1);
    expect(buttons[2]).toContainElement(leds[0]);
  });

  it('clicking each item navigates to its target view', async () => {
    const user = userEvent.setup();
    const { onNavigate, buttons } = renderRail();
    for (const b of buttons) await user.click(b);
    expect(onNavigate.mock.calls.map(c => c[0])).toEqual(['timer', 'all-lists', 'daily-log', 'progress', 'settings']);
  });

  it('Plan is active for both lists views', () => {
    for (const view of ['lists', 'all-lists'] as const) {
      const { buttons, unmount } = renderRail(view);
      expect(buttons[1]).toHaveAttribute('aria-current', 'page');
      expect(buttons[0]).not.toHaveAttribute('aria-current');
      unmount();
    }
  });

  it('is a window drag region with no-drag buttons', () => {
    const { nav, buttons } = renderRail();
    const appRegion = (el: HTMLElement) => (el.style as unknown as Record<string, string>).WebkitAppRegion;
    expect(appRegion(nav)).toBe('drag');
    buttons.forEach(b => expect(appRegion(b)).toBe('no-drag'));
  });
});
