import type { CalendarProposal, ListItem, TaskList } from '../../types';
import KeyButton from '../Timer/KeyButton';
import { effectiveTaskId } from '../Plan/boardLogic';
import TodaysThree from './TodaysThree';
import { formatMinutesPadded, tomorrowCalendar, tomorrowLabel } from './reviewLogic';

export interface CloseDayAsideProps {
  /** Selected `YYYY-MM-DD`; `Tomorrow` is its next workday (R4). */
  date: string;
  /**
   * Whether `date` is today. Plan's Today column is not date-specific, so the
   * Today triage and `Starts with` render only for today's review.
   */
  isToday: boolean;
  /** Today-column items; the first open one is what tomorrow starts with. */
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
 * The Review aside (mockup Review.dc.html, R33): `Close the day · Optional`.
 * Today's triage, one line on tomorrow, the reflection draft that seeds
 * EndDayModal (R3) and a secondary `End day` / `Day ended` (R15). Nothing here
 * gates logging, and logging never needs End day.
 */
export default function CloseDayAside(props: CloseDayAsideProps) {
  const { date, isToday, todayItems, lists, proposals, reflection, onReflectionChange, locked, savedReflection, onEndDay } = props;
  const first = todayItems.filter(i => !i.completed && !i.archived).sort((a, b) => a.order - b.order)[0];
  const firstId = first ? effectiveTaskId(first, lists.find(l => l.id === first.list_id)) : null;
  const calendar = proposals ? tomorrowCalendar(proposals) : null;

  return (
    <aside
      aria-label="Close the day"
      className="w-[280px] wide:w-[300px] shrink-0 px-5 py-6 border-l border-drip-elevated flex flex-col gap-3 overflow-y-auto"
    >
      <div className="flex items-center gap-2.5 now-label text-txt-muted">
        <h2 className="now-label">Close the day</h2>
        <span aria-hidden className="flex-1 border-t border-drip-elevated" />
        Optional
      </div>

      {isToday && <TodaysThree />}

      <div className="flex flex-col gap-1.5 mt-2.5">
        <span className="now-label text-txt-muted">
          Tomorrow · <span data-testid="tomorrow-date">{tomorrowLabel(date)}</span>
        </span>
        <p data-testid="tomorrow-line" className="font-display text-[13px] text-txt-secondary">
          {isToday && (
            <span data-testid="tomorrow-start">
              {first ? (
                <>Starts with {firstId ? <span className="font-mono text-focus">{firstId}</span> : <span title={first.title}>{first.title}</span>}</>
              ) : 'Starts empty'}
              {' · '}
            </span>
          )}
          <span data-testid="tomorrow-calendar">
            {calendar ? (
              <>
                {calendar.meetings} {calendar.meetings === 1 ? 'meeting' : 'meetings'} · <span className="font-mono text-txt-primary">{formatMinutesPadded(calendar.freeMinutes)}</span> free
              </>
            ) : 'Calendar unavailable'}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5 mt-2.5">
        <label htmlFor="review-reflection" className="now-label text-txt-muted">One line on today</label>
        {locked ? (
          <p data-testid="saved-reflection" className="font-display text-[13.5px] text-txt-secondary whitespace-pre-wrap min-h-[40px]">
            {savedReflection || <span className="text-txt-dim">No reflection saved</span>}
          </p>
        ) : (
          <textarea
            id="review-reflection"
            rows={2}
            value={reflection}
            onChange={e => onReflectionChange(e.target.value)}
            placeholder="What moved, what got in the way"
            className="resize-none px-2.5 py-2 font-display text-[13.5px] bg-transparent border border-drip-border rounded-[2px] text-txt-primary placeholder-txt-dim focus:outline-none focus:border-focus/40"
          />
        )}
      </div>

      <div className="flex-1" />

      {locked ? (
        <div className="h-[44px] shrink-0 flex items-center justify-center border border-drip-elevated rounded-[2px] font-display text-[13px] text-txt-muted">
          Day ended
        </div>
      ) : (
        <KeyButton variant="outline" size="md" onClick={onEndDay} className="w-full shrink-0">End day</KeyButton>
      )}
    </aside>
  );
}
