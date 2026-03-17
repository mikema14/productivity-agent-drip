import ViewToggle from './ViewToggle';

interface ControlBarProps {
  // View mode
  viewMode: 'list' | 'timeline';
  onViewModeChange: (mode: 'list' | 'timeline') => void;
  groupByTask: boolean;
  onGroupByTaskToggle: () => void;
  showGroupToggle: boolean;

  // Actions
  onAddEntry: () => void;
  onManageTemplates: () => void;
  onSyncCalendar: () => void;
  onEndDay: () => void;
  onSelectToggle: () => void;
  onLogSelected: () => void;

  // State
  isDayLocked: boolean;
  isSyncing: boolean;
  markedCount: number;
  toggleableCount: number;
  allSelected: boolean;
  isLogging: boolean;
}

export default function ControlBar(props: ControlBarProps) {
  return (
    <div className="p-3 mb-4">
      {/* Row 1: View Toggle + Primary Action */}
      <div className="flex items-center justify-between mb-3">
        {/* Left: View Toggle */}
        <ViewToggle viewMode={props.viewMode} onViewChange={props.onViewModeChange} />

        {/* Right: Primary Action - Log Selected */}
        {props.markedCount > 0 && (
          <button
            onClick={props.onLogSelected}
            disabled={props.isLogging}
            className="px-4 py-2 bg-emerald-500/80 hover:bg-emerald-500 text-white rounded-xl font-display font-medium backdrop-blur-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {props.isLogging ? 'Logging...' : `Log ${props.markedCount} ${props.markedCount === 1 ? 'Item' : 'Items'}`}
            <span>→</span>
          </button>
        )}
      </div>

      {/* Row 2: Secondary Actions */}
      <div className="flex items-center gap-2 pt-2">
        {/* Add Entry */}
        <button
          onClick={props.onAddEntry}
          className="px-3 py-1.5 text-txt-muted text-sm rounded-xl hover:bg-focus/5 hover:text-txt-secondary flex items-center gap-1.5 transition-all"
        >
          <span>+</span>
          <span>Add</span>
        </button>

        {/* Templates */}
        <button
          onClick={props.onManageTemplates}
          className="px-3 py-1.5 text-txt-muted text-sm rounded-xl hover:bg-focus/5 hover:text-txt-secondary flex items-center gap-1.5 transition-all"
        >
          <span>Templates</span>
        </button>

        {/* Select Toggle */}
        {props.toggleableCount > 0 && (
          <button
            onClick={props.onSelectToggle}
            className="px-3 py-1.5 text-txt-muted text-sm rounded-xl hover:bg-focus/5 hover:text-txt-secondary flex items-center gap-1.5 transition-all"
          >
            <span>⋮</span>
            <span>{props.allSelected ? 'Unselect' : 'Select'} All</span>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* End Day - Special styling */}
        {!props.isDayLocked && (
          <button
            onClick={props.onEndDay}
            className="px-4 py-2 text-sm font-medium bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 rounded-xl transition-all flex items-center gap-2"
          >
            <span>🌙</span>
            <span>End Day</span>
          </button>
        )}

        {/* Group Toggle (only in list view) */}
        {props.showGroupToggle && (
          <button
            onClick={props.onGroupByTaskToggle}
            className="px-2 py-1 text-xs text-txt-muted hover:bg-focus/5 rounded transition-colors"
          >
            {props.groupByTask ? '⊟ Show Flat' : '⊞ Group by Task'}
          </button>
        )}
      </div>
      <div className="mx-3 mt-3 border-t border-focus/20" />
    </div>
  );
}
