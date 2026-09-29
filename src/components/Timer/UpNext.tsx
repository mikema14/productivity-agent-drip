import { formatMinutesPadded } from '../Plan/boardLogic';
import type { UpNextRow } from './nowLogic';

interface Props {
  rows: UpNextRow[];
  /** Focus minutes per task today (the row's time column; omitted when 0). */
  trackedMinutes: Record<string, number>;
  /** Ends the running session and starts focus on this task (Q17). */
  onSwitch: (taskId: string, title: string) => void;
  onOpenPlan: () => void;
}

/** Under the running card: the next two of Plan's Today items. The rest of the column stays empty. */
export default function UpNext({ rows, trackedMinutes, onSwitch, onOpenPlan }: Props) {
  return (
    <section aria-label="Up next" className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5 px-0.5 pb-1 now-label text-txt-muted">
        <h2 className="m-0 text-[10.5px] font-medium">Up next</h2>
        <span aria-hidden className="flex-1 border-t border-drip-elevated" />
        <button type="button" onClick={onOpenPlan} className="now-label text-focus hover:text-focus-light transition-colors">
          All today →
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-0.5 font-display text-[13px] text-txt-muted">Nothing else on Today</p>
      ) : (
        rows.map(row => {
          const minutes = row.taskId ? trackedMinutes[row.taskId] ?? 0 : 0;
          return (
            <button
              key={row.itemId}
              type="button"
              data-testid="up-next-row"
              disabled={!row.taskId}
              title={row.taskId ? `Finish this session and start ${row.taskId}` : 'No Easy8 task — set one in Plan'}
              onClick={() => row.taskId && onSwitch(row.taskId, row.title)}
              className="flex items-center gap-3.5 h-[42px] px-3.5 border border-drip-elevated rounded-[2px] text-left transition-colors hover:border-drip-border hover:bg-focus/5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-drip-elevated"
            >
              <span className="font-mono text-[10.5px] text-txt-muted">{row.index.toString().padStart(2, '0')}</span>
              {row.taskId && <span className="font-mono text-[12px] text-focus">{row.taskId}</span>}
              <span className="flex-1 min-w-0 font-display text-[14px] text-txt-primary truncate">{row.title}</span>
              {minutes > 0 && <span className="font-mono text-[11.5px] text-txt-secondary">{formatMinutesPadded(minutes)}</span>}
            </button>
          );
        })
      )}
    </section>
  );
}
