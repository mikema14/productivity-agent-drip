import { useState, useMemo, useEffect } from 'react';
import type { PomodoroSession } from '../../types';
import { groupSessionsByTaskId } from '../../utils/mergeEntries';
import { useTimerStore } from '../../stores/timerStore';
import TimelineItem from '../shared/TimelineItem';

interface SessionHistoryProps {
  sessions: PomodoroSession[];
}

interface SessionWithTitle extends PomodoroSession {
  taskTitle?: string;
}

export default function SessionHistory({ sessions }: SessionHistoryProps) {
  const { sessionViewMode, setSessionViewMode } = useTimerStore();
  const isGrouped = sessionViewMode === 'grouped';
  const [sessionsWithTitles, setSessionsWithTitles] = useState<SessionWithTitle[]>([]);

  useEffect(() => {
    async function loadTaskTitles() {
      const sessionsWithTitlesTemp = await Promise.all(
        sessions.map(async (session) => {
          let taskTitle: string | undefined;
          if (session.task_id && window.logAPI) {
            try {
              const cachedTask = await window.logAPI.getCachedTask(session.task_id);
              taskTitle = cachedTask?.title;
            } catch (error) {
              console.error(`Failed to load task title for ${session.task_id}:`, error);
            }
          }
          return { ...session, taskTitle };
        })
      );
      setSessionsWithTitles(sessionsWithTitlesTemp);
    }

    loadTaskTitles();
  }, [sessions]);

  const displaySessions = useMemo(() => {
    if (!isGrouped) {
      return sessionsWithTitles.map(s => ({
        ...s,
        isMerged: false,
        sourceCount: 1,
        sourceEntries: [s]
      }));
    }

    const grouped = new Map<string, SessionWithTitle[]>();

    sessionsWithTitles.forEach(session => {
      const key = session.task_id || `unassigned-${session.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(session);
    });

    return Array.from(grouped.entries()).map(([taskId, group]) => {
      if (taskId.startsWith('unassigned-')) {
        return {
          ...group[0],
          isMerged: false,
          sourceCount: 1,
          sourceEntries: [group[0]]
        };
      }

      if (group.length === 1) {
        return {
          ...group[0],
          isMerged: false,
          sourceCount: 1,
          sourceEntries: [group[0]]
        };
      }

      const totalMinutes = group.reduce((sum, s) => sum + s.duration_minutes, 0);
      const comments = group
        .map(s => s.comment)
        .filter(Boolean)
        .join('; ');

      return {
        ...group[0],
        id: `merged-${taskId}`,
        duration_minutes: totalMinutes,
        comment: comments || group[0].comment,
        billable: group.some(s => s.billable) ? 1 : 0,
        logged: group.every(s => s.logged) ? 1 : 0,
        isMerged: true,
        sourceCount: group.length,
        sourceEntries: group,
        taskTitle: group[0].taskTitle,
      };
    });
  }, [sessionsWithTitles, isGrouped]);

  if (sessions.length === 0) {
    return (
      <div className="bg-transparent border border-focus/30 rounded-xl p-6">
        <h2 className="text-xl font-display font-semibold text-txt-primary mb-4">
          Today's Sessions
        </h2>
        <p className="text-txt-muted text-center py-8">
          No sessions completed yet. Start your first focus session!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-transparent border border-focus/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-semibold text-txt-primary">
          Today's Sessions ({sessions.length})
        </h2>
        <button
          onClick={() => setSessionViewMode(isGrouped ? 'flat' : 'grouped')}
          className="bg-transparent border border-focus/20 text-txt-muted rounded-xl px-4 py-2 text-xs hover:bg-focus/5 transition-all"
        >
          {isGrouped ? '⊟ Show Flat' : '⊞ Group by Task'}
        </button>
      </div>

      <div className="space-y-0">
        {displaySessions.map((session, index) => (
          <TimelineItem
            key={session.id}
            timestamp={session.start_at}
            isFirst={index === 0}
            isLast={index === displaySessions.length - 1}
            isMerged={session.isMerged}
            sourceCount={session.sourceCount}
          >
            <div className="p-4 bg-focus/5 rounded-xl border border-focus/20 hover:border-focus/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Duration Badge */}
                  <div className="px-3 py-1 bg-focus-muted text-focus text-sm font-mono font-medium rounded-full">
                    {session.duration_minutes} min
                  </div>

                  {/* Task ID and Title */}
                  {session.task_id && (
                    <div className="flex flex-col gap-1">
                      <div className="px-3 py-1 bg-focus/5 border border-focus/20 text-txt-secondary text-sm font-mono font-medium rounded-full">
                        #{session.task_id}
                      </div>
                      {session.taskTitle && (
                        <span className="text-xs text-txt-muted truncate max-w-xs">
                          {session.taskTitle}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  {session.logged ? (
                    <span className="text-xs text-focus font-medium">✓ Logged</span>
                  ) : (
                    <span className="text-xs text-txt-dim font-medium">Not logged</span>
                  )}
                </div>
              </div>

              {/* Intention Display */}
              {session.comment && (
                <div className="mt-2 text-sm text-txt-muted italic">
                  <span className="font-medium not-italic text-txt-secondary">Intention:</span> {session.comment}
                </div>
              )}
            </div>
          </TimelineItem>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-focus/20">
        <div className="flex justify-between text-sm">
          <span className="text-txt-secondary">Total focus time:</span>
          <span className="font-display font-semibold text-txt-primary">
            {sessions.reduce((sum, s) => sum + s.duration_minutes, 0)} minutes
          </span>
        </div>
      </div>
    </div>
  );
}
