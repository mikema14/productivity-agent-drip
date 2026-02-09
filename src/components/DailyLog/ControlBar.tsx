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
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
      {/* Row 1: View Toggle + Primary Action */}
      <div className="flex items-center justify-between mb-3">
        {/* Left: View Toggle */}
        <ViewToggle viewMode={props.viewMode} onViewChange={props.onViewModeChange} />

        {/* Right: Primary Action - Log Selected */}
        {props.markedCount > 0 && (
          <button
            onClick={props.onLogSelected}
            disabled={props.isLogging}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {props.isLogging ? 'Logging...' : `Log ${props.markedCount} ${props.markedCount === 1 ? 'Item' : 'Items'}`}
            <span>→</span>
          </button>
        )}
      </div>

      {/* Row 2: Secondary Actions */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
        {/* Add Entry */}
        <button
          onClick={props.onAddEntry}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors flex items-center gap-1.5"
        >
          <span>+</span>
          <span>Add</span>
        </button>

        {/* Templates */}
        <button
          onClick={props.onManageTemplates}
          className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors flex items-center gap-1.5"
        >
          <span>📋</span>
          <span>Templates</span>
        </button>

        {/* Select Toggle */}
        {props.toggleableCount > 0 && (
          <button
            onClick={props.onSelectToggle}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded transition-colors flex items-center gap-1.5"
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
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all flex items-center gap-2"
          >
            <span>🌙</span>
            <span>End Day</span>
          </button>
        )}

        {/* Group Toggle (only in list view) */}
        {props.showGroupToggle && (
          <button
            onClick={props.onGroupByTaskToggle}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
          >
            {props.groupByTask ? '⊟ Show Flat' : '⊞ Group by Task'}
          </button>
        )}
      </div>
    </div>
  );
}
