import type { WeeklySummary } from '../../types';

interface MetricsRowProps {
  currentWeek: WeeklySummary | null;
  previousWeek: WeeklySummary | null;
}

function MetricCard({ label, value, sub, color, delay }: {
  label: string;
  value: string;
  sub: string;
  color: string;
  delay: string;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-focus/20 bg-drip-surface/40 backdrop-blur-sm p-5 transition-all duration-300 hover:border-focus/30 hover:bg-focus/5"
    >
      {/* Subtle top accent line */}
      <div className={`absolute top-0 left-4 right-4 h-px ${color} opacity-30`} />

      <div className="text-[10px] uppercase tracking-[0.2em] text-txt-muted mb-3 font-display">{label}</div>
      <div className={`text-3xl font-mono font-bold tabular-nums ${color} metric-value-shimmer leading-none`}>
        {value}
      </div>
      <div className="text-[11px] text-txt-dim mt-2 font-display">{sub}</div>
    </div>
  );
}

export default function MetricsRow({ currentWeek, previousWeek }: MetricsRowProps) {
  const deepHours = currentWeek ? Math.round(currentWeek.deep_work_minutes / 60 * 10) / 10 : 0;
  const prevDeepHours = previousWeek ? Math.round(previousWeek.deep_work_minutes / 60 * 10) / 10 : 0;

  const trendDiff = deepHours - prevDeepHours;
  const trendPercent = prevDeepHours > 0 ? Math.round((trendDiff / prevDeepHours) * 100) : 0;

  const focusRate = currentWeek && currentWeek.sessions_started > 0
    ? Math.round((currentWeek.sessions_completed / currentWeek.sessions_started) * 100)
    : 0;

  const peakHour = currentWeek?.peak_hour;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <MetricCard
        label="Deep Work"
        value={`${deepHours}h`}
        sub="this week"
        color="text-focus"
        delay="0ms"
      />
      <MetricCard
        label="Trend"
        value={`${trendDiff >= 0 ? '+' : ''}${Math.round(trendDiff * 10) / 10}h`}
        sub={previousWeek ? `${trendPercent >= 0 ? '+' : ''}${trendPercent}% vs last week` : 'no prior week'}
        color={trendDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}
        delay="60ms"
      />
      <MetricCard
        label="Focus Rate"
        value={currentWeek ? `${focusRate}%` : '—'}
        sub={currentWeek ? `${currentWeek.sessions_completed} sessions done` : 'no data'}
        color="text-purple-400"
        delay="120ms"
      />
      <MetricCard
        label="Peak Window"
        value={peakHour !== null && peakHour !== undefined ? `${String(peakHour).padStart(2, '0')}:00` : '—'}
        sub={peakHour !== null && peakHour !== undefined ? `most productive hour` : 'not enough data'}
        color="text-amber-300"
        delay="180ms"
      />
    </div>
  );
}
