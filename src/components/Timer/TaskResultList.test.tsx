import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import TaskResultList from './TaskResultList';
import { makeTask } from '../../test/fixtures';
import type { PickerTask } from '../../hooks/useTaskPickerNav';

function renderList(tasks: PickerTask[], currentTaskId?: string) {
  render(
    <TaskResultList
      id="list"
      tasks={tasks}
      query=""
      isSearching={false}
      highlighted={-1}
      scrollTick={0}
      onHover={vi.fn()}
      onSelect={vi.fn()}
      currentTaskId={currentTaskId}
    />
  );
  return screen.getAllByRole('option');
}

describe('TaskResultList', () => {
  it('renders the full project name, untruncated, on its own line', () => {
    const longName = '01 Client Solutions — Next level implementation programme';
    const [row] = renderList([makeTask(1, { project_name: longName, title: 'A very long task title' })]);

    const project = within(row).getByText(longName);
    expect(project).not.toHaveClass('truncate');
    expect(project).not.toHaveClass('font-mono');
    expect(project).toHaveClass('col-start-2');

    const title = within(row).getByText('A very long task title');
    expect(title).toHaveClass('truncate');
    expect(title).toHaveAttribute('title', 'A very long task title');
  });

  it("shows today's tracked time when there is some, otherwise the relative age", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000 - 60_000).toISOString();
    const [tracked, idle] = renderList([
      makeTask(1, { todayMinutes: 75 }),
      makeTask(2, { todayMinutes: 0, last_seen_at: twoDaysAgo }),
    ]);

    const time = within(tracked).getByTitle('Tracked today');
    expect(time).toHaveTextContent('1h 15m');
    expect(time).toHaveClass('font-mono');

    const age = within(idle).getByTitle('Last used');
    expect(age).toHaveTextContent('2d');
    expect(age).toHaveClass('text-txt-muted');
    expect(within(idle).queryByTitle('Tracked today')).toBeNull();
  });

  it('marks the current task', () => {
    const rows = renderList([makeTask(1), makeTask(2)], makeTask(2).task_id);
    expect(rows[0]).not.toHaveAttribute('aria-current');
    expect(rows[1]).toHaveAttribute('aria-current', 'true');
  });
});
