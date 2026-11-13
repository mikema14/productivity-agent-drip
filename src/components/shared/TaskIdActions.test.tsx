import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskIdActions from './TaskIdActions';

function setup(onRow = vi.fn(), onRowDown = vi.fn()) {
  render(
    <>
      <TaskIdActions />
      <span data-task-id="702448">702448</span>
      <button type="button" onClick={onRow} onMouseDown={onRowDown}>
        <span data-task-id="111">111</span> row
      </button>
      <span data-task-id="not-an-id">x</span>
    </>,
  );
  return { onRow, onRowDown };
}

describe('TaskIdActions', () => {
  beforeEach(() => { vi.mocked(window.timerAPI.taskIdAction!).mockClear(); });

  it('copies a standalone id on click and says so', () => {
    setup();
    fireEvent.click(screen.getByText('702448'));
    expect(window.timerAPI.taskIdAction).toHaveBeenCalledWith('copy', '702448');
    expect(screen.getByTestId('task-id-copied')).toHaveTextContent('Copied 702448');
  });

  it('leaves a plain click inside a button to the button', () => {
    const { onRow } = setup();
    fireEvent.click(screen.getByText('111'));
    expect(onRow).toHaveBeenCalledTimes(1);
    expect(window.timerAPI.taskIdAction).not.toHaveBeenCalled();
  });

  it('⌘-click opens the task and the row does not react', () => {
    const { onRow, onRowDown } = setup();
    fireEvent.mouseDown(screen.getByText('111'), { metaKey: true });
    fireEvent.click(screen.getByText('111'), { metaKey: true });
    expect(window.timerAPI.taskIdAction).toHaveBeenCalledWith('open', '111');
    expect(onRow).not.toHaveBeenCalled();
    expect(onRowDown).not.toHaveBeenCalled();
  });

  it('right-click shows the menu without picking the row', () => {
    const { onRowDown } = setup();
    fireEvent.mouseDown(screen.getByText('111'), { button: 2 });
    fireEvent.contextMenu(screen.getByText('111'));
    expect(window.timerAPI.taskIdAction).toHaveBeenCalledWith('menu', '111');
    expect(onRowDown).not.toHaveBeenCalled();
  });

  it('Ctrl-click (Mac right-click) does not pick the row', () => {
    const { onRowDown } = setup();
    fireEvent.mouseDown(screen.getByText('111'), { ctrlKey: true });
    expect(onRowDown).not.toHaveBeenCalled();
  });

  it('copies an id on a draggable Plan card', () => {
    render(<><TaskIdActions /><div role="button" aria-roledescription="sortable"><span data-task-id="42">42</span></div></>);
    fireEvent.click(screen.getByText('42'));
    expect(window.timerAPI.taskIdAction).toHaveBeenCalledWith('copy', '42');
  });

  it('ignores elements whose value is not a task id', () => {
    setup();
    fireEvent.click(screen.getByText('x'));
    fireEvent.contextMenu(screen.getByText('x'));
    expect(window.timerAPI.taskIdAction).not.toHaveBeenCalled();
  });
});
