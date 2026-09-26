import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EndDayModal from './EndDayModal';
import { useIntentionsStore } from '../../stores/intentionsStore';

async function renderModal(props: Partial<React.ComponentProps<typeof EndDayModal>> = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(<EndDayModal date="2026-09-25" onClose={onClose} onSuccess={onSuccess} {...props} />);
  await screen.findByText('End Day - 2026-09-25');
  return { onClose, onSuccess, user: userEvent.setup() };
}

describe('EndDayModal', () => {
  beforeEach(() => {
    useIntentionsStore.setState({ intentions: new Map() });
  });

  it('prefills the reflection from initialReflection', async () => {
    await renderModal({ initialReflection: 'Shipped the review screen' });
    expect(screen.getByPlaceholderText('What moved forward today? What did you learn?')).toHaveValue('Shipped the review screen');
  });

  it('submit saves the ritual, computes the weekly summary for Monday and adds intentions on tomorrowDate', async () => {
    const { user, onSuccess } = await renderModal({ initialReflection: 'Good day', tomorrowDate: '2026-09-28' });
    await user.type(screen.getByPlaceholderText('First intention...'), 'Call KKS');
    await user.click(screen.getByRole('button', { name: 'End Day' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(window.dashboardAPI.saveShutdownRitual).toHaveBeenCalledWith('2026-09-25', 0, 0, [], 'Good day', null, ['Call KKS']);
    expect(window.dashboardAPI.computeWeeklySummary).toHaveBeenCalledWith('2026-09-21');
    expect(window.dashboardAPI.setDailyIntentions).toHaveBeenCalledWith('2026-09-28', ['Call KKS']);
  });

  it('Cancel calls onClose without saving', async () => {
    const { user, onClose } = await renderModal();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.dashboardAPI.saveShutdownRitual).not.toHaveBeenCalled();
  });
});
