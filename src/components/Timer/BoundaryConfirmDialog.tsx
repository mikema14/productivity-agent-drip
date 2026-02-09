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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Starting Work Late?</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-700 mb-2">
            You're starting a focus session after your preferred workday end time ({workdayEndTime}).
          </p>
          <p className="text-sm text-gray-600">
            This is just a gentle reminder - you can always continue if needed.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
          >
            Change Settings
          </button>
          <button
            onClick={onContinue}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
          >
            Yes, Continue
          </button>
        </div>
      </div>
    </div>
  );
}
