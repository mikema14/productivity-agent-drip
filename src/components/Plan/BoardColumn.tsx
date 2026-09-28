import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ListItem, TaskList } from '../../types';
import { groupBacklog, groupByList, type BoardColumnKey } from './boardLogic';

export type ColumnGrouping =
  | { kind: 'list'; lists: TaskList[] }
  | { kind: 'backlog'; monday: Date; now: number }
  | null;

export interface BoardColumnProps {
  column: BoardColumnKey;
  label: string;
  open: ListItem[];
  /** Completed items rendered inline at the bottom (single-list scope). */
  done: ListItem[];
  /** Capacity / week line under the header. */
  subtitle?: ReactNode;
  /** List scope: done / total progress bar in the list colour. */
  progress?: { done: number; total: number; color: string } | null;
  grouping: ColumnGrouping;
  renderCard: (item: ListItem) => ReactNode;
  /** Rendered between the cards and the footer (Start on CTA). */
  beforeFooter?: ReactNode;
  footer?: ReactNode;
  /** Suppress the empty state while the add form is open. */
  isAdding?: boolean;
}

function GroupHeader({ label, count, color }: { label: string; count: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-0.5 pt-2 pb-1 first:pt-0">
      {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      <span className="now-label text-txt-muted truncate">{label}</span>
      <span className="font-mono text-[11px] text-txt-dim ml-auto">{count}</span>
    </div>
  );
}

/**
 * One board column (mockup Plan.dc.html:113-202): hairline section, now-label
 * header with counts, optional subtitle / progress, droppable sortable body,
 * optional footer. Today is amber-framed.
 */
export default function BoardColumn(props: BoardColumnProps) {
  const { column, label, open, done, subtitle, progress, grouping, renderCard, beforeFooter, footer, isAdding } = props;
  const { setNodeRef } = useDroppable({ id: column });
  const isToday = column === 'today';
  const isEmpty = open.length === 0 && done.length === 0;

  let body: ReactNode;
  if (grouping?.kind === 'list') {
    body = groupByList(open, grouping.lists).map(({ list, items }) => (
      <div key={list?.id || 'unknown'}>
        <GroupHeader label={list?.name || 'Unknown List'} count={items.length} color={list?.color} />
        <div className="flex flex-col gap-1.5">{items.map(renderCard)}</div>
      </div>
    ));
  } else if (grouping?.kind === 'backlog') {
    body = groupBacklog(open, grouping.monday, grouping.now).map(group => (
      <div key={group.key} data-testid={`backlog-group-${group.key}`}>
        <GroupHeader label={group.label} count={group.items.length} />
        <div className="flex flex-col gap-1.5">{group.items.map(renderCard)}</div>
      </div>
    ));
  } else {
    body = <div className="flex flex-col gap-1.5">{open.map(renderCard)}</div>;
  }

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      data-column={column}
      className={`flex flex-col min-h-0 min-w-[220px] flex-1 p-3.5 border rounded-[2px] ${isToday ? 'border-focus/30' : 'border-drip-elevated'}`}
    >
      <div className="flex items-baseline justify-between px-0.5">
        <h2 className={`now-label ${isToday ? 'text-focus' : 'text-txt-secondary'}`}>{label}</h2>
        <span className="font-mono text-[12px] text-txt-primary">
          {open.length}
          {done.length > 0 && <span className="text-txt-muted"> · {done.length} done</span>}
        </span>
      </div>
      {subtitle && <div className="font-display text-[12px] text-txt-muted px-0.5 pt-1">{subtitle}</div>}
      {progress && progress.total > 0 && (
        <div className="h-1 mt-2 bg-focus/10 overflow-hidden" aria-label={`${progress.done} of ${progress.total} done`}>
          <div data-testid="column-progress" className="h-full transition-all duration-300" style={{ width: `${(progress.done / progress.total) * 100}%`, backgroundColor: progress.color }} />
        </div>
      )}

      <div className="flex-1 min-h-[60px] overflow-y-auto mt-2.5 flex flex-col gap-1.5">
        {body}
        {done.length > 0 && <div className="flex flex-col gap-1.5">{done.map(renderCard)}</div>}
        {isEmpty && !isAdding && (
          <div className="flex flex-col items-center justify-center py-8 text-txt-muted">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none" className="mb-2 text-txt-dim">
              <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 14l3.5 3.5L19 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-xs">All Clear</span>
          </div>
        )}
      </div>

      {beforeFooter}
      {footer}
    </section>
  );
}

/** Wraps the column body in a SortableContext for the given ids. */
export function ColumnSortable({ ids, children }: { ids: string[]; children: ReactNode }) {
  return <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>;
}
