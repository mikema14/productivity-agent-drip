import { useEffect } from 'react';
import ListsPanel from '../Layout/ListsPanel';
import PlanHeader from './PlanHeader';
import PlanBoard from './PlanBoard';
import { useListsStore } from '../../stores/listsStore';
import type { ViewId } from '../Layout/views';

interface PlanViewProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onCreateList: () => void;
}

/** Plan = header on top, then the lists panel beside the board. */
export default function PlanView({ view, onNavigate, onCreateList }: PlanViewProps) {
  const loadItems = useListsStore(s => s.loadItems);
  // ListsPanel loads the lists itself; the items are loaded once here for both scopes.
  useEffect(() => { loadItems(); }, []);

  return (
    <div className="flex flex-col h-full">
      <PlanHeader />
      <div className="flex flex-1 min-h-0">
        <ListsPanel view={view} onNavigate={onNavigate} onCreateList={onCreateList} />
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <PlanBoard scope={view === 'lists' ? 'list' : 'all'} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
