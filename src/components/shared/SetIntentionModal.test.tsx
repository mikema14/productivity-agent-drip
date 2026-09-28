import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetIntentionModal from './SetIntentionModal';

function renderModal(onAdd: (text: string) => Promise<void> = vi.fn(async () => undefined)) {
  const onClose = vi.fn();
  render(<SetIntentionModal intentions={[]} onAdd={onAdd} onRemove={vi.fn()} onClose={onClose} />);
  const input = screen.getByPlaceholderText(/what will you focus on today/i);
  return { onAdd, onClose, input, user: userEvent.setup() };
}

describe('SetIntentionModal', () => {
  it('Enter adds the draft and keeps the modal open for another', async () => {
    const { onAdd, onClose, input, user } = renderModal();
    await user.type(input, 'Ship GDI scope{Enter}');
    expect(onAdd).toHaveBeenCalledWith('Ship GDI scope');
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('Done saves a typed draft before closing', async () => {
    const { onAdd, onClose, input, user } = renderModal();
    await user.type(input, '  Ship GDI scope ');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onAdd).toHaveBeenCalledWith('Ship GDI scope');
    expect(onClose).toHaveBeenCalled();
  });

  it('Done with nothing typed just closes', async () => {
    const { onAdd, onClose, user } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc and × discard the draft', async () => {
    const { onAdd, onClose, input, user } = renderModal();
    await user.type(input, 'Not this{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close without saving' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('a failed save shows an alert and keeps the modal and draft', async () => {
    const { onClose, input, user } = renderModal(vi.fn(async () => { throw new Error('ipc'); }));
    await user.type(input, 'Ship GDI scope');
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/could not save/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue('Ship GDI scope');
  });
});
