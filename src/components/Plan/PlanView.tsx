import ListsPanel from '../Layout/ListsPanel';
import ListPlanningView from '../Lists/ListPlanningView';
import AllListsOverview from '../Lists/AllListsOverview';
import type { ViewId } from '../Layout/views';

interface PlanViewProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  onCreateList: () => void;
}

/** Plan = the lists panel beside either a single list board or the all-lists overview. */
export default function PlanView({ view, onNavigate, onCreateList }: PlanViewProps) {
  return (
    <div className="flex h-full">
      <ListsPanel view={view} onNavigate={onNavigate} onCreateList={onCreateList} />
      <div className="flex-1 min-w-0">
        {view === 'lists' ? <ListPlanningView /> : <AllListsOverview />}
      </div>
    </div>
  );
}
