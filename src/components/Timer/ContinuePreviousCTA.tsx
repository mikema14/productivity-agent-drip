import KeyButton from './KeyButton';
import type { PomodoroSession } from '../../types';

interface Props {
  previous: PomodoroSession;
  onContinue: () => void;
}

/** 44px hairline row offering to resume the last task. Its slot is reserved by the Timer even when absent. */
export default function ContinuePreviousCTA({ previous, onContinue }: Props) {
  const displayTitle = previous.comment || previous.task_id || 'Previous session';

  return (
    <div className="h-[44px] w-full flex items-center gap-3 border-b border-drip-elevated overflow-hidden">
      <span className="now-label text-focus shrink-0">Continue previous</span>
      {previous.task_id && (
        <span className="font-mono text-[11px] leading-4 text-focus bg-focus/10 px-1.5 py-0.5 rounded-[2px] shrink-0">
          {previous.task_id}
        </span>
      )}
      <span className="text-[13px] text-txt-primary truncate flex-1 min-w-0">{displayTitle}</span>
      <KeyButton variant="outline" size="sm" onClick={onContinue} kbd="→">Continue</KeyButton>
    </div>
  );
}
