import { useEffect } from 'react';
import { useListsStore } from '../../stores/listsStore';
import { listSubtitle } from '../Plan/boardLogic';
import type { ViewId } from './views';

interface ListsPanelProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onCreateList: () => void;
}

const ROW = 'w-full flex items-center gap-2.5 px-2.5 rounded-[2px] text-left font-display transition-colors duration-150';
const ROW_IDLE = 'text-txt-primary hover:bg-focus/5';
const ROW_ACTIVE = 'bg-focus/10 text-focus';

/**
 * Plan's left aside (mockup Plan.dc.html:64-94): All tasks, one row per list
 * with its subtitle and open count, archived toggle at the bottom.
 */
export default function ListsPanel({ view, onNavigate, onCreateList }: ListsPanelProps) {
  const {
    lists, archivedLists, loadLists, selectedListId, selectList, showArchivedLists,
    toggleShowArchivedLists, unarchiveList, openCountByList, openCountAll,
  } = useListsStore();

  useEffect(() => { loadLists(); }, []);

  const counts = openCountByList();
  const allCount = openCountAll();

  const handleListClick = (listId: string) => {
    selectList(listId);
    onNavigate('lists');
  };

  const handleAllTasksClick = () => {
    selectList(null);
    onNavigate('all-lists');
  };

  return (
    <aside aria-label="Lists" className="w-[212px] shrink-0 h-full border-r border-drip-elevated text-txt-primary flex flex-col overflow-hidden p-3 pt-4">
      <div className="flex items-center justify-between px-2 pb-2">
        <h2 className="now-label text-txt-muted">Lists</h2>
        <button
          onClick={() => onCreateList()}
          aria-label="New list"
          title="Create list"
          className="w-6 h-6 flex items-center justify-center border border-drip-border rounded-[2px] text-txt-secondary hover:text-txt-primary hover:bg-focus/5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="6" y1="2" x2="6" y2="10" />
            <line x1="2" y1="6" x2="10" y2="6" />
          </svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5">
        <button
          onClick={handleAllTasksClick}
          aria-label="All tasks"
          aria-pressed={view === 'all-lists'}
          className={`${ROW} h-9 ${view === 'all-lists' ? ROW_ACTIVE : ROW_IDLE}`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
            <path d="M3 4h10M3 8h10M3 12h10" />
          </svg>
          <span className="flex-1 text-[13.5px]">All tasks</span>
          <span className="font-mono text-[11.5px]">{allCount}</span>
        </button>

        {lists.map((list) => {
          const active = view === 'lists' && selectedListId === list.id;
          return (
            <button
              key={list.id}
              onClick={() => handleListClick(list.id)}
              aria-label={list.name}
              aria-pressed={active}
              className={`${ROW} min-h-[44px] py-1.5 ${active ? ROW_ACTIVE : ROW_IDLE}`}
            >
              <span data-testid="list-color" className="w-2 h-2 rounded-full shrink-0 mx-[3px]" style={{ backgroundColor: list.color }} />
              <span className="flex-1 min-w-0 flex flex-col gap-px">
                <span className="text-[13.5px] truncate">{list.name}</span>
                <span className={`text-[11px] truncate ${active ? 'text-focus/70' : 'text-txt-muted'} ${list.task_id ? 'font-mono text-[10.5px]' : ''}`}>
                  {listSubtitle(list)}
                </span>
              </span>
              <span className={`font-mono text-[11.5px] ${active ? '' : 'text-txt-muted'}`}>{counts[list.id] ?? 0}</span>
            </button>
          );
        })}

        <div className="flex-1" />

        {archivedLists.length > 0 && (
          <>
            {showArchivedLists && archivedLists.map((list) => (
              <div key={list.id} className={`group ${ROW} min-h-[36px] py-1 text-txt-dim`}>
                <span className="w-2 h-2 rounded-full shrink-0 mx-[3px] bg-txt-dim" />
                <span className="flex-1 min-w-0 text-[13px] italic truncate">{list.name}</span>
                <button
                  onClick={() => unarchiveList(list.id)}
                  className="text-[11px] text-txt-muted hover:text-txt-primary opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                >
                  Restore
                </button>
              </div>
            ))}
            <button
              onClick={toggleShowArchivedLists}
              aria-pressed={showArchivedLists}
              className={`${ROW} h-8 text-[12.5px] ${showArchivedLists ? 'text-txt-secondary' : 'text-txt-muted hover:text-txt-secondary'}`}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="shrink-0">
                <rect x="2" y="3" width="12" height="3" rx="1" />
                <path d="M3 6v6.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M6.5 9h3" />
              </svg>
              <span>Archived · <span className="font-mono text-[11px]">{archivedLists.length}</span></span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
