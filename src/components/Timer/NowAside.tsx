import { useState } from 'react';
import TimerDayTimeline from './TimerDayTimeline';
import { toDateStr } from './timelineLogic';
import TimerTaskList from '../Lists/TimerTaskList';
import KeyButton from './KeyButton';
import AddEntryModal from '../DailyLog/AddEntryModal';
import { formatMinutesPadded } from '../Plan/boardLogic';
import { useLogStore } from '../../stores/logStore';
import { todayString } from '../DailyLog/reviewLogic';
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

/** `MON 28` */
function dayLabel(date: Date): string {
  return `${date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} ${date.getDate().toString().padStart(2, '0')}`;
}

/**
 * 340px aside (280px under 1000px): Timeline | Tasks with a compact day nav, one
 * summary line, and a footer with + Entry and Review day →.
 */
export default function NowAside({ sessions, calendarProposals, adhocEntries, onRefresh, onSelectTask, onNavigate }: Props) {
  const [panel, setPanel] = useState<'timeline' | 'tasks'>('timeline');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showAddModal, setShowAddModal] = useState(false);

  const dateStr = toDateStr(selectedDate);
  const isToday = dateStr === todayString();
  const daySessions = sessions.filter(s => toDateStr(new Date(s.start_at)) === dateStr);
  const dayAdhoc = adhocEntries.filter(e => e.date === dateStr);
  const dayProposals = calendarProposals.filter(p => p.date === dateStr);
  const focus = daySessions.filter(s => s.source !== 'break');
  const focusMinutes = focus.reduce((sum, s) => sum + s.duration_minutes, 0);
  const unlogged = countUnlogged(daySessions, dayAdhoc, dayProposals);

  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const openReview = () => {
    // R1: select today (which loads it) so Review lands on this day, not the last viewed one.
    // Local date, the same `todayString` Review's header uses (the UTC split was a day off after midnight CEST).
    useLogStore.getState().setSelectedDate(todayString());
    onNavigate('daily-log');
  };

  const handleAddEntry = async (entry: {
    durationMinutes: number;
    title: string;
    taskId: string | null;
    comment: string | null;
    billable: boolean;
    startTime: string | null;
  }) => {
    if (!window.logAPI) return;
    // Convert HH:MM start time to ISO datetime for start_time column
    let startTimeValue: string | null = null;
    if (entry.startTime) {
      const [hours, minutes] = entry.startTime.split(':').map(Number);
      const startDate = new Date(selectedDate);
      startDate.setHours(hours, minutes, 0, 0);
      startTimeValue = startDate.toISOString();
    }
    await window.logAPI.addAdhocEntry({
      date: dateStr,
      duration_minutes: entry.durationMinutes,
      title: entry.title,
      task_id: entry.taskId || null,
      comment: entry.comment || null,
      billable: entry.billable ? 1 : 0,
      is_todo: 0,
      due_date: null,
      completed: 0,
      marked_to_log: 1,
      logged: 0,
      start_time: startTimeValue,
    });
    onRefresh();
  };

  const tab = (id: 'timeline' | 'tasks', label: string, extra = '') => (
    <button
      type="button"
      onClick={() => setPanel(id)}
      aria-pressed={panel === id}
      className={`px-3 h-[30px] now-label transition-colors ${extra} ${
        panel === id ? 'bg-focus text-drip-bg' : 'text-txt-secondary hover:text-txt-primary hover:bg-focus/5'
      }`}
    >
      {label}
    </button>
  );

  const arrow = (delta: number, label: string, glyph: string) => (
    <button
      type="button"
      onClick={() => navigateDate(delta)}
      aria-label={label}
      className="w-7 h-[30px] flex items-center justify-center text-[14px] text-txt-muted hover:text-txt-primary transition-colors"
    >
      {glyph}
    </button>
  );

  return (
    <aside aria-label="Day" className="w-[280px] wide:w-[340px] shrink-0 border-l border-drip-elevated flex flex-col overflow-hidden">
      <div className="px-5 pt-5 pb-3.5 shrink-0 flex flex-col gap-3.5 border-b border-drip-elevated">
        <div className="flex items-center justify-between gap-2">
          <span role="group" aria-label="Sidebar view" className="inline-flex border border-drip-border">
            {tab('timeline', 'Timeline')}
            {tab('tasks', 'Tasks', 'border-l border-drip-border')}
          </span>
          {panel === 'timeline' && (
            <span className="flex items-center gap-0.5 font-mono text-[11px] tracking-[1px]">
              {arrow(-1, 'Previous day', '‹')}
              <span data-testid="aside-day" className={isToday ? 'text-focus' : 'text-txt-secondary'}>{dayLabel(selectedDate)}</span>
              {arrow(1, 'Next day', '›')}
            </span>
          )}
        </div>
        <span data-testid="day-summary" className="font-mono text-[10.5px] tracking-[1px] text-txt-muted">
          <span className="text-txt-primary">{focus.length}</span> session{focus.length === 1 ? '' : 's'} ·{' '}
          <span className="text-txt-primary">{formatMinutesPadded(focusMinutes)}</span> focus ·{' '}
          <span className="text-focus">{unlogged}</span> unlogged
        </span>
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {panel === 'timeline' ? (
          <TimerDayTimeline sessions={sessions} calendarProposals={calendarProposals} adhocEntries={adhocEntries} selectedDate={selectedDate} />
        ) : (
          <TimerTaskList onSelectTask={onSelectTask} />
        )}
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 px-5 h-14 border-t border-drip-elevated">
        <KeyButton variant="ghost" size="sm" onClick={() => setShowAddModal(true)}>+ Entry</KeyButton>
        <button
          type="button"
          onClick={openReview}
          className="now-label text-focus hover:text-focus-light transition-colors"
        >
          Review day →
        </button>
      </div>

      {showAddModal && (
        <AddEntryModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddEntry}
        />
      )}
    </aside>
  );
}
