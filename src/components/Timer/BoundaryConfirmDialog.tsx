interface BoundaryConfirmDialogProps {
  workdayEndTime: string;
  onContinue: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
}

export default function BoundaryConfirmDialog({
  workdayEndTime,
  onContinue,
  onCancel,
  onOpenSettings
}: BoundaryConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-drip-bg/95 backdrop-blur-2xl border border-focus/30 rounded-2xl shadow-glass max-w-md w-full mx-4 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-focus/20">
          <h2 className="text-xl font-display font-semibold text-txt-primary">Starting Work Late?</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-txt-secondary mb-2">
            You're starting a focus session after your preferred workday end time ({workdayEndTime}).
          </p>
          <p className="text-sm text-txt-muted">
            This is just a gentle reminder - you can always continue if needed.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-focus/20 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-transparent border border-focus/20 text-txt-muted text-sm font-medium rounded-xl hover:bg-focus/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 text-sm font-medium bg-focus-muted text-focus rounded-xl
                     hover:bg-focus/20 transition-colors"
          >
            Change Settings
          </button>
          <button
            onClick={onContinue}
            className="px-4 py-2 text-sm font-medium bg-focus text-drip-bg rounded-xl
                     hover:bg-focus-light transition-colors"
          >
            Yes, Continue
          </button>
        </div>
      </div>
    </div>
  );
}
