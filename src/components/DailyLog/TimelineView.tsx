import { useEffect, useRef, useMemo, useState } from 'react';
import { useTimerStore } from '../../stores/timerStore';
import { useLogStore } from '../../stores/logStore';
import type { LogEntry } from '../../stores/logStore';

interface TimelineViewProps {
  entries: LogEntry[];
}

const HOUR_HEIGHT = 80;

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function TimelineView({ entries }: TimelineViewProps) {
  const { status, sessionStartTime, currentTaskId, intention, remainingSeconds } = useTimerStore();
  const { selectedDate } = useLogStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const isToday = useMemo(() => isSameDay(selectedDateObj, new Date()), [selectedDateObj]);

  // Update current time — faster during active session
  useEffect(() => {
    const intervalMs = (status === 'focus' || status === 'break') ? 10000 : 60000;
    const interval = setInterval(() => setCurrentTime(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [status]);

  // Split entries into scheduled and unscheduled
  const scheduledEntries = useMemo(() => entries.filter(e => e.startTime), [entries]);
  const unscheduledEntries = useMemo(() => entries.filter(e => !e.startTime), [entries]);

  // Dynamic hour range
  const { startHour, endHour } = useMemo(() => {
    let minHour = 8;
    let maxHour = 20;

    scheduledEntries.forEach(e => {
      const start = new Date(e.startTime!);
      const h = start.getHours();
      if (h < minHour) minHour = h;
      const endH = h + Math.ceil(e.durationMinutes / 60);
      if (endH > maxHour) maxHour = endH;
    });

    if (isToday) {
      const nowH = new Date().getHours();
      if (nowH < minHour) minHour = nowH;
      if (nowH + 1 > maxHour) maxHour = nowH + 2;
    }

    return {
      startHour: Math.max(0, minHour - 1),
      endHour: Math.min(24, maxHour + 1),
    };
  }, [scheduledEntries, isToday]);

  const totalHours = endHour - startHour;

  // Position helpers
  const getTop = (date: Date) => {
    const h = date.getHours() + date.getMinutes() / 60;
    return (h - startHour) * HOUR_HEIGHT;
  };

  const getHeight = (minutes: number) => {
    return (minutes / 60) * HOUR_HEIGHT;
  };

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (timelineRef.current && isToday) {
      const now = new Date();
      const nowOffset = (now.getHours() - startHour + now.getMinutes() / 60) * HOUR_HEIGHT;
      timelineRef.current.scrollTop = Math.max(0, nowOffset - 200);
    }
  }, [startHour, isToday]);

  const currentTimeTop = getTop(currentTime);

  // Block styling based on entry type/source
  const getBlockClasses = (entry: LogEntry) => {
    const isBreak = entry.source === 'break';
    if (isBreak) return 'bg-emerald-500/15 border-emerald-500/30';
    if (entry.type === 'calendar') {
      if (entry.isProposal) return 'bg-blue-500/5 border-blue-500/15 border-dashed';
      return 'bg-blue-500/15 border-blue-500/30';
    }
    if (entry.logged) return 'bg-focus/15 border-focus/30';
    return 'bg-focus/10 border-focus/20';
  };

  // Text color for duration label
  const getDurationColor = (entry: LogEntry) => {
    if (entry.source === 'break') return 'text-emerald-400';
    if (entry.type === 'calendar') return 'text-blue-400';
    return 'text-focus';
  };

  return (
    <div className="flex flex-col h-full">
      {/* HOUR TIMELINE */}
      <div ref={timelineRef} className="flex-1 overflow-y-auto relative">
        <div className="relative" style={{ height: totalHours * HOUR_HEIGHT }}>
          {/* Hour labels + dashed lines */}
          {Array.from({ length: totalHours + 1 }, (_, i) => {
            const hour = startHour + i;
            const top = i * HOUR_HEIGHT;
            return (
              <div key={hour} className="absolute left-0 right-0" style={{ top }}>
                <div className="flex items-start">
                  <span className="w-12 text-right pr-2 text-xs text-txt-dim font-mono -mt-2">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                  <div className="flex-1 border-t border-dashed border-glass-border" />
                </div>
              </div>
            );
          })}

          {/* Scheduled entry blocks */}
          {scheduledEntries.map((entry) => {
            const start = new Date(entry.startTime!);
            const top = getTop(start);
            const height = Math.max(getHeight(entry.durationMinutes), 20);
            const isBreak = entry.source === 'break';

            return (
              <div
                key={entry.id}
                className={`absolute left-14 right-4 rounded-lg border transition-colors overflow-hidden ${getBlockClasses(entry)}`}
                style={{ top, height }}
              >
                <div className="px-2 py-1 flex items-center gap-2 h-full">
                  <span className={`text-xs font-mono font-medium truncate ${getDurationColor(entry)}`}>
                    {entry.durationMinutes}m
                  </span>
                  {isBreak && (
                    <span className="text-xs text-emerald-400/70">Break</span>
                  )}
                  {!isBreak && entry.taskId && (
                    <span className="text-xs font-mono text-txt-muted">#{entry.taskId}</span>
                  )}
                  {!isBreak && entry.type === 'calendar' && (
                    <span className="text-xs text-blue-400/70 truncate">{entry.title}</span>
                  )}
                  {!isBreak && entry.type !== 'calendar' && entry.comment && height > 30 && (
                    <span className="text-xs text-txt-dim truncate">{entry.comment}</span>
                  )}
                  {!isBreak && entry.logged && (
                    <span className="text-xs text-focus ml-auto">&#10003;</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Active session hatched block */}
          {status === 'focus' && isToday && sessionStartTime && (() => {
            const startDate = new Date(sessionStartTime);
            const totalDurationMin = Math.ceil((Date.now() - startDate.getTime()) / 60000 + remainingSeconds / 60);
            const top = getTop(startDate);
            const height = Math.max(getHeight(totalDurationMin), 24);
            const elapsedMin = Math.floor((Date.now() - startDate.getTime()) / 60000);

            return (
              <div
                className="absolute left-14 right-4 rounded-lg border border-focus/40 hatched-pattern bg-focus/5 overflow-hidden"
                style={{ top: Math.max(0, top), height }}
              >
                <div className="px-2 py-1 flex items-center gap-2 h-full">
                  <span className="text-xs font-mono text-focus font-medium">
                    {elapsedMin}m
                  </span>
                  {currentTaskId && (
                    <span className="text-xs font-mono text-txt-muted">#{currentTaskId}</span>
                  )}
                  {intention && height > 30 && (
                    <span className="text-xs text-txt-dim truncate">{intention}</span>
                  )}
                  <span className="text-xs text-focus/60 ml-auto font-mono animate-pulse-subtle">
                    In progress...
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Active break hatched block */}
          {status === 'break' && isToday && sessionStartTime && (() => {
            const startDate = new Date(sessionStartTime);
            const totalDurationMin = Math.ceil((Date.now() - startDate.getTime()) / 60000 + remainingSeconds / 60);
            const top = getTop(startDate);
            const height = Math.max(getHeight(totalDurationMin), 24);
            const elapsedMin = Math.floor((Date.now() - startDate.getTime()) / 60000);

            return (
              <div
                className="absolute left-14 right-4 rounded-lg border border-emerald-500/40 hatched-pattern-break bg-emerald-500/5 overflow-hidden"
                style={{ top: Math.max(0, top), height }}
              >
                <div className="px-2 py-1 flex items-center gap-2 h-full">
                  <span className="text-xs font-mono text-emerald-400 font-medium">{elapsedMin}m</span>
                  <span className="text-xs text-emerald-400/70">Break</span>
                  <span className="text-xs text-emerald-400/60 ml-auto font-mono animate-pulse-subtle">
                    On break...
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Current time red line */}
          {isToday && currentTimeTop >= 0 && currentTimeTop <= totalHours * HOUR_HEIGHT && (
            <div className="absolute left-12 right-0" style={{ top: currentTimeTop }}>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                <div className="flex-1 border-t-2 border-red-500/70" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unscheduled entries */}
      {unscheduledEntries.length > 0 && (
        <div className="flex-none border-t border-glass-border p-4">
          <h3 className="text-sm font-semibold text-txt-secondary mb-2">
            Unscheduled
          </h3>
          <div className="space-y-2">
            {unscheduledEntries.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-lg border px-2 py-1.5 text-xs ${getBlockClasses(entry)}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-medium ${getDurationColor(entry)}`}>
                    {entry.durationMinutes}m
                  </span>
                  {entry.taskId && (
                    <span className="font-mono text-txt-muted">#{entry.taskId}</span>
                  )}
                  <span className="text-txt-primary truncate">{entry.title}</span>
                  {entry.logged && (
                    <span className="text-focus ml-auto">&#10003;</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
