import KeyButton from '../Timer/KeyButton';
import { useWindowFocus } from '../../hooks/useWindowFocus';
import { formatMinutesPadded, type LogSummary } from './reviewLogic';

interface Props {
  summary: LogSummary;
  onLog: () => void;
  isLogging: boolean;
  /** A day load is in flight while the previous day's rows are shown. */
  busy?: boolean;
}

const NUMBER = 'font-mono text-[24px] wide:text-[30px] font-medium leading-none whitespace-nowrap';
const UNIT = 'text-[13px] wide:text-[15px] text-txt-secondary';

function Divider() {
  return <span aria-hidden className="w-px self-stretch bg-drip-elevated" />;
}

/**
 * The top of Review's main column (mockup Review.dc.html, R24): TO LOG ·
 * NEEDS A TASK · LOGGED, and the one primary key `Log N to Easy8 ↵`.
 * Below `wide:` the key wraps under the readouts, right-aligned.
 */
export default function LogSummaryBar({ summary, onLog, isLogging, busy = false }: Props) {
  const windowFocused = useWindowFocus();
  const n = summary.selected.count;
  const canLog = n > 0 && !isLogging && !busy;
  const label = isLogging ? 'Logging…' : n > 0 ? `Log ${n} to Easy8` : 'Log to Easy8';
  const title = n === 0 ? 'Mark entries to log' : isLogging ? 'Logging…' : busy ? 'Loading the day…' : undefined;

  return (
    <section
      aria-label="Log summary"
      data-testid="log-summary"
      className="shrink-0 flex flex-wrap items-center gap-x-5 wide:gap-x-8 gap-y-4 px-5 wide:px-6 py-5 border border-drip-border border-t-2 border-t-focus rounded-[2px]"
    >
      <div className="flex flex-col gap-1.5" data-testid="summary-to-log">
        <span className="now-label text-focus flex items-center gap-2">
          <span aria-hidden className="w-1.5 h-1.5 bg-focus shadow-led" />To log
        </span>
        <span className={NUMBER}>
          {summary.toLog.count} <span className={UNIT}>· {formatMinutesPadded(summary.toLog.minutes)}</span>
        </span>
      </div>
      <Divider />
      <div className="flex flex-col gap-1.5" data-testid="summary-needs-task">
        <span className="now-label text-txt-muted">Needs a task</span>
        <span className={`${NUMBER} ${summary.needsTask > 0 ? 'text-focus' : 'text-txt-muted'}`}>{summary.needsTask}</span>
      </div>
      <Divider />
      <div className="flex flex-col gap-1.5" data-testid="summary-logged">
        <span className="now-label text-txt-muted">Logged</span>
        <span className={NUMBER}>
          {summary.logged.count} <span className={UNIT}>· {formatMinutesPadded(summary.logged.minutes)}</span>
        </span>
      </div>
      <KeyButton
        variant="amber"
        size="md"
        onClick={onLog}
        disabled={!canLog}
        title={title}
        kbd={windowFocused && canLog ? '↵' : undefined}
        className="ml-auto whitespace-nowrap"
      >
        {label}
      </KeyButton>
    </section>
  );
}
