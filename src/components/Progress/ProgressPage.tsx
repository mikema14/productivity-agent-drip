import { useState, useEffect } from 'react';
import { useLogStore } from '../../stores/logStore';
import type { WeeklySummary } from '../../types';
import MetricsRow from './MetricsRow';
import MonthlyCalendar from './MonthlyCalendar';
import AIInsightsPanel from './AIInsightsPanel';
import ReflectionsSection from './ReflectionsSection';
import GoalProgressSection from './GoalProgressSection';

interface MonthlyStats {
  year: number;
  month: number;
  totalMinutes: number;
  deepWorkMinutes: number;
  daysWorked: number;
  dailyMinutes: Array<{ date: string; minutes: number; deepMinutes: number }>;
  reflections: Array<{ date: string; reflection: string; notes: string | null }>;
}

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

export default function ProgressPage() {
  const logStore = useLogStore() as any;

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [currentWeek, setCurrentWeek] = useState<WeeklySummary | null>(null);
  const [previousWeek, setPreviousWeek] = useState<WeeklySummary | null>(null);
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
  const [timeOfDay, setTimeOfDay] = useState<Array<{ hour: number; minutes: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth]);

  async function loadData() {
    setIsLoading(true);
    try {
      const stats = await logStore.getMonthlyStats(selectedYear, selectedMonth);
      setMonthlyStats(stats as MonthlyStats | null);

      const thisMonday = getMonday(new Date());
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastMondayStr = lastMonday.toISOString().split('T')[0];

      try {
        await window.dashboardAPI.computeWeeklySummary(thisMonday);
      } catch { /* no data yet */ }

      const [currentWeekData, previousWeekData] = await Promise.all([
        window.dashboardAPI.getWeeklySummary(thisMonday),
        window.dashboardAPI.getWeeklySummary(lastMondayStr),
      ]);
      setCurrentWeek(currentWeekData);
      setPreviousWeek(previousWeekData);

      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
      const summaries = await window.dashboardAPI.getWeeklySummariesInRange(
        getMonday(eightWeeksAgo),
        thisMonday
      );
      setWeeklySummaries(summaries || []);

      const monthStart = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const monthEnd = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
      const todData = await window.dashboardAPI.getSessionsByTimeOfDay(monthStart, monthEnd);
      setTimeOfDay(todData || []);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrevMonth() {
    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  }

  function handleNextMonth() {
    const now = new Date();
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;
    if (isCurrentMonth) return;

    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  }

  const period = `${['January','February','March','April','May','June','July','August','September','October','November','December'][selectedMonth - 1]} ${selectedYear}`;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-focus/20 border-t-focus rounded-full animate-spin" />
          <span className="text-txt-dim text-xs uppercase tracking-widest">Loading</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Page header — editorial style */}
        <div className="progress-stagger progress-stagger-1 mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl font-display font-bold text-txt-primary tracking-tight">Progress</h1>
            <div className="h-px flex-1 bg-gradient-to-r from-glass-border to-transparent" />
          </div>
          <p className="text-txt-dim text-sm mt-1 font-display">Consistency over intensity</p>
        </div>

        {/* Metrics — full width */}
        <div className="progress-stagger progress-stagger-2 mb-8">
          <MetricsRow currentWeek={currentWeek} previousWeek={previousWeek} />
        </div>

        {/* Two-column: Calendar + AI side by side on large screens */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 mb-8">
          <div className="progress-stagger progress-stagger-3">
            <MonthlyCalendar
              year={selectedYear}
              month={selectedMonth}
              dailyMinutes={monthlyStats?.dailyMinutes || []}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
            />
          </div>

          <div className="progress-stagger progress-stagger-4">
            <AIInsightsPanel
              weeklySummaries={weeklySummaries}
              reflections={monthlyStats?.reflections || []}
              monthlyStats={monthlyStats ? {
                totalMinutes: monthlyStats.totalMinutes,
                deepWorkMinutes: monthlyStats.deepWorkMinutes,
                daysWorked: monthlyStats.daysWorked,
                dailyMinutes: monthlyStats.dailyMinutes,
              } : null}
              timeOfDay={timeOfDay}
              period={period}
            />
          </div>
        </div>

        {/* Bottom section: Reflections + Goals side by side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="progress-stagger progress-stagger-5">
            <ReflectionsSection reflections={monthlyStats?.reflections || []} />
          </div>
          <div className="progress-stagger progress-stagger-5">
            <GoalProgressSection />
          </div>
        </div>
      </div>
    </div>
  );
}
