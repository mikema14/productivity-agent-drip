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
        className="px-10 py-3 bg-focus text-drip-bg
                 font-display font-semibold text-base rounded-xl transition-all duration-150
                 shadow-glow-focus hover:brightness-110 active:scale-[0.98]"
      >
        Begin Focus
      </button>
    );
  }

  // Break state: Skip Break + Cancel ×
  if (status === 'break') {
    return (
      <div className="flex items-center gap-4 justify-center">
        <button
          onClick={onSkip}
          className="flex items-center gap-2 px-4 py-2 bg-transparent border border-focus/20
                   text-txt-muted text-sm font-display rounded-xl
                   hover:bg-focus/5 hover:text-txt-secondary transition-all duration-150"
        >
          Skip Break
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={onCancel}
          className="w-8 h-8 flex items-center justify-center text-txt-dim rounded-lg
                   hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
          title="Cancel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // Focus state (running or paused): Pause/Resume + Finish + Cancel ×
  return (
    <div className="flex items-center gap-4 justify-center">
      {/* Pause / Resume */}
      {isPaused ? (
        <button
          onClick={onResume}
          className="flex items-center gap-2 px-4 py-2 bg-transparent border border-focus/20
                   text-txt-muted text-sm font-display rounded-xl
                   hover:bg-focus/5 hover:text-txt-secondary transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Resume
        </button>
      ) : (
        <button
          onClick={onPause}
          className="flex items-center gap-2 px-4 py-2 bg-transparent border border-focus/20
                   text-txt-muted text-sm font-display rounded-xl
                   hover:bg-focus/5 hover:text-txt-secondary transition-all duration-150"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
          </svg>
          Pause
        </button>
      )}

      {/* Finish Early — ghost button */}
      <button
        onClick={onFinishEarly}
        className="flex items-center gap-1.5 px-4 py-2 bg-transparent border border-focus/20
                 text-txt-muted text-sm font-display rounded-xl
                 hover:bg-focus/5 hover:text-txt-secondary transition-all duration-150"
      >
        Finish ▸
      </button>

      {/* Cancel × */}
      <button
        onClick={onCancel}
        className="w-8 h-8 flex items-center justify-center text-txt-dim rounded-lg
                 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
        title="Cancel"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
