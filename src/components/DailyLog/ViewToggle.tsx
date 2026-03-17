interface ViewToggleProps {
  viewMode: 'list' | 'timeline';
  onViewChange: (mode: 'list' | 'timeline') => void;
}

export default function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-xl bg-focus/5 p-1">
      <button
        onClick={() => onViewChange('list')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
          viewMode === 'list'
            ? 'bg-focus/15 text-focus'
            : 'text-txt-secondary hover:text-txt-primary hover:bg-focus/5'
        }`}
      >
        List
      </button>
      <button
        onClick={() => onViewChange('timeline')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
          viewMode === 'timeline'
            ? 'bg-focus/15 text-focus'
            : 'text-txt-secondary hover:text-txt-primary hover:bg-focus/5'
        }`}
      >
        Timeline
      </button>
    </div>
  );
}
