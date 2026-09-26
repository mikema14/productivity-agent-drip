import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TomorrowAside, { type TomorrowAsideProps } from './TomorrowAside';
import type { CalendarProposal, ListItem, TaskList } from '../../types';

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

function renderAside(overrides: Partial<TomorrowAsideProps> = {}) {
  const props: TomorrowAsideProps = {
    date: '2026-09-25', isToday: true, todayItems: [], lists, proposals: [], reflection: '', onReflectionChange: vi.fn(),
    locked: false, savedReflection: null, onEndDay: vi.fn(), ...overrides,
  };
  render(<TomorrowAside {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('TomorrowAside', () => {
  it('labels Friday as Tomorrow · Mon 28 Sep', () => {
    renderAside();
    expect(screen.getByRole('complementary', { name: 'Tomorrow' })).toBeInTheDocument();
    expect(screen.getByTestId('tomorrow-date')).toHaveTextContent('Mon 28 Sep');
  });

  it('lists open today items with effective ids (list-bound id wins), skipping done ones; no #', () => {
    renderAside({ todayItems: [item(), item({ id: 'i2', list_id: 'bound', task_id: '1', title: 'Docs sweep' }), item({ id: 'done', completed: 1, title: 'Shipped' })] });
    const rows = screen.getAllByTestId('carry-item');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('689742');
    expect(rows[0]).toHaveTextContent('Write proposal');
    expect(rows[1]).toHaveTextContent('999');
    expect(screen.queryByText('Shipped')).toBeNull();
    expect(screen.getByRole('complementary').textContent).not.toContain('#');
  });

  it('shows Nothing carried over when every today item is done', () => {
    renderAside({ todayItems: [item({ completed: 1 })] });
    expect(screen.getByText('Nothing carried over')).toBeInTheDocument();
  });

  it('on a past date the carry-over list is not rendered; calendar, reflection and End day stay', () => {
    renderAside({ isToday: false, date: '2026-09-23', todayItems: [item()] });
    expect(screen.queryByTestId('carry-list')).toBeNull();
    expect(screen.queryByTestId('carry-item')).toBeNull();
    expect(screen.queryByText('Starts in Today')).toBeNull();
    expect(screen.queryByText('Nothing carried over')).toBeNull();
    expect(screen.getByTestId('tomorrow-date')).toHaveTextContent('Thu 24 Sep');
    expect(screen.getByTestId('tomorrow-calendar')).toBeInTheDocument();
    expect(screen.getByLabelText('One line on today')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End day' })).toBeInTheDocument();
  });

  it('calendar line counts non-dismissed meetings and free time of 6h', () => {
    renderAside({ proposals: [proposal(), proposal({ id: 'p2', duration_minutes: 60 }), proposal({ id: 'p3', dismissed: 1, duration_minutes: 120 })] });
    const line = screen.getByTestId('tomorrow-calendar');
    expect(line).toHaveTextContent('2 meetings · 1h 30m');
    expect(line).toHaveTextContent('4h 30m free of 6h');
    expect(line.textContent).not.toContain('00m');
  });

  it('a free day reads `6h free of 6h`, never `6h 00m`', () => {
    renderAside({ proposals: [] });
    expect(screen.getByTestId('tomorrow-calendar')).toHaveTextContent('0 meetings · 0m');
    expect(screen.getByTestId('tomorrow-calendar').textContent).toContain('6h free of 6h');
    expect(screen.getByTestId('tomorrow-calendar').textContent).not.toContain('00m');
  });

  it('shows Calendar unavailable when proposals could not be loaded', () => {
    renderAside({ proposals: null });
    expect(screen.getByTestId('tomorrow-calendar')).toHaveTextContent('Calendar unavailable');
  });

  it('textarea edits go to onReflectionChange and End day fires onEndDay', async () => {
    const { user, onReflectionChange, onEndDay } = renderAside();
    await user.type(screen.getByLabelText('One line on today'), 'x');
    expect(onReflectionChange).toHaveBeenCalledWith('x');
    await user.click(screen.getByRole('button', { name: 'End day' }));
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
