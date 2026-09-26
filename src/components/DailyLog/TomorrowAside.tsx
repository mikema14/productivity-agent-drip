import type { CalendarProposal, ListItem, TaskList } from '../../types';
import KeyButton from '../Timer/KeyButton';
import TaskIdBadge from '../shared/TaskIdBadge';
import { effectiveTaskId } from '../Plan/boardLogic';
import { DAY_TARGET_MINUTES } from '../Timer/TimerDayTimeline';
import { formatMinutesPadded, tomorrowCalendar, tomorrowLabel } from './reviewLogic';

export interface TomorrowAsideProps {
  /** Selected `YYYY-MM-DD`; the heading shows its next workday (R4). */
  date: string;
  /** Today-column items (open ones are listed under `Starts in Today`). */
  todayItems: ListItem[];
  lists: TaskList[];
  /** Tomorrow's proposals, or `null` when the feed could not be loaded. */
  proposals: CalendarProposal[] | null;
  reflection: string;
  onReflectionChange: (value: string) => void;
  locked: boolean;
  savedReflection: string | null;
  onEndDay: () => void;
}

/**
 * The Review aside (mockup Review.dc.html:164-184): tomorrow's date, the open
 * Today items that carry over, the meeting load, the one-line reflection draft
 * that seeds EndDayModal (R3), and `End day` / `Day ended` (R15).
 */
export default function TomorrowAside(props: TomorrowAsideProps) {
  const { date, todayItems, lists, proposals, reflection, onReflectionChange, locked, savedReflection, onEndDay } = props;
  const carry = todayItems.filter(i => !i.completed && !i.archived);
  const calendar = proposals ? tomorrowCalendar(proposals) : null;

  return (
    <aside
      aria-label="Tomorrow"
      className="w-[280px] wide:w-[320px] shrink-0 p-6 border-l border-drip-elevated flex flex-col gap-4 overflow-y-auto"
    >
      <h2 className="font-display text-[13px] font-medium text-txt-primary">
        Tomorrow · <span className="text-txt-muted font-normal" data-testid="tomorrow-date">{tomorrowLabel(date)}</span>
      </h2>

      <div className="flex flex-col gap-1.5">
        <span className="now-label text-txt-muted">Starts in Today</span>
        {carry.length === 0 ? (
          <span className="font-display text-[12.5px] text-txt-muted">Nothing carried over</span>
        ) : carry.map(item => {
          const taskId = effectiveTaskId(item, lists.find(l => l.id === item.list_id));
          return (
            <div key={item.id} data-testid="carry-item" className="h-10 px-3 flex items-center gap-2.5 border border-drip-elevated rounded-[2px]">
              {taskId && <TaskIdBadge taskId={taskId} taskName={null} plain className="shrink-0" />}
              <span title={item.title} className="font-display text-[13px] text-txt-primary truncate">{item.title}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="now-label text-txt-muted">Calendar</span>
        {calendar ? (
          <span data-testid="tomorrow-calendar" className="font-display text-[13px] text-txt-secondary">
            <span className="font-mono text-blue-300">{calendar.meetings}</span> {calendar.meetings === 1 ? 'meeting' : 'meetings'}
            {' · '}<span className="font-mono text-txt-primary">{formatMinutesPadded(calendar.meetingMinutes)}</span>
            <br />
            <span className="font-mono text-txt-primary">{formatMinutesPadded(calendar.freeMinutes)}</span> free of {formatMinutesPadded(DAY_TARGET_MINUTES)}
          </span>
        ) : (
          <span data-testid="tomorrow-calendar" className="font-display text-[12.5px] text-txt-muted">Calendar unavailable</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-reflection" className="now-label text-txt-muted">One line on today</label>
        {locked ? (
          <p data-testid="saved-reflection" className="font-display text-[14px] text-txt-secondary whitespace-pre-wrap min-h-[40px]">
            {savedReflection || <span className="text-txt-dim">No reflection saved</span>}
          </p>
        ) : (
          <textarea
            id="review-reflection"
            rows={3}
            value={reflection}
            onChange={e => onReflectionChange(e.target.value)}
            placeholder="What moved, what got in the way"
            className="resize-none px-3 py-2 font-display text-[14px] bg-transparent border border-focus/30 rounded-[2px] text-txt-primary placeholder-txt-dim focus:outline-none focus:border-focus/50"
          />
        )}
      </div>

      <div className="flex-1" />

      {locked ? (
        <div className="h-[44px] flex items-center justify-center border border-drip-elevated rounded-[2px] font-display text-[13px] text-txt-muted">
          Day ended
        </div>
      ) : (
        <KeyButton variant="amber" size="md" onClick={onEndDay} className="w-full">End day</KeyButton>
      )}
    </aside>
  );
}
