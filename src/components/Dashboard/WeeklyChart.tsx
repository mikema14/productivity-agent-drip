import { useState, useEffect } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';

interface WeekData {
  date: string;
  total: number;
  deepWork: number;
}

export default function WeeklyChart() {
  const logStore = useLogStore();
  const { preferences } = useTaskPreferencesStore();
  const [weekData, setWeekData] = useState<WeekData[]>([]);

  useEffect(() => {
    async function loadWeeklyData() {
      // Get tracked task IDs (= deep work tasks)
      const trackedTaskIds = Array.from(preferences.values())
        .filter(p => p.tracked)
        .map(p => p.taskId);

      // Fetch total work data
      const totalData = await logStore.getDashboardWeeklyAllData();

      // Fetch deep work data
      // If no tasks marked as tracked → ALL work = deep work (per spec)
      const deepData = trackedTaskIds.length > 0
        ? await logStore.getDashboardWeeklyData(trackedTaskIds)
        : totalData; // All work counts as deep work

      // Merge into single dataset
      const merged: WeekData[] = totalData.map((day, index) => ({
        date: day.date,
        total: day.minutes,
        deepWork: deepData[index]?.minutes || 0
      }));

      setWeekData(merged);
    }
    loadWeeklyData();
  }, [logStore, preferences]);

  const maxMinutes = Math.max(...weekData.map(d => d.total), 1);

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Weekly Focus</h2>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-300 rounded" />
          <span className="text-gray-600">Total Work</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-600 rounded" />
          <span className="text-gray-600">Deep Work</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 h-40">
        {weekData.map(({ date, total, deepWork }) => {
          const totalHeightPercent = total > 0 ? Math.max((total / maxMinutes) * 100, 5) : 0;
          const deepHeightPercent = deepWork > 0 ? Math.max((deepWork / maxMinutes) * 100, 5) : 0;
          const dateObj = new Date(date);
          const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

          return (
            <div key={date} className="flex-1 flex flex-col items-center">
              {/* Bar container */}
              <div className="flex-1 w-full flex items-end justify-center mb-1 relative">
                {/* Total work bar (background - light blue) */}
                <div
                  className={`w-full rounded-t absolute bottom-0 ${
                    total > 0 ? 'bg-blue-300' : 'bg-gray-200'
                  }`}
                  style={{ height: total > 0 ? `${totalHeightPercent}%` : '4px' }}
                />
                {/* Deep work bar (foreground - dark blue overlay) */}
                {deepWork > 0 && (
                  <div
                    className="w-full rounded-t absolute bottom-0 bg-blue-600 transition-all cursor-pointer hover:bg-blue-700"
                    style={{ height: `${deepHeightPercent}%` }}
                    title={`${date}\nTotal: ${total}m\nDeep Work: ${deepWork}m (${total > 0 ? Math.round((deepWork / total) * 100) : 0}%)`}
                  />
                )}
              </div>
              {/* Labels */}
              <span className="text-xs text-gray-600">{dayLabel}</span>
              <span className="text-xs text-gray-400">{Math.round(total)}m</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
