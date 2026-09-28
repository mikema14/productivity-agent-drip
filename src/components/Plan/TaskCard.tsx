import type { ListItem, ListItemColumn, Subtask, TaskList } from '../../types';
import DraggableItem from '../Lists/DraggableItem';
import TaskDetailInline from '../Lists/TaskDetailInline';
import TaskIdBadge from '../shared/TaskIdBadge';
import { effectiveTaskId, moveTargets, provenance } from './boardLogic';

export interface TaskCardActions {
  onToggleComplete: (item: ListItem) => void;
  onToggleExpand: (id: string) => void;
  onToggleChecklist: (id: string) => void;
  onTogglePicker: (id: string) => void;
  onMoveColumn: (item: ListItem, target: ListItemColumn) => void;
  onMoveToList: (item: ListItem, listId: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ListItem>) => Promise<void>;
  onCloseDetail: () => void;
}

export interface TaskCardProps {
  item: ListItem;
  list: TaskList | undefined;
  lists: TaskList[];
  /** True when the card sits in the 4th Done column (no column moves, not part of the data order). */
  inDoneColumn: boolean;
  /** Whether the id slot (pill or "No task ID") renders at all. */
  showId: boolean;
  showListTag: boolean;
  taskName: string | null;
  /** `1h 15m`, `2h 10m wk`; null = no tracked time to show (nothing is rendered). */
  minutesLabel: string | null;
  /** `14d` for stale backlog items. */
  ageBadge: string | null;
  expanded: boolean;
  checklistOpen: boolean;
  pickerOpen: boolean;
  draggable: boolean;
  actions: TaskCardActions;
}

const iconProps = { width: 12, height: 12, viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const MOVE = 'h-6 px-1.5 rounded-[2px] font-display text-[11.5px] whitespace-nowrap text-txt-muted hover:text-txt-primary hover:bg-focus/10 transition-colors';
const ACTION = 'w-6 h-6 flex items-center justify-center rounded-[2px] text-txt-muted hover:text-txt-primary hover:bg-focus/10 transition-colors';

function parseSubtasks(item: ListItem): Subtask[] {
  try {
    const subs: Subtask[] = JSON.parse(item.subtasks || '[]');
    return Array.isArray(subs) ? subs : [];
  } catch {
    return [];
  }
}

/**
 * One Plan card (mockup Plan.dc.html:120-131): complete dot + title (full
 * width, clamped to 2 lines) with the hover actions overlaid top-right, then
 * id · list · provenance/age · subtasks · tracked time. Expands into the
 * unchanged TaskDetailInline or the lightweight subtask checklist.
 */
export default function TaskCard(props: TaskCardProps) {
  const { item, list, lists, inDoneColumn, showId, showListTag, taskName, minutesLabel, ageBadge, expanded, checklistOpen, pickerOpen, draggable, actions } = props;
  const done = item.completed === 1;
  const color = list?.color || '#f59e0b';
  const subs = parseSubtasks(item);
  const subtaskCount = subs.length > 0 ? { done: subs.filter(s => s.completed).length, total: subs.length } : null;
  const targets = done || inDoneColumn ? [] : moveTargets(item.column);
  const from = provenance(item);
  const effective = effectiveTaskId(item, list);

  const idSlot = !showId ? null
    : item.task_id ? <TaskIdBadge plain taskId={item.task_id} taskName={taskName} className={`font-mono ${done ? 'text-txt-muted' : 'text-focus'}`} />
    : effective ? null
    : <span>No task ID</span>;
  const hasRow2 = idSlot || (showListTag && list) || from || ageBadge || subtaskCount || minutesLabel;

  const card = (
    <>
      <div
        data-testid="plan-card"
        className={`plan-card group relative border border-drip-elevated hover:border-drip-border rounded-[2px] px-3 py-2.5 transition-colors ${done ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            aria-label={done ? 'Mark not done' : 'Mark done'}
            onClick={(e) => { e.stopPropagation(); actions.onToggleComplete(item); }}
            className={`w-[14px] h-[14px] mt-[3px] shrink-0 flex items-center justify-center rounded-[2px] border transition-colors ${
              done ? 'bg-break/15 text-break border-transparent' : 'border-transparent group-hover:border-drip-border focus-visible:border-drip-border'
            }`}
          >
            {done ? (
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>
            ) : (
              <span className="w-[7px] h-[7px] rounded-full group-hover:hidden group-focus-within:hidden" style={{ backgroundColor: color }} />
            )}
          </button>

          <button
            type="button"
            data-testid="plan-card-title"
            onClick={() => actions.onToggleExpand(item.id)}
            title={item.title}
            className={`flex-1 min-w-0 text-left font-display text-[13.5px] leading-5 transition-colors ${done ? 'text-txt-muted' : 'text-txt-primary hover:text-focus'}`}
          >
            <span className={`block line-clamp-2 break-words ${done ? 'line-through' : ''}`}>{item.title}</span>
          </button>

          {/* Overlaid (not in flow) so the title keeps the full card width and never reflows on hover. */}
          <div className="plan-card-actions absolute top-[7px] right-2 flex items-center gap-0.5 pl-1.5 bg-drip-bg">
            {targets.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={(e) => { e.stopPropagation(); actions.onMoveColumn(item, t.key); }}
                className={MOVE}
                title={`Move to ${t.label}`}
                aria-label={`Move to ${t.label}`}
              >
                {t.label}
              </button>
            ))}
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button type="button" onClick={(e) => { e.stopPropagation(); actions.onTogglePicker(item.id); }} className={ACTION} title="Move to list">
                <svg {...iconProps}><path d="M1 3a1 1 0 011-1h2.5L5.5 3.5H10a1 1 0 011 1v5a1 1 0 01-1 1H2a1 1 0 01-1-1V3z" /></svg>
              </button>
              {pickerOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-drip-elevated border border-drip-border rounded-[2px] py-1 animate-fade-in">
                  {lists.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      role="menuitem"
                      onClick={(e) => { e.stopPropagation(); actions.onMoveToList(item, l.id); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 font-display text-[12px] text-left transition-colors hover:bg-focus/10 ${
                        l.id === item.list_id ? 'text-focus' : 'text-txt-secondary hover:text-txt-primary'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="flex-1 truncate">{l.name}</span>
                      {l.id === item.list_id && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 5l2 2 4-4" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); actions.onDelete(item.id); }} className={`${ACTION} hover:text-alert hover:bg-alert/10`} title="Delete">
              <svg {...iconProps}><path d="M3 3l6 6M9 3l-6 6" /></svg>
            </button>
          </div>
        </div>

        {hasRow2 && (
          <div className="flex items-center gap-2 pl-[22px] mt-[3px] font-display text-[11.5px] text-txt-muted min-w-0">
            {idSlot && <span data-testid="plan-card-id" className="inline-flex">{idSlot}</span>}
            {showListTag && list && <span className="truncate">{list.name}</span>}
            {from && <span className="truncate">from call · {from.date}</span>}
            {ageBadge && <span className="font-mono text-[11px]">{ageBadge}</span>}
            {subtaskCount && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); actions.onToggleChecklist(item.id); }}
                className="shrink-0 flex items-center gap-1 font-mono text-[11px] text-txt-muted hover:text-txt-primary transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={`transition-transform duration-150 ${checklistOpen ? 'rotate-90' : ''}`}>
                  <path d="M3 1.5l4 3.5-4 3.5" />
                </svg>
                {subtaskCount.done}/{subtaskCount.total} Subtasks
              </button>
            )}
            <span className="flex-1" />
            {minutesLabel && <span className="font-mono">{minutesLabel}</span>}
          </div>
        )}
      </div>

      {expanded && (
        <TaskDetailInline
          item={item}
          listColor={color}
          isFolderList={!list?.task_id}
          listTaskId={list?.task_id ?? null}
          onUpdate={actions.onUpdate}
          onClose={actions.onCloseDetail}
        />
      )}

      {checklistOpen && !expanded && subs.length > 0 && (
        <div data-testid="plan-card-checklist" className="ml-6 mt-1 mb-1 pl-2 border-l-2 space-y-0.5 animate-fade-in" style={{ borderColor: color }}>
          {subs.map(s => (
            <div key={s.id} className="flex items-center gap-2 py-0.5">
              <button
                type="button"
                aria-label={s.completed ? `Mark subtask not done: ${s.title}` : `Mark subtask done: ${s.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = subs.map(x => x.id === s.id ? { ...x, completed: !x.completed } : x);
                  actions.onUpdate(item.id, { subtasks: JSON.stringify(updated) });
                }}
                className={`w-3.5 h-3.5 rounded-[2px] shrink-0 flex items-center justify-center border transition-colors ${s.completed ? 'border-transparent' : 'border-drip-border'}`}
                style={s.completed ? { backgroundColor: color } : undefined}
              >
                {s.completed && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round"><path d="M1.5 4l1.5 1.5L6.5 2.5" /></svg>
                )}
              </button>
              <span className={`text-xs ${s.completed ? 'text-txt-muted line-through' : 'text-txt-secondary'}`}>{s.title}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (!draggable) return <div>{card}</div>;
  return <DraggableItem id={item.id}>{card}</DraggableItem>;
}
