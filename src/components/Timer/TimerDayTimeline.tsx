import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useTimerStore } from '../../stores/timerStore';
import { useTaskName } from '../../hooks/useTaskName';
import { formatTime } from '../../utils/time';
import { formatMinutesPadded } from '../Plan/boardLogic';
import { groupTimeline, groupFooter, sessionEnd, toDateStr, type SessionGroup } from './timelineLogic';
import type { PomodoroSession, CalendarProposal, AdhocEntry } from '../../types';

interface TimerDayTimelineProps {
  sessions: PomodoroSession[];
  calendarProposals?: CalendarProposal[];
  adhocEntries?: AdhocEntry[];
  /** The day shown; the aside's day nav owns it. */
  selectedDate: Date;
}

const HOUR_HEIGHT = 110;

/** Day bar denominator (plan Q5): 12 segments of 30 minutes against a 6h focus target. */
export const DAY_TARGET_MINUTES = 360;
export const DAY_BAR_SEGMENTS = 12;

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

const hhmm = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

/** A merged run of sessions: lane of real positions on the left, id + total, name, intent, footer. */
function MergedBlock({ group, height, onExpand }: { group: SessionGroup; height: number; onExpand: () => void }) {
  const taskName = useTaskName(group.taskId);
  const span = Math.max(1, group.end.getTime() - group.start.getTime());
  const intent = group.sessions[group.sessions.length - 1].comment;
  const allLogged = group.sessions.every(s => s.logged === 1);

  return (
    <button
      type="button"
      aria-expanded={false}
      aria-label={`${group.taskId}, ${group.sessions.length} sessions, show each`}
      data-testid="merged-block"
      onClick={onExpand}
      className="w-full h-full flex text-left bg-drip-surface border border-drip-border rounded-[2px] overflow-hidden hover:border-txt-dim transition-colors"
    >
      <span aria-hidden className="relative w-1.5 shrink-0 bg-drip-elevated">
        {group.sessions.map(s => {
          const offset = new Date(s.start_at).getTime() - group.start.getTime();
          const length = sessionEnd(s).getTime() - new Date(s.start_at).getTime();
          return (
            <span
              key={s.id}
              data-testid="lane-segment"
              className="absolute left-0 right-0 bg-focus"
              style={{ top: `${(offset / span) * 100}%`, height: `${(length / span) * 100}%` }}
            />
          );
        })}
      </span>
      <span className="flex-1 min-w-0 px-3 py-2 flex flex-col gap-1">
        <span className="flex items-baseline gap-2 font-mono text-[11px] text-focus">
          {group.taskId}
          <span className="flex-1" />
          {allLogged && <span className="text-focus">&#10003;</span>}
          <span className="text-txt-primary">{formatMinutesPadded(group.totalMinutes)}</span>
        </span>
        {height >= 48 && taskName && <span className="font-display text-[13px] text-txt-primary truncate">{taskName}</span>}
        {height >= 72 && intent && <span className="font-display text-[12px] text-txt-muted truncate">{intent}</span>}
        {height >= 96 && (
          <>
            <span className="flex-1" />
            <span className="font-mono text-[10px] uppercase tracking-[1px] text-txt-muted">{groupFooter(group)}</span>
          </>
        )}
      </span>
    </button>
  );
}

export default function TimerDayTimeline({ sessions, calendarProposals, adhocEntries, selectedDate }: TimerDayTimelineProps) {
  const { status, sessionStartTime, currentTaskId, remainingSeconds, isPaused } = useTimerStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Update current time - faster during active session for elapsed counter
  useEffect(() => {
    const intervalMs = (status === 'focus' || status === 'break') ? 10000 : 60000;
    const interval = setInterval(() => setCurrentTime(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [status]);

  const dateStr = toDateStr(selectedDate);

  // Rows for the selected local day
  const dateSessions = useMemo(
    () => sessions.filter(s => toDateStr(new Date(s.start_at)) === dateStr),
    [sessions, dateStr]
  );

  const dateProposals = useMemo(
    () => (calendarProposals || []).filter(p => p.date === dateStr && p.dismissed !== 1),
    [calendarProposals, dateStr]
  );

  const dateAdhocEntries = useMemo(
    () => (adhocEntries || []).filter(e => e.date === dateStr),
    [adhocEntries, dateStr]
  );

  const { groups, groupedSessionIds, absorbedBreakIds } = useMemo(
    () => groupTimeline(dateSessions, dateProposals, dateAdhocEntries),
    [dateSessions, dateProposals, dateAdhocEntries]
  );

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

    dateAdhocEntries.filter(e => e.start_time).forEach(e => {
      const start = new Date(e.start_time!);
      const h = start.getHours();
      if (h < minHour) minHour = h;
      const endH = h + Math.ceil(e.duration_minutes / 60) + 1;
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
  }, [dateSessions, dateProposals, dateAdhocEntries, selectedDate]);

  const totalHours = endHour - startHour;

  // Auto-scroll so "now" is in view
  useEffect(() => {
    if (timelineRef.current && isSameDay(selectedDate, new Date())) {
      const now = new Date();
      const nowOffset = (now.getHours() - startHour + now.getMinutes() / 60) * HOUR_HEIGHT;
      timelineRef.current.scrollTop = Math.max(0, nowOffset - 200);
    }
  }, [startHour, selectedDate]);

  const isToday = isSameDay(selectedDate, new Date());

  // Position helpers
  const getTop = (date: Date) => {
    const h = date.getHours() + date.getMinutes() / 60;
    return (h - startHour) * HOUR_HEIGHT;
  };

  const getHeight = (minutes: number) => {
    return (minutes / 60) * HOUR_HEIGHT;
  };

  const currentTimeTop = getTop(currentTime);

  const toggle = (groupId: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });

  // Blocks sit on an opaque slot above the now line, so the line never crosses their text.
  const slot = (key: string, top: number, height: number, children: ReactNode) => (
    <div key={key} className="absolute left-[50px] right-0 z-10 bg-drip-bg" style={{ top, height }}>
      {children}
    </div>
  );

  const renderSession = (session: PomodoroSession, height: number, group?: SessionGroup) => {
    const isLogged = session.logged === 1;
    const isBreak = session.source === 'break';

    if (isBreak) {
      return (
        <div className="h-full rounded-[2px] border bg-break/15 border-break/40 overflow-hidden">
          <div className="px-2 py-1 flex items-center gap-2 h-full">
            <span className="font-mono text-[10.5px] font-medium truncate text-break">{session.duration_minutes}m</span>
            <span className="text-xs text-break/70">Break</span>
          </div>
        </div>
      );
    }

    const content = (
      <>
        <span className="text-txt-primary">{session.duration_minutes}m</span>
        {session.task_id && <span>{session.task_id}</span>}
        {session.comment && height > 30 && (
          <span className="font-display text-xs text-txt-muted truncate">{session.comment}</span>
        )}
        {isLogged && <span className="text-focus ml-auto">&#10003;</span>}
      </>
    );
    const frame = 'w-full h-full px-2.5 flex items-center gap-2 bg-drip-surface border border-drip-border rounded-[2px] overflow-hidden font-mono text-[10.5px] text-txt-secondary text-left';

    // One of an expanded run: a click folds the run back into its block.
    if (group) {
      return (
        <button
          type="button"
          aria-expanded
          aria-label={`${group.taskId}, ${session.duration_minutes}m at ${hhmm(new Date(session.start_at))}, fold sessions`}
          data-testid="expanded-session"
          onClick={() => toggle(group.id)}
          className={`${frame} border-l-2 border-l-focus hover:border-txt-dim transition-colors`}
        >
          {content}
        </button>
      );
    }
    return <div className={frame}>{content}</div>;
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={timelineRef} className="flex-1 overflow-y-auto relative">
        <div className="relative mt-[18px] mb-4 ml-3 mr-5" style={{ height: totalHours * HOUR_HEIGHT }}>
          {/* Hour gutter + dashed lines */}
          {Array.from({ length: totalHours + 1 }, (_, i) => {
            const hour = startHour + i;
            return (
              <div key={hour} className="absolute left-0 right-0 flex items-center gap-2 -translate-y-1/2" style={{ top: i * HOUR_HEIGHT }}>
                <span className="w-[38px] font-mono text-[10.5px] text-txt-muted">
                  {hour.toString().padStart(2, '0')}:00
                </span>
                <span className="flex-1 border-t border-dashed border-drip-elevated" />
              </div>
            );
          })}

          {/* Session groups, sessions, meetings and adhoc blocks with overlap resolution */}
          {(() => {
            const OVERLAP_GAP = 3;
            type Block =
              | { id: string; top: number; height: number; type: 'session'; data: PomodoroSession; group?: SessionGroup }
              | { id: string; top: number; height: number; type: 'group'; data: SessionGroup }
              | { id: string; top: number; height: number; type: 'calendar'; data: CalendarProposal }
              | { id: string; top: number; height: number; type: 'adhoc'; data: AdhocEntry };
            const blocks: Block[] = [];

            groups.forEach(group => {
              if (expanded.has(group.id)) {
                group.sessions.forEach(session => blocks.push({
                  id: session.id,
                  top: getTop(new Date(session.start_at)),
                  height: Math.max(getHeight(session.duration_minutes), 22),
                  type: 'session',
                  data: session,
                  group,
                }));
              } else {
                blocks.push({
                  id: group.id,
                  top: getTop(group.start),
                  height: Math.max(getHeight((group.end.getTime() - group.start.getTime()) / 60_000), 22),
                  type: 'group',
                  data: group,
                });
              }
            });

            dateSessions
              .filter(s => !groupedSessionIds.has(s.id) && !absorbedBreakIds.has(s.id))
              .forEach(session => blocks.push({
                id: session.id,
                top: getTop(new Date(session.start_at)),
                height: Math.max(getHeight(session.duration_minutes), 22),
                type: 'session',
                data: session,
              }));

            dateProposals.forEach(proposal => blocks.push({
              id: proposal.id,
              top: getTop(new Date(proposal.start_at)),
              height: Math.max(getHeight(proposal.duration_minutes), 20),
              type: 'calendar',
              data: proposal,
            }));

            dateAdhocEntries.filter(e => e.start_time).forEach(entry => blocks.push({
              id: entry.id,
              top: getTop(new Date(entry.start_time!)),
              height: Math.max(getHeight(entry.duration_minutes), 20),
              type: 'adhoc',
              data: entry,
            }));

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

            return blocks.map(block => {
              const top = adjustedTops.get(block.id)!;
              const { height } = block;

              if (block.type === 'group') {
                return slot(block.id, top, height, <MergedBlock group={block.data} height={height} onExpand={() => toggle(block.data.id)} />);
              }

              if (block.type === 'session') {
                return slot(block.id, top, height, renderSession(block.data, height, block.group));
              }

              if (block.type === 'calendar') {
                const proposal = block.data;
                const isAccepted = proposal.accepted === 1;
                return slot(block.id, top, height, (
                  <div
                    className={`h-full rounded-[2px] border overflow-hidden
                      ${isAccepted
                        ? 'bg-blue-500/10 border-blue-500/40'
                        : 'bg-transparent border-blue-500/40 border-dashed'
                      }`}
                  >
                    <div className="px-2 py-1 flex items-center gap-2 h-full">
                      <span className="font-mono text-[10.5px] text-blue-300 font-medium truncate">
                        {proposal.duration_minutes}m
                      </span>
                      <span className="text-xs text-blue-300/80 truncate">{proposal.title}</span>
                      {proposal.task_id && (
                        <span className="font-mono text-[10.5px] text-txt-muted">{proposal.task_id}</span>
                      )}
                    </div>
                  </div>
                ));
              }

              const entry = block.data;
              const isLogged = entry.logged === 1;
              return slot(block.id, top, height, (
                <div
                  className={`h-full rounded-[2px] border overflow-hidden
                    ${isLogged
                      ? 'bg-focus/10 border-focus/30'
                      : 'bg-transparent border-focus/30 border-dashed'
                    }`}
                >
                  <div className="px-2 py-1 flex items-center gap-2 h-full">
                    <span className="font-mono text-[10.5px] text-txt-secondary font-medium truncate">
                      {entry.duration_minutes}m
                    </span>
                    <span className="text-xs text-txt-muted truncate">{entry.title}</span>
                    {entry.task_id && (
                      <span className="font-mono text-[10.5px] text-txt-dim">{entry.task_id}</span>
                    )}
                    {isLogged && (
                      <span className="text-xs text-txt-secondary ml-auto">&#10003;</span>
                    )}
                  </div>
                </div>
              ));
            });
          })()}

          {/* Running session: dashed amber block with the time left */}
          {status === 'focus' && isToday && sessionStartTime && (() => {
            const startDate = new Date(sessionStartTime);
            const totalDurationMin = Math.ceil((Date.now() - startDate.getTime()) / 60000 + remainingSeconds / 60);
            const top = Math.max(0, getTop(startDate));
            const height = Math.max(getHeight(totalDurationMin), 24);

            return slot('running', top, height, (
              <div
                data-testid="running-block"
                className="h-full px-3 flex items-center gap-2 border border-dashed border-focus/55 bg-focus/5 rounded-[2px] overflow-hidden font-mono text-[10.5px] text-focus"
              >
                <span aria-hidden className={`w-1.5 h-1.5 shrink-0 ${isPaused ? 'bg-txt-dim' : 'bg-focus shadow-led'}`} />
                {currentTaskId && <span>{currentTaskId}</span>}
                <span className="flex-1" />
                <span className="text-txt-primary">{formatTime(remainingSeconds)} left</span>
              </div>
            ));
          })()}

          {/* Active break hatched block */}
          {status === 'break' && isToday && sessionStartTime && (() => {
            const startDate = new Date(sessionStartTime);
            const totalDurationMin = Math.ceil((Date.now() - startDate.getTime()) / 60000 + remainingSeconds / 60);
            const top = Math.max(0, getTop(startDate));
            const height = Math.max(getHeight(totalDurationMin), 24);
            const elapsedMin = Math.floor((Date.now() - startDate.getTime()) / 60000);

            return slot('break', top, height, (
              <div className="h-full rounded-[2px] border border-break/40 hatched-pattern-break bg-break/5 overflow-hidden">
                <div className="px-2 py-1 flex items-center gap-2 h-full">
                  <span className="font-mono text-[10.5px] text-break font-medium">{elapsedMin}m</span>
                  <span className="text-xs text-break/70">Break</span>
                  <span className="text-xs text-break/60 ml-auto font-mono animate-pulse-subtle">
                    On break...
                  </span>
                </div>
              </div>
            ));
          })()}

          {/* Now: amber time chip in the hour gutter + a 1px line behind the blocks */}
          {isToday && currentTimeTop >= 0 && currentTimeTop <= totalHours * HOUR_HEIGHT && (
            <div className="absolute left-0 right-0 z-0 pointer-events-none flex items-center gap-1.5 -translate-y-1/2" style={{ top: currentTimeTop }}>
              <span
                data-testid="now-marker"
                className="w-[38px] py-px text-center font-mono text-[10.5px] font-semibold text-drip-bg bg-focus"
              >
                {hhmm(currentTime)}
              </span>
              <span className="flex-1 border-t border-focus" />
            </div>
          )}
        </div>
      </div>

      {/* Unscheduled adhoc entries (no start_time) */}
      {dateAdhocEntries.filter(e => !e.start_time).length > 0 && (
        <div className="flex-none border-t border-drip-elevated px-4 py-2">
          <p className="now-label text-txt-muted mb-1">Unscheduled</p>
          <div className="space-y-1">
            {dateAdhocEntries.filter(e => !e.start_time).map(entry => (
              <div key={entry.id} className="flex items-center gap-2 px-2 py-1 rounded-[2px] border border-focus/30 border-dashed">
                <span className="font-mono text-[10.5px] text-txt-secondary">{entry.duration_minutes}m</span>
                <span className="text-xs text-txt-muted truncate">{entry.title}</span>
                {entry.task_id && (
                  <span className="font-mono text-[10.5px] text-txt-dim">{entry.task_id}</span>
                )}
                {entry.logged === 1 && (
                  <span className="text-xs text-txt-secondary ml-auto">&#10003;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
