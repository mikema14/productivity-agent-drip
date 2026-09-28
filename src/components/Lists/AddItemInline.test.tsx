import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddItemInline from './AddItemInline';
import type { TaskList } from '../../types';

const ops: TaskList = { id: 'l1', name: 'Ops', color: '#f00', icon_path: null, task_id: null, order: 0, archived: 0, billable: 1, created_at: '' };
const bound: TaskList = { id: 'l2', name: 'Bound', color: '#0f0', icon_path: null, task_id: '679834', order: 1, archived: 0, billable: 0, created_at: '' };

function setup(listId = 'l1', chooseList = false) {
  const onAdd = vi.fn(async () => undefined);
  const onCancel = vi.fn();
  render(<AddItemInline listId={listId} column="today" lists={[ops, bound]} chooseList={chooseList} onAdd={onAdd} onCancel={onCancel} />);
  return {
    onAdd, onCancel, user: userEvent.setup(),
    title: screen.getByRole('textbox', { name: 'Task name' }),
    easy8: screen.getByRole('combobox', { name: 'Easy8 task' }),
  };
}

describe('AddItemInline', () => {
  beforeEach(() => {
    window.logAPI.getCachedTask = vi.fn(async () => null);
    window.logAPI.searchTasks = vi.fn(async () => []);
    window.timerAPI.getIssue = vi.fn(async () => { throw new Error('Issue #999 not found (404)'); });
  });

  it('an ad-hoc task: title + Enter adds it with no task id and the list billable default', async () => {
    const { user, title, onAdd } = setup();
    await user.type(title, 'Scope finalising{Enter}');
    expect(onAdd).toHaveBeenCalledWith('Scope finalising', null, true, 'l1');
    expect(title).toHaveValue('');
  });

  it('an Easy8 id + Enter fetches the issue, fills an empty title, and a second Enter adds it', async () => {
    window.timerAPI.getIssue = vi.fn(async () => ({ taskId: '662962', title: 'GDI scope', projectId: 7, projectName: 'GDI' }));
    const { user, easy8, title, onAdd } = setup();
    await user.type(easy8, '662962{Enter}');
    expect(window.timerAPI.getIssue).toHaveBeenCalledWith('https://example.test', 'test-key', '662962');
    await waitFor(() => expect(title).toHaveValue('GDI scope'));
    expect(screen.getByText('GDI scope', { selector: 'p' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledWith('GDI scope', '662962', true, 'l1');
  });

  it('a cached id resolves without the API', async () => {
    window.logAPI.getCachedTask = vi.fn(async () => ({ task_id: '689742', title: 'Automatizace', project_id: 1, project_name: 'EWOK', last_seen_at: '' }));
    const { user, easy8, title } = setup();
    await user.type(easy8, '689742{Enter}');
    await waitFor(() => expect(title).toHaveValue('Automatizace'));
    expect(window.timerAPI.getIssue).not.toHaveBeenCalled();
  });

  it('an unknown id shows an alert; the task can still be added', async () => {
    const { user, easy8, title, onAdd } = setup();
    await user.type(title, 'Something');
    await user.type(easy8, '999{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Issue #999 not found (404)');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('Something', '999', true, 'l1');
  });

  it('typing searches the task cache; picking a match sets the id and title', async () => {
    window.logAPI.searchTasks = vi.fn(async () => [{ task_id: '690982', title: 'Deeplexus', project_id: 1, project_name: 'Presales', last_seen_at: '' }]);
    const { user, easy8, title } = setup();
    await user.type(easy8, 'deep');
    await user.click(await screen.findByRole('option', { name: /Deeplexus/ }));
    expect(easy8).toHaveValue('690982');
    expect(title).toHaveValue('Deeplexus');
  });

  it('a list bound to a task turns the id field off and adds with no item id', async () => {
    const { user, easy8, title, onAdd } = setup('l2');
    expect(easy8).toBeDisabled();
    expect(easy8).toHaveAttribute('placeholder', 'logs to 679834');
    await user.type(title, 'Bound work{Enter}');
    expect(onAdd).toHaveBeenCalledWith('Bound work', null, false, 'l2');
  });

  it('all scope: the list chooser switches the target list and its billable default', async () => {
    const { user, title, onAdd } = setup('l1', true);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Add to list' }), 'l2');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await user.type(title, 'Elsewhere{Enter}');
    expect(onAdd).toHaveBeenCalledWith('Elsewhere', null, false, 'l2');
  });

  it('Esc cancels', async () => {
    const { user, title, onCancel } = setup();
    await user.type(title, 'x{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});
