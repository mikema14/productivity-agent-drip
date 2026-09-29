import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CloseDayAside, { type CloseDayAsideProps } from './CloseDayAside';
import type { CalendarProposal, ListItem, TaskList } from '../../types';

vi.mock('./TodaysThree', () => ({ default: () => <section aria-label="Today">TodayStub</section> }));

const lists: TaskList[] = [
  { id: 'l1', name: 'Sales', color: '#f59e0b', icon_path: null, task_id: null, order: 0, archived: 0, billable: 1, created_at: '' },
  { id: 'bound', name: 'Docs', color: '#f59e0b', icon_path: null, task_id: '999', order: 1, archived: 0, billable: 1, created_at: '' },
];

function item(overrides: Partial<ListItem> = {}): ListItem {
  return {
    id: 'i1', list_id: 'l1', title: 'Write proposal', task_id: '689742', column: 'today', order: 0, completed: 0, archived: 0,
    completed_at: null, description: null, subtasks: '[]', billable: 1, created_at: '', ...overrides,
  };
}

function proposal(overrides: Partial<CalendarProposal> = {}): CalendarProposal {
  return {
    id: 'p1', event_uid: 'u', title: 'Standup', start_at: '', end_at: '', duration_minutes: 30, date: '2026-09-28',
    accepted: 0, dismissed: 0, task_id: null, comment: null, logged: 0, billable: 1, ...overrides,
  };
}

function renderAside(overrides: Partial<CloseDayAsideProps> = {}) {
  const props: CloseDayAsideProps = {
    date: '2026-09-25', isToday: true, todayItems: [], lists, proposals: [], reflection: '', onReflectionChange: vi.fn(),
    locked: false, savedReflection: null, onEndDay: vi.fn(), ...overrides,
  };
  render(<CloseDayAside {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('CloseDayAside', () => {
  it('is labelled Close the day · Optional and names tomorrow (Fri → Mon 28 Sep)', () => {
    renderAside();
    const aside = screen.getByRole('complementary', { name: 'Close the day' });
    expect(aside).toHaveTextContent(/Close the day\s*Optional/);
    expect(screen.getByTestId('tomorrow-date')).toHaveTextContent('Mon 28 Sep');
  });

  it('renders Today only on today\'s review', () => {
    renderAside();
    expect(screen.getByRole('region', { name: 'Today' })).toBeInTheDocument();
  });

  it('one tomorrow line: starts with the first open item\'s effective id, meetings and free time; no #, no caps', () => {
    renderAside({
      todayItems: [item({ id: 'done', completed: 1, order: 0 }), item({ id: 'b', list_id: 'bound', task_id: '1', order: 1 }), item({ id: 'c', order: 2, task_id: '5' })],
      proposals: [proposal(), proposal({ id: 'p2', duration_minutes: 60 }), proposal({ id: 'p3', dismissed: 1, duration_minutes: 120 })],
    });
    const line = screen.getByTestId('tomorrow-line');
    expect(line).toHaveTextContent('Starts with 999 · 2 meetings · 4h 30m free');
    expect(line.textContent).not.toMatch(/#|slot/);
  });

  it('an open item without a task id starts tomorrow by its title; nothing open reads Starts empty', () => {
    renderAside({ todayItems: [item({ task_id: null })] });
    expect(screen.getByTestId('tomorrow-start')).toHaveTextContent('Starts with Write proposal');
  });

  it('Starts empty when every today item is done; a free day reads 6h free', () => {
    renderAside({ todayItems: [item({ completed: 1 })], proposals: [] });
    expect(screen.getByTestId('tomorrow-line')).toHaveTextContent('Starts empty · 0 meetings · 6h free');
    expect(screen.getByTestId('tomorrow-line').textContent).not.toContain('00m');
  });

  it('on a past date there is no Today triage and no Starts with; calendar, reflection and End day stay', () => {
    renderAside({ isToday: false, date: '2026-09-23', todayItems: [item()] });
    expect(screen.queryByRole('region', { name: 'Today' })).toBeNull();
    expect(screen.queryByTestId('tomorrow-start')).toBeNull();
    expect(screen.getByTestId('tomorrow-date')).toHaveTextContent('Thu 24 Sep');
    expect(screen.getByTestId('tomorrow-calendar')).toBeInTheDocument();
    expect(screen.getByLabelText('One line on today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End day' })).toBeInTheDocument();
  });

  it('shows Calendar unavailable when proposals could not be loaded', () => {
    renderAside({ proposals: null });
    expect(screen.getByTestId('tomorrow-calendar')).toHaveTextContent('Calendar unavailable');
  });

  it('a 2-row textarea goes to onReflectionChange; End day is the secondary outline key', async () => {
    const { user, onReflectionChange, onEndDay } = renderAside();
    const area = screen.getByLabelText('One line on today');
    expect(area).toHaveAttribute('rows', '2');
    await user.type(area, 'x');
    expect(onReflectionChange).toHaveBeenCalledWith('x');
    const endDay = screen.getByRole('button', { name: 'End day' });
    expect(endDay).toHaveAttribute('data-variant', 'outline');
    await user.click(endDay);
    expect(onEndDay).toHaveBeenCalledTimes(1);
  });

  it('locked: Day ended, saved reflection read-only, no button, no textarea', () => {
    renderAside({ locked: true, savedReflection: 'Shipped the thing' });
    expect(screen.getByText('Day ended')).toBeInTheDocument();
    expect(screen.getByTestId('saved-reflection')).toHaveTextContent('Shipped the thing');
    expect(screen.queryByRole('button', { name: 'End day' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
