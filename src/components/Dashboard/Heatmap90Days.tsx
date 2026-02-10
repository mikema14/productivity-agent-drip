import { useState, useEffect } from 'react';
import { useLogStore } from '../../stores/logStore';
import { useTaskPreferencesStore } from '../../stores/taskPreferencesStore';

interface DayData {
  date: string;
  minutes: number;
  intensity: number;
}

export default function Heatmap90Days() {
  const logStore = useLogStore();
  const { preferences } = useTaskPreferencesStore();
  const [heatmapData, setHeatmapData] = useState<DayData[]>([]);

  useEffect(() => {
    async function loadHeatmapData() {
      // Get tracked task IDs
      const trackedTaskIds = Array.from(preferences.values())
        .filter(p => p.tracked)
        .map(p => p.taskId);

      const rawData = await logStore.getDashboard90DaysData(trackedTaskIds);

      // Map to DayData with intensity
      const data: DayData[] = rawData.map((day: { date: string; minutes: number }) => {
        // Intensity scale based on HOURS (spec requirements):
        // 0h → 0, 1-4h → 1, 4-8h → 2, 8h+ → 3/4
        let intensity = 0;
        if (day.minutes >= 480) intensity = 4;      // 8h+ (480+ min)
        else if (day.minutes >= 240) intensity = 3; // 4-8h (240-480 min)
        else if (day.minutes >= 60) intensity = 2;  // 1-4h (60-240 min)
        else if (day.minutes >= 1) intensity = 1;   // <1h (1-60 min)

        return { date: day.date, minutes: day.minutes, intensity };
      });

      setHeatmapData(data);
    }
    loadHeatmapData();
  }, [logStore, preferences]);

  const getIntensityColor = (intensity: number): string => {
    switch (intensity) {
      case 0: return 'bg-glass-bg';
      case 1: return 'bg-focus/20';
      case 2: return 'bg-focus/40';
      case 3: return 'bg-focus/60';
      case 4: return 'bg-focus/80';
      default: return 'bg-glass-bg';
    }
  };

  return (
    <div className="glass-surface p-6">
      <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">90-Day Consistency</h2>

      <div className="grid grid-cols-15 gap-1">
        {heatmapData.map(({ date, minutes, intensity }) => (
          <div
            key={date}
            className={`w-3 h-3 rounded-sm ${getIntensityColor(intensity)} hover:ring-2 hover:ring-focus cursor-pointer transition-all`}
            title={`${date}: ${minutes} min`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 text-xs text-txt-muted">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 bg-glass-bg rounded-sm" />
          <div className="w-3 h-3 bg-focus/20 rounded-sm" />
          <div className="w-3 h-3 bg-focus/40 rounded-sm" />
          <div className="w-3 h-3 bg-focus/60 rounded-sm" />
          <div className="w-3 h-3 bg-focus/80 rounded-sm" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
