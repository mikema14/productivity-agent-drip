import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryRow, { type EntryRowProps } from './EntryRow';
import { makeEntry, asMerged } from '../../test/logFixtures';
import type { LogEntry } from '../../stores/logStore';
import type { MergedEntry } from '../../utils/mergeEntries';

function renderRow(entry: MergedEntry, overrides: Partial<EntryRowProps> = {}) {
  const props: EntryRowProps = {
    entry,
    onUpdate: vi.fn(), onDelete: vi.fn(), onToggleLog: vi.fn(), onAccept: vi.fn(),
    onMove: vi.fn(), onAssignTask: vi.fn(), onToggleBillable: vi.fn(), onOpenSettings: vi.fn(),
    ...overrides,
  };
  render(<EntryRow {...props} />);
  return { ...props, user: userEvent.setup(), row: screen.getByTestId('entry-row') };
}

const openRow = (o: Partial<LogEntry> = {}) => asMerged(makeEntry('pomodoro', o));

beforeEach(() => {
  window.logAPI.getCachedTask = vi.fn(async () => ({ task_id: '643749', title: 'Feature X', project_id: 1, project_name: 'P', last_seen_at: '' }));
  window.logAPI.getRecentTasks = vi.fn(async () => [
    { task_id: '555', title: 'Sales task', project_id: 1, project_name: 'P', last_seen_at: '' },
    { task_id: '689742', title: 'Doc automation', project_id: 1, project_name: 'P', last_seen_at: '' },
  ]);
});

describe('EntryRow — select', () => {
  it('open row: checkbox reflects markedToLog and toggling calls onToggleLog', async () => {
    const { user, onToggleLog, row } = renderRow(openRow({ markedToLog: false }));
    expect(row).toHaveAttribute('data-kind', 'open');
    const box = screen.getByRole('checkbox', { name: 'Log this entry' });
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(onToggleLog).toHaveBeenCalledWith('pomodoro-1');
  });

  it('a row without a task: amber tint, disabled checkbox, dashed + Assign task (R22)', () => {
    const { row } = renderRow(asMerged(makeEntry('adhoc', { taskId: null })));
    expect(row.className).toContain('bg-focus/[0.05]');
    const box = screen.getByRole('checkbox', { name: 'Log this entry (needs a task)' });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute('title', 'Needs a task');
    expect(screen.getByRole('button', { name: '+ Assign task' })).toHaveClass('border-dashed');
  });

  it('a proposal with a task: checking it accepts it (R30)', async () => {
    const { user, onAccept, onToggleLog, row } = renderRow(asMerged(makeEntry('proposal', { taskId: '643749' })));
    expect(row).toHaveAttribute('data-kind', 'proposal');
    const box = screen.getByRole('checkbox', { name: 'Accept and log this entry' });
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(onAccept).toHaveBeenCalledWith('proposal-1');
    expect(onToggleLog).not.toHaveBeenCalled();
  });

  it('logged row: green check, dimmed, read-only text, no inputs and no actions', () => {
    const { row } = renderRow(asMerged(makeEntry('logged', { billable: false })));
    expect(row).toHaveAttribute('data-kind', 'logged');
    expect(row).toHaveClass('opacity-70');
    expect(screen.getByRole('img', { name: 'Logged' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(row).toHaveTextContent('Proposal draft');
    expect(row).toHaveTextContent('No');
  });
});

describe('EntryRow — Dur', () => {
  it('click → type 1h10 → Enter commits 70 minutes', async () => {
    const { user, onUpdate } = renderRow(openRow({ durationMinutes: 25 }));
    await user.click(screen.getByRole('button', { name: 'Duration 25m' }));
    const input = screen.getByLabelText('Duration');
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, '1h10{Enter}');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('pomodoro-1', { durationMinutes: 70 });
    expect(screen.queryByLabelText('Duration')).toBeNull();
  });

  it('an unreadable value keeps the editor open marked invalid; Esc cancels without a write', async () => {
    const { user, onUpdate } = renderRow(openRow());
    await user.click(screen.getByRole('button', { name: 'Duration 25m' }));
    const input = screen.getByLabelText('Duration');
    await user.clear(input);
    await user.type(input, 'soon{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('border-alert');
    await user.keyboard('{Escape}');
    expect(screen.queryByLabelText('Duration')).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('blur commits a valid change, reverts an invalid one, and an unchanged value writes nothing', async () => {
    const { user, onUpdate } = renderRow(openRow());
    await user.click(screen.getByRole('button', { name: 'Duration 25m' }));
    await user.tab();
    expect(onUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Duration 25m' }));
    await user.clear(screen.getByLabelText('Duration'));
    await user.type(screen.getByLabelText('Duration'), 'x');
    await user.tab();
    expect(onUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Duration 25m' }));
    await user.clear(screen.getByLabelText('Duration'));
    await user.type(screen.getByLabelText('Duration'), '45m');
    await user.tab();
    expect(onUpdate).toHaveBeenCalledWith('pomodoro-1', { durationMinutes: 45 });
  });

  it('merged rows keep the duration read-only', () => {
    const a = makeEntry('pomodoro', { id: 'p1' });
    const b = makeEntry('pomodoro', { id: 'p2' });
    renderRow(asMerged({ ...a, durationMinutes: 50 }, [a, b]));
    expect(screen.queryByRole('button', { name: /Duration/ })).toBeNull();
    expect(screen.getByTitle('Ungroup to edit')).toHaveTextContent('50m');
  });
});

describe('EntryRow — Task', () => {
  it('shows the id without # and the task name under it', async () => {
    renderRow(openRow());
    const id = screen.getByTestId('entry-task-id');
    expect(id).toHaveTextContent('643749');
    expect(id.textContent).not.toContain('#');
    expect(await screen.findByText('Feature X')).toBeInTheDocument();
  });

  it('+ Assign task opens the picker; picking a recent task calls onAssignTask', async () => {
    const { user, onAssignTask } = renderRow(asMerged(makeEntry('adhoc', { taskId: null })));
    await user.click(screen.getByRole('button', { name: '+ Assign task' }));
    expect(screen.getByLabelText('Find a task')).toHaveFocus();
    const option = await screen.findByRole('option', { name: /555/ });
    await user.pointer({ keys: '[MouseLeft>]', target: option });
    expect(onAssignTask).toHaveBeenCalledWith('adhoc-1', '555');
    expect(screen.queryByTestId('task-picker')).toBeNull();
  });

  it('a numeric id + Enter resolves through the cache', async () => {
    window.logAPI.getCachedTask = vi.fn(async (id: string) => ({ task_id: id, title: 'Cached', project_id: 1, project_name: 'P', last_seen_at: '' }));
    const { user, onAssignTask } = renderRow(asMerged(makeEntry('proposal')));
    await user.click(screen.getByRole('button', { name: '+ Assign task' }));
    await user.type(screen.getByLabelText('Find a task'), '777{Enter}');
    await waitFor(() => expect(onAssignTask).toHaveBeenCalledWith('proposal-1', '777'));
  });

  it('Esc closes the picker without a write; the assigned task is a key that reopens it', async () => {
    const { user, onAssignTask } = renderRow(openRow());
    await user.click(screen.getByTestId('entry-task-id'));
    expect(screen.getByTestId('task-picker')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('task-picker')).toBeNull();
    expect(onAssignTask).not.toHaveBeenCalled();
  });

  it('the picker never prints # before an id', async () => {
    const { user } = renderRow(openRow());
    await user.click(screen.getByTestId('entry-task-id'));
    await screen.findByRole('option', { name: /555/ });
    expect(screen.getByTestId('task-picker').textContent).not.toContain('#');
  });
});

describe('EntryRow — Comment and Billable', () => {
  it('the comment input shows what Easy8 receives: the comment, else the title (R25)', () => {
    renderRow(asMerged(makeEntry('calendar', { comment: null })));
    expect(screen.getByLabelText('Comment')).toHaveValue('Daily standup');
  });

  it('Enter commits the edited comment; Esc reverts without a write', async () => {
    const { user, onUpdate } = renderRow(openRow({ comment: 'Dev work', title: 'Dev work' }));
    const input = screen.getByLabelText('Comment');
    await user.clear(input);
    await user.type(input, 'Refactor{Enter}');
    expect(onUpdate).toHaveBeenCalledWith('pomodoro-1', { comment: 'Refactor' });
    vi.mocked(onUpdate).mockClear();
    await user.click(input);
    await user.type(input, ' more');
    await user.keyboard('{Escape}');
    expect(onUpdate).not.toHaveBeenCalled();
    expect(input).toHaveValue('Dev work');
  });

  it('Billable is a Yes / No key that toggles through onToggleBillable', async () => {
    const { user, onToggleBillable } = renderRow(openRow());
    const key = screen.getByRole('button', { name: 'Billable' });
    expect(key).toHaveAttribute('aria-pressed', 'true');
    expect(key).toHaveTextContent('Yes');
    await user.click(key);
    expect(onToggleBillable).toHaveBeenCalledWith('pomodoro-1', false);
  });

  it('a non-billable row reads No', () => {
    renderRow(openRow({ billable: false }));
    const key = screen.getByRole('button', { name: 'Billable' });
    expect(key).toHaveAttribute('aria-pressed', 'false');
    expect(key).toHaveTextContent('No');
  });
});

describe('EntryRow — actions and errors', () => {
  it('hover actions live in .row-actions: Move and Delete call back with the id', async () => {
    const { user, onMove, onDelete, row } = renderRow(openRow());
    expect(row.querySelector('.row-actions')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onMove).toHaveBeenCalledWith('pomodoro-1');
    expect(onDelete).toHaveBeenCalledWith('pomodoro-1');
  });

  it('a proposal offers Dismiss only (no Move)', async () => {
    const { user, onDelete } = renderRow(asMerged(makeEntry('proposal')));
    expect(screen.queryByRole('button', { name: 'Move' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDelete).toHaveBeenCalledWith('proposal-1');
  });

  it('merged row shows the sessions badge and Delete carries the count', () => {
    const a = makeEntry('pomodoro', { id: 'p1' });
    const b = makeEntry('pomodoro', { id: 'p2' });
    renderRow(asMerged(a, [a, b]));
    expect(screen.getByText('2 sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('title', 'Delete all 2 sessions');
  });

  it('renders the log error as an alert; 401 offers Open Settings', async () => {
    const { user, onOpenSettings } = renderRow(openRow(), { error: 'Invalid API key (401)' });
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid API key (401)');
    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('a 404 error has no Open Settings key', () => {
    renderRow(openRow(), { error: 'Issue not found (404)' });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Settings' })).toBeNull();
  });

  it('calendar rows keep the blue dot, focus rows the amber one', () => {
    renderRow(asMerged(makeEntry('calendar')));
    expect(screen.getByTestId('entry-dot')).toHaveClass('bg-blue-400');
  });
});
