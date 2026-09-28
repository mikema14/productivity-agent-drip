import KeyButton from '../Timer/KeyButton';
import { useTimerStore } from '../../stores/timerStore';
import type { ViewId } from '../Layout/views';
import type { StartCandidate } from './boardLogic';

interface Props {
  candidate: StartCandidate | null;
  onNavigate: (view: ViewId) => void;
}

/**
 * `Start on 689742` at the bottom of Today (P13): hands the task to Now via
 * timerStore.pendingSelection, exactly what picking it in the Now aside does.
 * Hidden without a candidate or while a session runs.
 */
export default function StartOnCTA({ candidate, onNavigate }: Props) {
  const status = useTimerStore(s => s.status);
  if (!candidate || status !== 'idle') return null;
  return (
    <KeyButton
      variant="amber"
      size="md"
      className="w-full mt-2.5 shrink-0"
      onClick={() => {
        useTimerStore.getState().setPendingSelection({ taskId: candidate.taskId, title: candidate.item.title });
        onNavigate('timer');
      }}
    >
      Start on {candidate.taskId}
    </KeyButton>
  );
}
