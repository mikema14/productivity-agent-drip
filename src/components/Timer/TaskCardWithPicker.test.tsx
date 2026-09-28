import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskCardWithPicker from './TaskCardWithPicker';
import { makeTask, makeTasks } from '../../test/fixtures';

function renderCard(pickerOpen: boolean) {
  const onToggle = vi.fn();
  render(
    <TaskCardWithPicker
      task={makeTask(1)}
      note=""
      recentTasks={makeTasks(4)}
      pickerOpen={pickerOpen}
      onToggle={onToggle}
      onSelectTask={vi.fn()}
      onNoteChange={vi.fn()}
      searchRef={createRef<HTMLInputElement>()}
    />
  );
  return { onToggle };
}

describe('TaskCardWithPicker', () => {
  it('collapsed: shows the note input and no listbox', () => {
    renderCard(false);
    expect(screen.getByPlaceholderText('Session note (optional)')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('collapsed: names the project once, in the header', () => {
    renderCard(false);
    const project = makeTask(1).project_name!;
    expect(screen.getAllByText((_, el) => el?.textContent === project || el?.textContent === `— ${project}`)).toHaveLength(1);
  });

  it('open: uses the shared list and marks the current task', () => {
    renderCard(true);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveAttribute('aria-current', 'true');
  });

  it('Esc calls onToggle when open', async () => {
    const { onToggle } = renderCard(true);
    await userEvent.setup().keyboard('{Escape}');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
