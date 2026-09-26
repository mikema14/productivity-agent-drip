import { useState } from 'react';
import TimerDayTimeline from './TimerDayTimeline';
import TimerTaskList from '../Lists/TimerTaskList';
import { SectionHeader } from './FocusBlock';
import { useLogStore } from '../../stores/logStore';
import type { PomodoroSession, CalendarProposal, AdhocEntry } from '../../types';
import type { ViewId } from '../Layout/views';

interface Props {
  /** Today's rows, as loaded by the Timer. */
  sessions: PomodoroSession[];
  calendarProposals: CalendarProposal[];
  adhocEntries: AdhocEntry[];
  onRefresh: () => void;
  onSelectTask: (taskId: string | null, intention: string) => void;
  onNavigate: (view: ViewId) => void;
}

/** Mirrors what Review will offer to log: focus sessions, adhoc entries and accepted meetings not yet logged. */
export function countUnlogged(sessions: PomodoroSession[], adhocEntries: AdhocEntry[], proposals: CalendarProposal[]): number {
  return (
    sessions.filter(s => s.source !== 'break' && s.logged === 0).length +
    adhocEntries.filter(e => e.logged === 0).length +
    proposals.filter(p => p.accepted === 1 && p.logged === 0).length
  );
}

/** 340px aside (280px under 1000px): the day timeline or the task list, with a link to Review. */
export default function NowAside({ sessions, calendarProposals, adhocEntries, onRefresh, onSelectTask, onNavigate }: Props) {
  const [panel, setPanel] = useState<'timeline' | 'tasks'>('timeline');
  const unlogged = countUnlogged(sessions, adhocEntries, calendarProposals);

  const openReview = () => {
    // R1: select today (which loads it) so Review lands on this day, not the last viewed one.
    const today = new Date().toISOString().split('T')[0];
    useLogStore.getState().setSelectedDate(today);
    onNavigate('daily-log');
  };

  const tab = (id: 'timeline' | 'tasks', label: string, extra = '') => (
    <button
      type="button"
      onClick={() => setPanel(id)}
      aria-pressed={panel === id}
      className={`px-3 h-7 now-label transition-colors ${extra} ${
        panel === id ? 'bg-focus text-drip-bg' : 'text-txt-muted hover:text-txt-primary hover:bg-focus/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <aside aria-label="Day" className="w-[280px] wide:w-[340px] shrink-0 border-l border-drip-elevated flex flex-col overflow-hidden">
      <div className="px-4 pt-5 pb-3 shrink-0">
        <SectionHeader
          right={
            <span className="inline-flex border border-drip-border">
              {tab('timeline', 'Timeline')}
              {tab('tasks', 'Tasks', 'border-l border-drip-border')}
            </span>
          }
        >
          03 Day
        </SectionHeader>
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {panel === 'timeline' ? (
          <TimerDayTimeline sessions={sessions} calendarProposals={calendarProposals} adhocEntries={adhocEntries} onRefresh={onRefresh} />
        ) : (
          <TimerTaskList onSelectTask={onSelectTask} />
        )}
      </div>

      <div className="shrink-0 flex items-center justify-between px-4 h-11 border-t border-drip-elevated">
        <span className="font-display text-[12px] text-txt-muted">
          {unlogged} unlogged
        </span>
        <button
          type="button"
          onClick={openReview}
          className="now-label text-focus hover:text-focus-light transition-colors"
        >
          Review day →
        </button>
      </div>
    </aside>
  );
}
