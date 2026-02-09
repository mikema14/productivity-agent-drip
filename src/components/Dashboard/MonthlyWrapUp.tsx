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
        <div className="text-gray-500">Loading monthly summary...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No data available for this month</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monthly Wrap-Up</h1>
          <p className="text-gray-600 mt-2">
            Reflect on your progress without pressure
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={exportJSON}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Export JSON
          </button>
          <button
            onClick={exportCSV}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Month/Year Picker */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthNames.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total Work</div>
          <div className="text-3xl font-bold text-gray-900">{formatHours(stats.totalMinutes)}</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Deep Work</div>
          <div className="text-3xl font-bold text-blue-600">
            {formatHours(stats.deepWorkMinutes)}
            {stats.totalMinutes > 0 && (
              <span className="text-sm font-normal text-gray-600 ml-2">
                ({Math.round((stats.deepWorkMinutes / stats.totalMinutes) * 100)}%)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Best Streak</div>
          <div className="text-3xl font-bold text-green-600">
            {stats.bestDayStreak} {stats.bestDayStreak === 1 ? 'day' : 'days'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Days Worked</div>
          <div className="text-3xl font-bold text-purple-600">
            {stats.daysWorked} / {stats.dailyMinutes.length}
          </div>
        </div>
      </div>

      {/* Reflections */}
      {stats.reflections && stats.reflections.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Reflections</h2>
          <div className="space-y-4">
            {stats.reflections.map((r: { date: string; reflection: string }) => (
              <div key={r.date} className="border-l-4 border-blue-500 pl-4">
                <div className="text-sm text-gray-600 font-medium mb-1">
                  {new Date(r.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-gray-700">{r.reflection}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Breakdown */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Daily Breakdown</h2>
        <div className="grid grid-cols-7 gap-2">
          {stats.dailyMinutes.map((day: { date: string; minutes: number }) => {
            const dayNum = new Date(day.date).getDate();
            const intensity = day.minutes >= 480 ? 4 : day.minutes >= 240 ? 3 : day.minutes >= 60 ? 2 : day.minutes >= 1 ? 1 : 0;
            const colors = ['bg-gray-100', 'bg-blue-100', 'bg-blue-300', 'bg-blue-500', 'bg-blue-700'];

            return (
              <div
                key={day.date}
                className={`aspect-square rounded flex flex-col items-center justify-center ${colors[intensity]} text-gray-800 text-sm font-medium`}
                title={`${day.date}: ${formatHours(day.minutes)}`}
              >
                <div className="text-xs">{dayNum}</div>
                {day.minutes > 0 && <div className="text-xs opacity-70">{Math.round(day.minutes / 60)}h</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-100 rounded"></div>
            <span>0h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 rounded"></div>
            <span>1-4h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-300 rounded"></div>
            <span>4-8h</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-700 rounded"></div>
            <span>8h+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
