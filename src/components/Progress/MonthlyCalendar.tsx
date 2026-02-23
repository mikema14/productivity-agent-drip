interface DayData {
  date: string;
  minutes: number;
  deepMinutes: number;
}

interface MonthlyCalendarProps {
  year: number;
  month: number;
  dailyMinutes: DayData[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getIntensityStyle(minutes: number): { bg: string; text: string } {
  if (minutes >= 480) return { bg: 'bg-focus/70', text: 'text-drip-bg' };
  if (minutes >= 240) return { bg: 'bg-focus/45', text: 'text-txt-primary' };
  if (minutes >= 60)  return { bg: 'bg-focus/25', text: 'text-txt-primary' };
  if (minutes >= 1)   return { bg: 'bg-focus/10', text: 'text-txt-secondary' };
  return { bg: 'bg-white/[0.02]', text: 'text-txt-dim' };
}

function formatHours(minutes: number): string {
  if (minutes === 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function MonthlyCalendar({ year, month, dailyMinutes, onPrevMonth, onNextMonth }: MonthlyCalendarProps) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const cells: Array<{ day: number | null; data: DayData | null }> = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, data: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = dailyMinutes.find(d => new Date(d.date).getDate() === day);
    cells.push({ day, data: dayData || null });
  }

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const canGoNext = !isCurrentMonth;

  // Monthly summary
  const totalMinutes = dailyMinutes.reduce((s, d) => s + d.minutes, 0);
  const deepMinutes = dailyMinutes.reduce((s, d) => s + d.deepMinutes, 0);
  const deepPct = totalMinutes > 0 ? Math.round((deepMinutes / totalMinutes) * 100) : 0;

  return (
    <div className="glass-surface p-6 h-full flex flex-col">
      {/* Header with month nav */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={onPrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-glass-hover transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 3L5 7L9 11" />
          </svg>
        </button>

        <div className="text-center">
          <h2 className="text-xl font-display font-semibold text-txt-primary tracking-tight">
            {MONTH_NAMES[month - 1]}
          </h2>
          <span className="text-xs text-txt-dim font-mono">{year}</span>
        </div>

        <button
          onClick={onNextMonth}
          disabled={!canGoNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-glass-hover transition-all disabled:opacity-20 disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 3L9 7L5 11" />
          </svg>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[10px] text-txt-dim font-mono uppercase tracking-wider py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5 flex-1">
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={`e-${i}`} />;
          }

          const minutes = cell.data?.minutes || 0;
          const deepMin = cell.data?.deepMinutes || 0;
          const style = getIntensityStyle(minutes);
          const isToday = isCurrentMonth && cell.day === now.getDate();

          return (
            <div
              key={cell.day}
              className={`cal-cell relative rounded-xl ${style.bg} flex flex-col items-center justify-center aspect-square cursor-default
                ${isToday ? 'ring-1 ring-focus ring-offset-1 ring-offset-drip-bg' : ''}
              `}
              title={`${cell.data?.date || ''}\nTotal: ${formatHours(minutes)}\nDeep: ${formatHours(deepMin)}`}
            >
              <span className={`text-xs font-mono leading-none ${style.text}`}>
                {cell.day}
              </span>
              {minutes > 0 && (
                <span className="text-[9px] font-mono text-txt-muted mt-0.5 leading-none">
                  {formatHours(minutes)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: summary + legend */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-glass-border">
        <div className="flex items-center gap-4">
          <div className="text-xs text-txt-muted">
            <span className="font-mono text-txt-secondary">{formatHours(totalMinutes) || '0m'}</span> total
          </div>
          <div className="text-xs text-txt-muted">
            <span className="font-mono text-focus">{deepPct}%</span> deep
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-txt-dim">
          <span>less</span>
          {[
            'bg-white/[0.02]',
            'bg-focus/10',
            'bg-focus/25',
            'bg-focus/45',
            'bg-focus/70',
          ].map((cls, i) => (
            <div key={i} className={`w-3 h-3 rounded ${cls}`} />
          ))}
          <span>more</span>
        </div>
      </div>
    </div>
  );
}
