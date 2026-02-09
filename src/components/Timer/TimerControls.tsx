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
        className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white
                 font-bold text-lg rounded-xl transition-colors duration-200
                 shadow-lg hover:shadow-xl"
      >
        Start Focus Session
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4 justify-center">
      {/* Pause/Resume Button */}
      {isPaused ? (
        <button
          onClick={onResume}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white
                   font-semibold rounded-lg transition-colors duration-200"
        >
          Resume
        </button>
      ) : (
        <button
          onClick={onPause}
          className="px-8 py-3 bg-yellow-600 hover:bg-yellow-700 text-white
                   font-semibold rounded-lg transition-colors duration-200"
        >
          Pause
        </button>
      )}

      {/* Finish Early Button - only during focus session */}
      {status === 'focus' && (
        <button
          onClick={onFinishEarly}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white
                   font-semibold rounded-lg transition-colors duration-200"
        >
          Finish Early
        </button>
      )}

      {/* Skip Button */}
      <button
        onClick={onSkip}
        className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white
                 font-semibold rounded-lg transition-colors duration-200"
      >
        Skip
      </button>

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white
                 font-semibold rounded-lg transition-colors duration-200"
      >
        Cancel
      </button>
    </div>
  );
}
