import { useTimerStore } from '../stores/timerStore';

type TimerSnapshot = ReturnType<typeof useTimerStore.getState>;

const initial: TimerSnapshot = { ...useTimerStore.getState() };

/** Put the timer store into a given state (partial merge). */
export function setTimer(partial: Partial<TimerSnapshot>): void {
  useTimerStore.setState(partial);
}

/** Restore the timer store to its boot state; call from `afterEach`. */
export function resetTimer(): void {
  useTimerStore.setState({ ...initial }, true);
}
