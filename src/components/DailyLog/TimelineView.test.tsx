import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TimelineView from './TimelineView';
import { useLogStore } from '../../stores/logStore';
import { useTimerStore } from '../../stores/timerStore';
import { makeEntry, FIXTURE_DATE } from '../../test/logFixtures';

describe('TimelineView', () => {
  beforeEach(() => {
    useLogStore.setState({ selectedDate: FIXTURE_DATE });
    useTimerStore.setState({ status: 'idle', sessionStartTime: null } as never);
  });

  it('renders hour labels for the dynamic range', () => {
    render(<TimelineView entries={[makeEntry('pomodoro', { startTime: `${FIXTURE_DATE}T07:30:00.000` })]} />);
    // min hour 7 → start 6; default max 20 → end 21
    expect(screen.getByText('06:00')).toBeInTheDocument();
    expect(screen.getByText('21:00')).toBeInTheDocument();
    expect(screen.queryByText('05:00')).toBeNull();
  });

  it('renders one block per scheduled entry with the duration text and no #', () => {
    const { container } = render(
      <TimelineView entries={[makeEntry('pomodoro'), makeEntry('calendar', { id: 'c1' }), makeEntry('break', { id: 'b1' })]} />
    );
    expect(screen.getByText('25m')).toBeInTheDocument();
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('Daily standup')).toBeInTheDocument();
    expect(screen.getByText('Break')).toBeInTheDocument();
    expect(container.textContent).not.toContain('#');
    expect(screen.queryByText('Unscheduled')).toBeNull();
  });

  it('lists entries without a start time under Unscheduled', () => {
    render(<TimelineView entries={[makeEntry('adhoc')]} />);
    expect(screen.getByText('Unscheduled')).toBeInTheDocument();
    expect(screen.getByText('Manual work')).toBeInTheDocument();
    expect(screen.getByText('643749')).toBeInTheDocument();
  });
});
