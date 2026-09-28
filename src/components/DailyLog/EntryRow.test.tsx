import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryRow, { type EntryRowProps } from './EntryRow';
import { makeEntry, asMerged } from '../../test/logFixtures';
import type { LogEntry } from '../../stores/logStore';
import type { MergedEntry } from '../../utils/mergeEntries';

function renderRow(entry: MergedEntry, overrides: Partial<EntryRowProps> = {}) {
  const props: EntryRowProps = {
    entry,
    onUpdate: vi.fn(), onDelete: vi.fn(), onToggleLog: vi.fn(), onAccept: vi.fn(), onDismiss: vi.fn(),
    onMove: vi.fn(), onAssignTask: vi.fn(), onToggleBillable: vi.fn(), onOpenSettings: vi.fn(),
    ...overrides,
  };
  render(<EntryRow {...props} />);
  return { ...props, user: userEvent.setup(), row: screen.getByTestId('entry-row') };
}

const openRow = (o: Partial<LogEntry> = {}) => asMerged(makeEntry('pomodoro', o));

describe('EntryRow', () => {
  it('open pomodoro row: checkbox reflects markedToLog and toggling calls onToggleLog', async () => {
    const { user, onToggleLog, row } = renderRow(openRow({ markedToLog: false }));
    expect(row).toHaveAttribute('data-kind', 'open');
    const box = screen.getByRole('checkbox', { name: 'Log this entry' });
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(onToggleLog).toHaveBeenCalledWith('pomodoro-1');
    expect(screen.getByTestId('entry-dot')).toHaveClass('bg-focus');
  });

  it('id pill has no # and takes the cached title as tooltip', async () => {
    window.logAPI.getCachedTask = vi.fn(async () => ({ task_id: '643749', title: 'Feature X', project_id: 1, project_name: 'P', last_seen_at: '' }));
    renderRow(openRow());
    const pill = screen.getByTestId('entry-task-id');
    expect(pill).toHaveTextContent('643749');
    expect(pill.textContent).not.toContain('#');
    await waitFor(() => expect(pill).toHaveAttribute('title', 'Feature X'));
    expect(window.logAPI.getCachedTask).toHaveBeenCalledWith('643749');
  });

  it('Assign task on an id-less row opens the editor with the task field focused', async () => {
    const { user } = renderRow(asMerged(makeEntry('adhoc', { taskId: null })));
    await user.click(screen.getByRole('button', { name: 'Assign task' }));
    const editor = screen.getByTestId('entry-editor');
    expect(within(editor).getByPlaceholderText('Task ID')).toHaveFocus();
  });

  it('billable pill is pressed and toggles through onToggleBillable(id, false)', async () => {
    const { user, onToggleBillable } = renderRow(openRow());
    const pill = screen.getByRole('button', { name: 'Billable' });
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    await user.click(pill);
    expect(onToggleBillable).toHaveBeenCalledWith('pomodoro-1', false);
  });

  it('logged row: Logged check, static billable label, no checkbox, no actions', () => {
    const { row } = renderRow(asMerged(makeEntry('logged')));
    expect(row).toHaveAttribute('data-kind', 'logged');
    expect(screen.getByRole('img', { name: 'Logged' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('Billable')).not.toHaveAttribute('aria-pressed');
    expect(screen.queryByRole('button', { name: /Edit|Move|Delete/ })).toBeNull();
  });

  it('proposal row: tint, disabled checkbox, Accept / Dismiss callbacks, blue dot', async () => {
    const { user, onAccept, onDismiss, row } = renderRow(asMerged(makeEntry('proposal')));
    expect(row).toHaveAttribute('data-kind', 'proposal');
    expect(row.className).toContain('bg-focus/[0.04]');
    expect(screen.getByRole('checkbox', { name: 'Log this entry (needs accepting)' })).toBeDisabled();
    expect(screen.getByTestId('entry-dot')).toHaveClass('bg-blue-400');
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onAccept).toHaveBeenCalledWith('proposal-1');
    expect(onDismiss).toHaveBeenCalledWith('proposal-1');
  });

  it('proposal Assign task + Save calls onUpdate then onAssignTask(id, "123")', async () => {
    const { user, onUpdate, onAssignTask } = renderRow(asMerged(makeEntry('proposal')));
    await user.click(screen.getByRole('button', { name: 'Assign task' }));
    await user.type(screen.getByPlaceholderText('Task ID'), '123');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate).toHaveBeenCalledWith('proposal-1', expect.objectContaining({ title: 'KKS upsell call', durationMinutes: 60 }));
    expect(vi.mocked(onUpdate).mock.calls[0][1]).not.toHaveProperty('taskId');
    expect(onAssignTask).toHaveBeenCalledWith('proposal-1', '123');
    expect(screen.queryByTestId('entry-editor')).toBeNull();
  });

  it('break row: emerald dot, muted, no checkbox, no billable, no actions', () => {
    const { row } = renderRow(asMerged(makeEntry('break')));
    expect(row).toHaveAttribute('data-kind', 'break');
    expect(row).toHaveClass('text-txt-muted');
    expect(screen.getByTestId('entry-dot')).toHaveClass('bg-break');
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/billable/i)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('merged row shows the sessions badge and Delete carries the count', () => {
    const a = makeEntry('pomodoro', { id: 'p1' });
    const b = makeEntry('pomodoro', { id: 'p2' });
    renderRow(asMerged(a, [a, b]));
    expect(screen.getByText('2 sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('title', 'Delete all 2 sessions');
  });

  it('Edit → Save calls onUpdate with the five fields; hover actions live in .row-actions', async () => {
    const { user, onUpdate, row } = renderRow(openRow());
    expect(row.querySelector('.row-actions')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const comment = screen.getByLabelText('Comment');
    await user.clear(comment);
    await user.type(comment, 'Refactor');
    const duration = screen.getByLabelText('Duration');
    await user.clear(duration);
    await user.type(duration, '40');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate).toHaveBeenCalledWith('pomodoro-1', {
      taskId: '643749', title: 'Focus session', comment: 'Refactor', durationMinutes: 40, billable: true,
    });
  });

  it('Cancel restores the entry and closes the editor', async () => {
    const { user, onUpdate } = renderRow(openRow());
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Title'), ' extra');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('entry-editor')).toBeNull();
    expect(screen.getByText('Focus session')).toBeInTheDocument();
  });

  it('calendar row: selecting a task keeps the event title and copies it into an empty comment', async () => {
    window.logAPI.getRecentTasks = vi.fn(async () => [
      { task_id: '555', title: 'Sales task', project_id: 1, project_name: 'P', last_seen_at: '' },
    ]);
    const { user, onUpdate } = renderRow(asMerged(makeEntry('calendar', { comment: null })));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const taskInput = screen.getByPlaceholderText('Task ID');
    await user.clear(taskInput);
    await user.type(taskInput, '555');
    await user.tab(); // blur resolves the id against the recents list
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onUpdate).toHaveBeenCalledWith('calendar-1', expect.objectContaining({
      taskId: '555', title: 'Daily standup', comment: 'Daily standup',
    }));
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

  it('comment cell shows title · comment when the comment differs from the title', () => {
    renderRow(openRow({ title: 'Feature X', comment: 'Dev work' }));
    const row = screen.getByTestId('entry-row');
    expect(row).toHaveTextContent('Feature X · Dev work');
    expect(row.querySelector('[title="Feature X · Dev work"]')).not.toBeNull();
  });
});
