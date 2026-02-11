import { useState, useEffect, useRef, useMemo } from 'react';
import { useTimerStore } from '../../stores/timerStore';
import AddEntryModal from '../DailyLog/AddEntryModal';
import type { PomodoroSession, CalendarProposal } from '../../types';

interface TimerDayTimelineProps {
  sessions: PomodoroSession[];
  calendarProposals?: CalendarProposal[];
  onRefresh: () => void;
}

const HOUR_HEIGHT = 80;

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function TimerDayTimeline({ sessions, calendarProposals, onRefresh }: TimerDayTimelineProps) {
  const { status, sessionStartTime, currentTaskId, intention, remainingSeconds } = useTimerStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Update current time - faster during active session for elapsed counter
  useEffect(() => {
    const intervalMs = (status === 'focus' || status === 'break') ? 10000 : 60000;
    const interval = setInterval(() => setCurrentTime(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [status]);

  // Compute week dates (Monday-based)
  const weekDates = useMemo(() => {
    const monday = getMonday(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  // Filter sessions for selected date
  const dateSessions = useMemo(() => {
    const dateStr = toDateStr(selectedDate);
    return sessions.filter(s => {
      const sDate = s.start_at.split('T')[0];
      return sDate === dateStr;
    });
  }, [sessions, selectedDate]);

  // Filter calendar proposals for selected date
  const dateProposals = useMemo(() => {
    const dateStr = toDateStr(selectedDate);
    return (calendarProposals || []).filter(p => p.date === dateStr && p.dismissed !== 1);
  }, [calendarProposals, selectedDate]);

  // Compute dynamic start/end hours
  const { startHour, endHour } = useMemo(() => {
    let minHour = 8;
    let maxHour = 20;

    dateSessions.forEach(s => {
      const start = new Date(s.start_at);
      const h = start.getHours();
      if (h < minHour) minHour = h;
      const endH = s.end_at ? new Date(s.end_at).getHours() + 1 : h + 1;
      if (endH > maxHour) maxHour = endH;
    });

    dateProposals.forEach(p => {
      const start = new Date(p.start_at);
      const h = start.getHours();
      if (h < minHour) minHour = h;
      const end = new Date(p.end_at);
      const endH = end.getHours() + 1;
      if (endH > maxHour) maxHour = endH;
    });

    const now = new Date();
    if (isSameDay(selectedDate, now)) {
      const nowH = now.getHours();
      if (nowH < minHour) minHour = nowH;
      if (nowH + 1 > maxHour) maxHour = nowH + 2;
    }

    return {
      startHour: Math.max(0, minHour - 1),
      endHour: Math.min(24, maxHour + 1),
    };
  }, [dateSessions, dateProposals, selectedDate]);

  const totalHours = endHour - startHour;

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (timelineRef.current && isSameDay(selectedDate, new Date())) {
      const now = new Date();
      const nowOffset = (now.getHours() - startHour + now.getMinutes() / 60) * HOUR_HEIGHT;
      timelineRef.current.scrollTop = Math.max(0, nowOffset - 200);
    }
  }, [startHour, selectedDate]);

  // Compute summary stats
  const focusSessions = dateSessions.filter(s => s.source !== 'break');
  const breakSessions = dateSessions.filter(s => s.source === 'break');
  const totalFocusMinutes = focusSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalBreakMinutes = breakSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const focusHours = Math.floor(totalFocusMinutes / 60);
  const focusMins = totalFocusMinutes % 60;

  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const goToToday = () => setSelectedDate(new Date());

  const isToday = isSameDay(selectedDate, new Date());

  // Position helpers
  const getTop = (date: Date) => {
    const h = date.getHours() + date.getMinutes() / 60;
    return (h - startHour) * HOUR_HEIGHT;
  };

  const getHeight = (minutes: number) => {
    return (minutes / 60) * HOUR_HEIGHT;
  };

  // Current time position
  const currentTimeTop = getTop(currentTime);

  // Handle add entry
  const handleAddEntry = async (entry: {
    durationMinutes: number;
    title: string;
    taskId: string | null;
    comment: string | null;
    billable: boolean;
  }) => {
    if (window.logAPI) {
      const dateStr = toDateStr(selectedDate);
      await window.logAPI.addAdhocEntry({
        date: dateStr,
        duration_minutes: entry.durationMinutes,
        title: entry.title,
        task_id: entry.taskId || null,
        comment: entry.comment || null,
        billable: entry.billable ? 1 : 0,
        is_todo: 0,
        due_date: null,
        completed: 0,
        marked_to_log: 1,
        logged: 0,
      });
      onRefresh();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* WEEK HEADER */}
      <div className="flex-none border-b border-glass-border p-4">
        {/* Date nav */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate(-1)}
              className="glass-button text-txt-muted text-sm px-2 py-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className={`glass-button text-sm px-3 py-1 ${isToday ? 'text-focus border-focus/30' : 'text-txt-secondary'}`}
            >
              Today
            </button>
            <button
              onClick={() => navigateDate(1)}
              className="glass-button text-txt-muted text-sm px-2 py-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <span className="text-sm text-txt-muted font-mono">
            {formatDateShort(weekDates[0])} - {formatDateShort(weekDates[6])}
          </span>
        </div>

        {/* Week grid */}
        <div className="grid grid-cols-7 gap-1">
          {weekDates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const isDayToday = isSameDay(date, new Date());
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center py-1.5 rounded-lg transition-all text-xs
                  ${isSelected
                    ? 'bg-focus/10 border border-focus/30 text-focus'
                    : isDayToday
                      ? 'text-focus hover:bg-glass-hover'
                      : 'text-txt-muted hover:bg-glass-hover'
                  }`}
              >
                <span className="font-medium">{formatDayName(date)}</span>
                <span className={`text-lg font-mono ${isSelected ? 'text-focus font-semibold' : ''}`}>
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="mt-3 text-xs text-txt-muted text-center">
          {focusSessions.length} session{focusSessions.length !== 1 ? 's' : ''}
          {totalFocusMinutes > 0 && (
            <span> &middot; {focusHours > 0 ? `${focusHours}h ` : ''}{focusMins}m focus</span>
          )}
          {totalBreakMinutes > 0 && (
            <span> &middot; {totalBreakMinutes}m break</span>
          )}
          {dateProposals.length > 0 && (
            <span> &middot; {dateProposals.length} meeting{dateProposals.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

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

          {/* Session + Calendar blocks with overlap resolution */}
          {(() => {
            // Build unified block list with computed positions
            const OVERLAP_GAP = 3;
            const blocks: { id: string; top: number; height: number; type: 'session' | 'calendar'; data: any }[] = [];

            dateSessions.forEach((session) => {
              const start = new Date(session.start_at);
              blocks.push({
                id: session.id,
                top: getTop(start),
                height: Math.max(getHeight(session.duration_minutes), 20),
                type: 'session',
                data: session,
              });
            });

            dateProposals.forEach((proposal) => {
              const start = new Date(proposal.start_at);
              blocks.push({
                id: proposal.id,
                top: getTop(start),
                height: Math.max(getHeight(proposal.duration_minutes), 20),
                type: 'calendar',
                data: proposal,
              });
            });

            // Sort by top position
            blocks.sort((a, b) => a.top - b.top);

            // Resolve overlaps: shift overlapping blocks below previous block's bottom edge
            const adjustedTops: Map<string, number> = new Map();
            for (let i = 0; i < blocks.length; i++) {
              let adjustedTop = blocks[i].top;
              for (let j = 0; j < i; j++) {
                const prevTop = adjustedTops.get(blocks[j].id)!;
                const prevBottom = prevTop + blocks[j].height;
                if (adjustedTop < prevBottom && adjustedTop + blocks[i].height > prevTop) {
                  adjustedTop = Math.max(adjustedTop, prevBottom + OVERLAP_GAP);
                }
              }
              adjustedTops.set(blocks[i].id, adjustedTop);
            }

            return blocks.map((block) => {
              const top = adjustedTops.get(block.id)!;
              const { height } = block;

              if (block.type === 'session') {
                const session = block.data as PomodoroSession;
                const isLogged = session.logged === 1;
                const isBreak = session.source === 'break';

                return (
                  <div
                    key={session.id}
                    className={`absolute left-14 right-4 rounded-lg border transition-colors overflow-hidden
                      ${isBreak
                        ? 'bg-emerald-500/15 border-emerald-500/30'
                        : isLogged
                          ? 'bg-focus/15 border-focus/30'
                          : 'bg-focus/10 border-focus/20'
                      }`}
                    style={{ top, height }}
                  >
                    <div className="px-2 py-1 flex items-center gap-2 h-full">
                      <span className={`text-xs font-mono font-medium truncate ${isBreak ? 'text-emerald-400' : 'text-focus'}`}>
                        {session.duration_minutes}m
                      </span>
                      {isBreak && (
                        <span className="text-xs text-emerald-400/70">Break</span>
                      )}
                      {!isBreak && session.task_id && (
                        <span className="text-xs font-mono text-txt-muted">#{session.task_id}</span>
                      )}
                      {!isBreak && session.comment && height > 30 && (
                        <span className="text-xs text-txt-dim truncate">{session.comment}</span>
                      )}
                      {!isBreak && isLogged && (
                        <span className="text-xs text-focus ml-auto">&#10003;</span>
                      )}
                    </div>
                  </div>
                );
              } else {
                const proposal = block.data as CalendarProposal;
                const isAccepted = proposal.accepted === 1;

                return (
                  <div
                    key={proposal.id}
                    className={`absolute left-14 right-4 rounded-lg border overflow-hidden
                      ${isAccepted
                        ? 'bg-blue-500/15 border-blue-500/30'
                        : 'bg-blue-500/5 border-blue-500/15 border-dashed'
                      }`}
                    style={{ top, height }}
                  >
                    <div className="px-2 py-1 flex items-center gap-2 h-full">
                      <span className="text-xs font-mono text-blue-400 font-medium truncate">
                        {proposal.duration_minutes}m
                      </span>
                      <span className="text-xs text-blue-400/70 truncate">{proposal.title}</span>
                      {proposal.task_id && (
                        <span className="text-xs font-mono text-txt-muted">#{proposal.task_id}</span>
                      )}
                    </div>
                  </div>
                );
              }
            });
          })()}

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

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="absolute bottom-6 right-6 w-14 h-14 bg-focus rounded-full shadow-glow-focus
                   flex items-center justify-center text-drip-bg text-2xl font-light
                   hover:scale-105 active:scale-95 transition-transform z-10"
      >
        +
      </button>

      {/* AddEntryModal */}
      {showAddModal && (
        <AddEntryModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddEntry}
        />
      )}
    </div>
  );
}
