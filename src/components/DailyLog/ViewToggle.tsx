interface ViewToggleProps {
  viewMode: 'list' | 'timeline';
  onViewChange: (mode: 'list' | 'timeline') => void;
}

export default function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
      <button
        onClick={() => onViewChange('list')}
        className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
          viewMode === 'list'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        List
      </button>
      <button
        onClick={() => onViewChange('timeline')}
        className={`px-3 py-1.5 text-sm font-medium rounded transition-all ${
          viewMode === 'timeline'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        Timeline
      </button>
    </div>
  );
}
