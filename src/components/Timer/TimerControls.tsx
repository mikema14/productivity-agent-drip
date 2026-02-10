import type { TimerStatus } from '../../types';

interface TimerControlsProps {
  status: TimerStatus;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onFinishEarly: () => void;
}

export default function TimerControls({
  status,
  isPaused,
  onStart,
  onPause,
  onResume,
  onSkip,
  onCancel,
  onFinishEarly
}: TimerControlsProps) {
  if (status === 'idle') {
    return (
      <button
        onClick={onStart}
        className="px-12 py-4 bg-focus text-drip-bg
                 font-display font-semibold text-lg rounded-2xl transition-all duration-200
                 shadow-glow-focus hover:scale-[1.02] active:scale-[0.98]"
      >
        Begin Focus
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 justify-center">
      {/* Pause/Resume Button */}
      {isPaused ? (
        <button
          onClick={onResume}
          className="px-8 py-3 bg-focus/10 border border-focus/20 text-focus
                   font-display font-medium rounded-xl transition-all duration-200
                   hover:bg-focus/20"
        >
          Resume
        </button>
      ) : (
        <button
          onClick={onPause}
          className="glass-button text-txt-secondary font-display font-medium"
        >
          Pause
        </button>
      )}

      {/* Finish Early Button - only during focus session */}
      {status === 'focus' && (
        <button
          onClick={onFinishEarly}
          className="px-8 py-3 bg-focus/10 border border-focus/20 text-focus
                   font-display font-medium rounded-xl transition-all duration-200
                   hover:bg-focus/20"
        >
          Finish Early
        </button>
      )}

      {/* Skip Button */}
      <button
        onClick={onSkip}
        className="glass-button text-txt-muted font-display font-medium"
      >
        Skip
      </button>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="px-4 py-2 text-txt-dim hover:text-red-400 font-display font-medium
                 transition-colors duration-200"
      >
        Cancel
      </button>
    </div>
  );
}
