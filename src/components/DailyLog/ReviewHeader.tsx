import { useState, type CSSProperties } from 'react';
import CalendarPopover from './CalendarPopover';
import { dateLabel, formatMinutesPadded, type DayStats } from './reviewLogic';

interface Props {
  /** Selected `YYYY-MM-DD`. */
  date: string;
  /** Today as `YYYY-MM-DD` (injected for tests). */
  today: string;
  onPrev: () => void;
  onNext: () => void;
  onSelectDate: (date: string) => void;
  onSync: () => void;
  isSyncing: boolean;
  stats: DayStats;
}

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties;

const ICON_KEY = 'w-[26px] h-[26px] flex items-center justify-center rounded-[2px] text-txt-muted hover:text-txt-primary hover:bg-focus/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * 52px Review header (mockup Review.dc.html:44-58): `Review` + `‹ Fri 25 Sep ›`
 * with the month popover on the date, a sync key, and the day stats on the right.
 */
export default function ReviewHeader({ date, today, onPrev, onNext, onSelectDate, onSync, isSyncing, stats }: Props) {
  const [showCalendar, setShowCalendar] = useState(false);
  const label = dateLabel(date, today);

  return (
    <header
      data-testid="review-header"
      className="h-[52px] shrink-0 px-7 flex items-center justify-between border-b border-drip-elevated"
      style={dragRegion}
    >
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[15px] font-medium text-txt-primary">Review</h1>
        <div className="flex items-center gap-0.5" style={noDrag}>
          <button type="button" aria-label="Previous day" onClick={onPrev} className={`${ICON_KEY} text-[14px]`}>‹</button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCalendar(v => !v)}
              aria-expanded={showCalendar}
              data-testid="review-date"
              className="h-[26px] px-2 rounded-[2px] font-display text-[13px] text-txt-secondary hover:text-txt-primary hover:bg-focus/5 transition-colors whitespace-nowrap"
            >
              {label.text}
              {label.isToday && <span className="text-txt-muted"> · Today</span>}
            </button>
            {showCalendar && (
              <CalendarPopover
                selectedDate={date}
                onSelectDate={(d) => { onSelectDate(d); setShowCalendar(false); }}
                onClose={() => setShowCalendar(false)}
              />
            )}
          </div>
          <button type="button" aria-label="Next day" onClick={onNext} className={`${ICON_KEY} text-[14px]`}>›</button>
          <button
            type="button"
            aria-label="Sync calendar"
            title={isSyncing ? 'Syncing calendar...' : 'Sync calendar'}
            onClick={(e) => { e.stopPropagation(); onSync(); }}
            disabled={isSyncing}
            className={`${ICON_KEY} ml-1`}
          >
            <svg
              width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className={isSyncing ? 'animate-spin' : ''}
              data-testid="sync-icon"
            >
              <path d="M13.5 8a5.5 5.5 0 01-9.6 3.7M2.5 8a5.5 5.5 0 019.6-3.7" />
              <path d="M12.5 1.5v3h-3M3.5 14.5v-3h3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-[18px] font-display text-[12px] text-txt-muted whitespace-nowrap" style={noDrag} data-testid="review-stats">
        <span><span className="font-mono text-txt-primary">{formatMinutesPadded(stats.trackedMinutes)}</span> tracked</span>
        <span><span className="font-mono text-txt-primary">{formatMinutesPadded(stats.billableMinutes)}</span> billable</span>
        {stats.markedCount > 0 && (
          <span><span className="font-mono text-focus">{stats.markedCount}</span> to log</span>
        )}
        {stats.breakMinutes > 0 && (
          <span><span className="font-mono text-break">{stats.breakMinutes}m</span> break</span>
        )}
        {stats.loggedCount > 0 && (
          <span><span className="font-mono text-break">{stats.loggedCount}</span> logged</span>
        )}
      </div>
    </header>
  );
}
