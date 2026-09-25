import { useEffect } from 'react';
import { useListsStore } from '../../stores/listsStore';
import type { ViewId } from './views';

interface ListsPanelProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onCreateList: () => void;
}

/**
 * The Lists section that used to live in the sidebar, now the left column of
 * the Plan view. Rows are a verbatim move; only the container changed.
 */
export default function ListsPanel({ view, onNavigate, onCreateList }: ListsPanelProps) {
  const { lists, archivedLists, loadLists, selectedListId, selectList, showArchivedLists, toggleShowArchivedLists, unarchiveList } = useListsStore();

  useEffect(() => { loadLists(); }, []);

  const handleListClick = (listId: string) => {
    selectList(listId);
    onNavigate('lists');
  };

  const handleAllTasksClick = () => {
    selectList(null);
    onNavigate('all-lists');
  };

  return (
    <div className="w-[212px] shrink-0 h-full border-r border-drip-elevated text-txt-primary flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 pt-4">
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
        <ul className="space-y-0.5">
          {/* All Tasks entry */}
          <li>
            <button
              onClick={handleAllTasksClick}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-200 ${
                view === 'all-lists' ? 'bg-white/[0.08] text-txt-primary' : 'text-txt-secondary hover:bg-white/[0.05] hover:text-txt-primary'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
                <rect x="1" y="1" width="5" height="5" rx="1" />
                <rect x="8" y="1" width="5" height="5" rx="1" />
                <rect x="1" y="8" width="5" height="5" rx="1" />
                <rect x="8" y="8" width="5" height="5" rx="1" />
              </svg>
              <span className="font-normal font-display text-[13px] whitespace-nowrap">All Tasks</span>
            </button>
          </li>

          {/* Active lists */}
          {lists.map((list) => (
            <li key={list.id}>
              <button
                onClick={() => handleListClick(list.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-200 ${
                  view === 'lists' && selectedListId === list.id
                    ? 'bg-white/[0.08] text-txt-primary'
                    : 'text-txt-secondary hover:bg-white/[0.05] hover:text-txt-primary'
                }`}
              >
                <span data-testid="list-color" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
                <span className="font-normal font-display text-[13px] whitespace-nowrap truncate">{list.name}</span>
              </button>
            </li>
          ))}

          {/* Archived lists toggle */}
          {archivedLists.length > 0 && (
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
  );
}
