import { useState, useEffect } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';

export default function MonthlyWrapUp() {
  const logStore = useLogStore();
  const { preferences } = useTaskPreferencesStore();

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-indexed
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadMonthlyStats();
  }, [selectedYear, selectedMonth]);

  async function loadMonthlyStats() {
    setIsLoading(true);
    try {
      // Get tracked task IDs for deep work calculation
      const trackedTaskIds = Array.from(preferences.values())
        .filter(p => p.tracked)
        .map(p => p.taskId);

      // Note: getMonthlyStats already handles the "no tracked tasks → all work = deep work" logic internally
      const monthlyStats = await logStore.getMonthlyStats(selectedYear, selectedMonth, trackedTaskIds);
      setStats(monthlyStats);
    } catch (error) {
      console.error('Failed to load monthly stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  const exportJSON = () => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-wrapup-${selectedYear}-${selectedMonth.toString().padStart(2, '0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!stats) return;

    // CSV header
    let csv = 'Date,Total Minutes,Deep Work Minutes\n';

    // Daily data
    stats.dailyMinutes.forEach((day: { date: string; minutes: number }) => {
      const deepWork = stats.dailyMinutes
        .filter((d: any) => d.date === day.date)
        .reduce((sum: number, d: any) => sum + (d.deepWorkMinutes || 0), 0);
      csv += `${day.date},${day.minutes},${deepWork}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-wrapup-${selectedYear}-${selectedMonth.toString().padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-txt-muted">Loading monthly summary...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-txt-muted">No data available for this month</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-txt-primary">Monthly Wrap-Up</h1>
          <p className="text-txt-secondary mt-2">
            Reflect on your progress without pressure
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={exportJSON}
            className="glass-button px-4 py-2 text-sm font-medium text-txt-secondary"
          >
            Export JSON
          </button>
          <button
            onClick={exportCSV}
            className="glass-button px-4 py-2 text-sm font-medium text-txt-secondary"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Month/Year Picker */}
      <div className="glass-surface p-6">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
            >
              {monthNames.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-surface p-6">
          <div className="text-sm text-txt-muted mb-1">Total Work</div>
          <div className="text-3xl font-mono font-semibold text-txt-primary">{formatHours(stats.totalMinutes)}</div>
        </div>

        <div className="glass-surface p-6">
          <div className="text-sm text-txt-muted mb-1">Deep Work</div>
          <div className="text-3xl font-mono font-semibold text-focus">
            {formatHours(stats.deepWorkMinutes)}
            {stats.totalMinutes > 0 && (
              <span className="text-sm font-normal text-txt-muted ml-2">
                ({Math.round((stats.deepWorkMinutes / stats.totalMinutes) * 100)}%)
              </span>
            )}
          </div>
        </div>

        <div className="glass-surface p-6">
          <div className="text-sm text-txt-muted mb-1">Best Streak</div>
          <div className="text-3xl font-mono font-semibold text-emerald-400">
            {stats.bestDayStreak} {stats.bestDayStreak === 1 ? 'day' : 'days'}
          </div>
        </div>

        <div className="glass-surface p-6">
          <div className="text-sm text-txt-muted mb-1">Days Worked</div>
          <div className="text-3xl font-mono font-semibold text-purple-400">
            {stats.daysWorked} / {stats.dailyMinutes.length}
          </div>
        </div>
      </div>

      {/* Reflections */}
      {stats.reflections && stats.reflections.length > 0 && (
        <div className="glass-surface p-6">
          <h2 className="text-xl font-display font-semibold text-txt-primary mb-4">Reflections</h2>
          <div className="space-y-4">
            {stats.reflections.map((r: { date: string; reflection: string }) => (
              <div key={r.date} className="border-l-2 border-focus/50 pl-4">
                <div className="text-sm text-txt-muted font-medium mb-1">
                  {new Date(r.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-txt-secondary">{r.reflection}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Breakdown */}
      <div className="glass-surface p-6">
        <h2 className="text-xl font-display font-semibold text-txt-primary mb-4">Daily Breakdown</h2>
        <div className="grid grid-cols-7 gap-2">
          {stats.dailyMinutes.map((day: { date: string; minutes: number }) => {
            const dayNum = new Date(day.date).getDate();
            const intensity = day.minutes >= 480 ? 4 : day.minutes >= 240 ? 3 : day.minutes >= 60 ? 2 : day.minutes >= 1 ? 1 : 0;
            const colors = ['bg-glass-bg', 'bg-focus/10', 'bg-focus/20', 'bg-focus/40', 'bg-focus/60'];

            return (
              <div
                key={day.date}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center ${colors[intensity]} text-txt-primary text-sm font-medium`}
                title={`${day.date}: ${formatHours(day.minutes)}`}
              >
                <div className="text-xs">{dayNum}</div>
                {day.minutes > 0 && <div className="text-xs opacity-70">{Math.round(day.minutes / 60)}h</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-txt-muted">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-glass-bg rounded"></div>
            <span>0h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-focus/10 rounded"></div>
            <span>1-4h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-focus/20 rounded"></div>
            <span>4-8h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-focus/60 rounded"></div>
            <span>8h+</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
