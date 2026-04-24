interface Props {
  elapsedSeconds: number;
  onKeep: () => void;
  onCancel: () => void;
}

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60);
  return m === 1 ? '1 min' : `${m} min`;
}

export default function CancelConfirmModal({ elapsedSeconds, onKeep, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-drip-surface border border-focus/20 rounded-2xl shadow-glass max-w-sm w-full mx-4 animate-scale-in">
        <div className="p-6">
          <h3 className="text-base font-display font-semibold text-txt-primary mb-1">
            Cancel this session?
          </h3>
          <p className="text-sm text-txt-muted">
            You'll lose the {formatElapsed(elapsedSeconds)} you've logged so far.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onKeep}
            className="flex-1 h-10 rounded-xl bg-focus/15 border border-focus/25 text-focus text-sm font-medium
                       hover:bg-focus/20 transition-all duration-150 active:scale-[0.98]"
          >
            Keep focusing
          </button>
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl border border-white/10 text-txt-muted text-sm font-medium
                       hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/5 transition-all duration-150 active:scale-[0.98]"
          >
            Cancel session
          </button>
        </div>
      </div>
    </div>
  );
}
