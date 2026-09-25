import type { TaskList } from '../../types';
import TaskIdBadge from '../shared/TaskIdBadge';
import BillableToggle from '../shared/BillableToggle';

interface PillProps {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

/** 26px hairline toggle pill (Group by list / Done / IDs / list filters). */
export function Pill({ pressed, onClick, children, className = '' }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-[26px] inline-flex items-center gap-1.5 px-2.5 border rounded-[2px] font-display text-[12px] transition-colors duration-150 ${
        pressed ? 'border-focus/30 bg-focus/10 text-txt-primary' : 'border-drip-border text-txt-secondary hover:text-txt-primary hover:bg-focus/5'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export interface AllScopeProps {
  scope: 'all';
  openCount: number;
  lists: TaskList[];
  groupByList: boolean;
  onToggleGroup: () => void;
  showDone: boolean;
  onToggleDone: () => void;
  showTaskIds: boolean;
  onToggleTaskIds: () => void;
  filters: Set<string>;
  onToggleFilter: (listId: string) => void;
  onClearFilters: () => void;
}

export interface ListScopeProps {
  scope: 'list';
  list: TaskList;
  listTaskName: string | null;
  totalCount: number;
  remainingCount: number;
  onToggleBillable: (billable: boolean) => void;
  onArchive: () => void;
}

type Props = AllScopeProps | ListScopeProps;

/**
 * 48px sub-header under the Plan header. All scope: `All tasks · N across M
 * lists` + the Group / Done / IDs toggles and the list filter pills (the old
 * AllListsOverview header). List scope: the old ListPlanningView header.
 */
export default function PlanSubheader(props: Props) {
  if (props.scope === 'list') {
    const { list, listTaskName, totalCount, remainingCount, onToggleBillable, onArchive } = props;
    return (
      <div data-testid="plan-subheader" className="min-h-[48px] shrink-0 px-7 flex items-center gap-3.5 border-b border-drip-elevated">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: list.color }} />
        <span className="font-display text-[13.5px] font-medium text-txt-primary truncate">{list.name}</span>
        {list.task_id && (
          <TaskIdBadge plain taskId={list.task_id} taskName={listTaskName} className="font-mono text-[12px] text-focus bg-focus/10 rounded-[2px] px-1.5" />
        )}
        <BillableToggle
          size="sm"
          checked={list.billable !== 0}
          onChange={onToggleBillable}
          label={list.task_id ? 'Billable' : 'Billable default'}
        />
        <div className="h-px flex-1 bg-drip-elevated" />
        <span className="font-display text-[12px] text-txt-muted whitespace-nowrap">
          {totalCount === 0 ? 'This list has no tasks' : `${remainingCount} remaining`}
        </span>
        <button
          type="button"
          onClick={onArchive}
          title="Archive list"
          aria-label="Archive list"
          className="w-7 h-7 flex items-center justify-center rounded-[2px] text-txt-muted hover:text-txt-primary hover:bg-focus/5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="2" width="14" height="4" rx="1" />
            <path d="M2 6v7a1 1 0 001 1h10a1 1 0 001-1V6" />
            <path d="M6 9h4" />
          </svg>
        </button>
      </div>
    );
  }

  const { openCount, lists, groupByList, onToggleGroup, showDone, onToggleDone, showTaskIds, onToggleTaskIds, filters, onToggleFilter, onClearFilters } = props;
  return (
    <div data-testid="plan-subheader" className="shrink-0 px-7 border-b border-drip-elevated">
      <div className="h-[48px] flex items-center gap-3.5">
        <span className="font-display text-[13.5px] font-medium text-txt-primary">All tasks</span>
        <span className="font-display text-[12px] text-txt-muted whitespace-nowrap">
          {openCount} across {lists.length} {lists.length === 1 ? 'list' : 'lists'}
        </span>
        <div className="flex-1" />
        <Pill pressed={groupByList} onClick={onToggleGroup}>Group by list</Pill>
        <Pill pressed={showDone} onClick={onToggleDone}>Done</Pill>
        <Pill pressed={showTaskIds} onClick={onToggleTaskIds}>IDs</Pill>
      </div>
      {lists.length >= 2 && (
        <div data-testid="plan-list-filters" className="flex items-center gap-1.5 flex-wrap pb-2.5">
          <Pill pressed={filters.size === 0} onClick={onClearFilters}>All</Pill>
          {lists.map(list => (
            <Pill key={list.id} pressed={filters.has(list.id)} onClick={() => onToggleFilter(list.id)}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: list.color }} />
              {list.name}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}
