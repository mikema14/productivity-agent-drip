import { ReactNode, useEffect, useState } from 'react';
import { useListsStore } from '../../stores/listsStore';
import { useIntentionsStore } from '../../stores/intentionsStore';
import SetIntentionModal from '../shared/SetIntentionModal';

interface SidebarProps {
  onNavigate: (view: string) => void;
  currentView: string;
  collapsed: boolean;
  onToggle: () => void;
  onCreateList: () => void;
}

function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="15" height="13" rx="2" />
      <line x1="6.5" y1="2.5" x2="6.5" y2="15.5" />
    </svg>
  );
}

const svgProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 18 18',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function TimerIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="9" cy="9.5" r="6.5" />
      <line x1="9" y1="9.5" x2="9" y2="6.5" />
      <line x1="9" y1="9.5" x2="11.5" y2="9.5" />
      <line x1="9" y1="2" x2="9" y2="3" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.5" y="3" width="11" height="13" rx="1.5" />
      <path d="M6.5 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
      <line x1="6.5" y1="8" x2="11.5" y2="8" />
      <line x1="6.5" y1="11" x2="10" y2="11" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg {...svgProps}>
      <rect x="2.5" y="9" width="3" height="7" rx="0.5" />
      <rect x="7.5" y="5" width="3" height="11" rx="0.5" />
      <rect x="12.5" y="2" width="3" height="14" rx="0.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" />
    </svg>
  );
}

export default function Sidebar({ onNavigate, currentView, collapsed, onToggle, onCreateList }: SidebarProps) {
  const menuItems: { id: string; label: string; icon: ReactNode }[] = [
    { id: 'timer', label: 'Timer', icon: <TimerIcon /> },
    { id: 'daily-log', label: 'Daily Log', icon: <ClipboardIcon /> },
    { id: 'progress', label: 'Progress', icon: <BarChartIcon /> },
    { id: 'settings', label: 'Settings', icon: <GearIcon /> },
  ];

  const { lists, archivedLists, loadLists, selectedListId, selectList, showArchivedLists, toggleShowArchivedLists, unarchiveList } = useListsStore();
  const today = new Date().toISOString().split('T')[0];
  const { getIntentions, loadDay, addIntention, removeIntention } = useIntentionsStore();
  const intentions = getIntentions(today);
  const [showIntentionModal, setShowIntentionModal] = useState(false);

  useEffect(() => { loadLists(); }, []);
  useEffect(() => { loadDay(today); }, [today]);

  const handleListClick = (listId: string) => {
    selectList(listId);
    onNavigate('lists');
  };

  const handleAllTasksClick = () => {
    selectList(null);
    onNavigate('all-lists');
  };

  return (
    <>
    <div className={`${collapsed ? 'w-[76px]' : 'w-64'} bg-drip-bg/80 backdrop-blur-xl border-r border-focus/20 text-txt-primary h-screen flex flex-col overflow-hidden transition-all duration-200`}>
      {/* Titlebar header */}
      {collapsed ? (
        <div className="h-[68px] flex items-end pb-2 shrink-0 pl-[33px]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <button onClick={onToggle} title="Expand sidebar" className="text-txt-muted hover:text-txt-secondary transition-colors duration-200" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <SidebarToggleIcon />
          </button>
        </div>
      ) : (
        <div className="h-[52px] flex items-center shrink-0 pl-[78px] gap-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <button onClick={onToggle} title="Collapse sidebar" className="text-txt-muted hover:text-txt-secondary transition-colors duration-200" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <SidebarToggleIcon />
          </button>
          <span className="text-[13px] font-medium text-txt-secondary font-display">Drip</span>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="p-3">
        <ul className="space-y-0.5">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-2.5 px-3 py-2 rounded-md transition-all duration-200 ${
                  currentView === item.id ? 'bg-white/[0.08] text-focus' : 'text-txt-secondary hover:bg-white/[0.05] hover:text-txt-primary'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="font-normal font-display text-[13px] whitespace-nowrap">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Set Intention button */}
      {!collapsed && (
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowIntentionModal(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-txt-muted hover:text-txt-secondary hover:bg-white/[0.05] transition-all duration-200"
          >
            <span className="text-sm shrink-0">🎯</span>
            <span className="font-normal font-display text-[13px] whitespace-nowrap truncate flex-1 text-left">
              {intentions.length > 0 ? intentions[0] : 'Set intention'}
            </span>
            {intentions.length > 0 && (
              <span className="text-xs text-focus shrink-0">Edit</span>
            )}
          </button>
        </div>
      )}
      {collapsed && (
        <div className="px-3 pb-2 flex justify-center">
          <button
            onClick={() => setShowIntentionModal(true)}
            title="Set intention"
            className="w-9 h-9 flex items-center justify-center rounded-md text-txt-muted hover:text-txt-secondary hover:bg-white/[0.05] transition-colors text-sm"
          >
            🎯
          </button>
        </div>
      )}

      {/* Lists Section */}
      <div className="mx-3 border-t border-focus/20" />
      <div className="flex-1 overflow-y-auto p-3 pt-2">
        {!collapsed && (
          <div className="flex items-center justify-between mb-1.5 px-3">
            <span className="text-xs uppercase tracking-wider text-txt-muted font-medium">Lists</span>
            <button
              onClick={() => onCreateList()}
              className="w-5 h-5 flex items-center justify-center rounded-full text-txt-muted hover:text-txt-secondary hover:bg-focus/5 transition-colors"
              title="Create list"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="6" y1="2" x2="6" y2="10" />
                <line x1="2" y1="6" x2="10" y2="6" />
              </svg>
            </button>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mb-1.5">
            <button onClick={() => onCreateList()} className="w-5 h-5 flex items-center justify-center rounded-full text-txt-muted hover:text-txt-secondary hover:bg-focus/5 transition-colors" title="Create list">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="6" y1="2" x2="6" y2="10" />
                <line x1="2" y1="6" x2="10" y2="6" />
              </svg>
            </button>
          </div>
        )}
        <ul className="space-y-0.5">
          {/* All Tasks entry */}
          <li>
            <button
              onClick={handleAllTasksClick}
              title={collapsed ? 'All Tasks' : undefined}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-2.5 px-3 py-2 rounded-md transition-all duration-200 ${
                currentView === 'all-lists' ? 'bg-white/[0.08] text-txt-primary' : 'text-txt-secondary hover:bg-white/[0.05] hover:text-txt-primary'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
                <rect x="1" y="1" width="5" height="5" rx="1" />
                <rect x="8" y="1" width="5" height="5" rx="1" />
                <rect x="1" y="8" width="5" height="5" rx="1" />
                <rect x="8" y="8" width="5" height="5" rx="1" />
              </svg>
              {!collapsed && <span className="font-normal font-display text-[13px] whitespace-nowrap">All Tasks</span>}
            </button>
          </li>

          {/* Active lists */}
          {lists.map((list) => (
            <li key={list.id}>
              <button
                onClick={() => handleListClick(list.id)}
                title={collapsed ? list.name : undefined}
                className={`w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-2.5 px-3 py-2 rounded-md transition-all duration-200 ${
                  currentView === 'lists' && selectedListId === list.id
                    ? 'bg-white/[0.08] text-txt-primary'
                    : 'text-txt-secondary hover:bg-white/[0.05] hover:text-txt-primary'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                {!collapsed && <span className="font-normal font-display text-[13px] whitespace-nowrap truncate">{list.name}</span>}
              </button>
            </li>
          ))}

          {/* Archived lists toggle */}
          {archivedLists.length > 0 && !collapsed && (
            <>
              <li>
                <button
                  onClick={toggleShowArchivedLists}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-txt-dim hover:text-txt-muted transition-colors"
                >
                  {showArchivedLists ? 'Hide archived' : `Show archived (${archivedLists.length})`}
                </button>
              </li>
              {showArchivedLists && archivedLists.map((list) => (
                <li key={list.id} className="group">
                  <div className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-txt-dim opacity-60">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-txt-dim" />
                    <span className="font-normal font-display text-[13px] whitespace-nowrap truncate italic flex-1">{list.name}</span>
                    <button
                      onClick={() => unarchiveList(list.id)}
                      className="text-xs text-txt-muted hover:text-txt-secondary opacity-0 group-hover:opacity-100 transition-all"
                    >
                      Restore
                    </button>
                  </div>
                </li>
              ))}
            </>
          )}
        </ul>
      </div>

    </div>

      {showIntentionModal && (
        <SetIntentionModal
          intentions={intentions}
          onAdd={(text) => addIntention(today, text)}
          onRemove={(i) => removeIntention(today, i)}
          onClose={() => setShowIntentionModal(false)}
        />
      )}
    </>
  );
}
