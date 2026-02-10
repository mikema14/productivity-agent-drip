interface ViewToggleProps {
  viewMode: 'list' | 'timeline';
  onViewChange: (mode: 'list' | 'timeline') => void;
}

export default function ViewToggle({ viewMode, onViewChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-xl border border-glass-border bg-glass-bg/30 backdrop-blur-sm p-1">
      <button
        onClick={() => onViewChange('list')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
          viewMode === 'list'
            ? 'bg-drip-elevated text-txt-primary shadow-glass-sm border border-glass-border'
            : 'text-txt-muted hover:text-txt-primary hover:bg-glass-hover'
        }`}
      >
        List
      </button>
      <button
        onClick={() => onViewChange('timeline')}
        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
          viewMode === 'timeline'
            ? 'bg-drip-elevated text-txt-primary shadow-glass-sm border border-glass-border'
            : 'text-txt-muted hover:text-txt-primary hover:bg-glass-hover'
        }`}
      >
        Timeline
      </button>
    </div>
  );
}
