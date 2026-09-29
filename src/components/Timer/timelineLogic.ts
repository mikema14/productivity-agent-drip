import type { PomodoroSession, CalendarProposal, AdhocEntry } from '../../types';

/** Two or more back-to-back focus sessions on one task, drawn as one timeline block. */
export interface SessionGroup {
  id: string;
  taskId: string;
  sessions: PomodoroSession[];
  start: Date;
  end: Date;
  totalMinutes: number;
}

export interface TimelineGroups {
  groups: SessionGroup[];
  /** Sessions drawn inside a group (hidden as single blocks while it is collapsed). */
  groupedSessionIds: Set<string>;
  /** Breaks that fall inside a group's span: the lane's gaps show them. */
  absorbedBreakIds: Set<string>;
}

/** Local calendar day `YYYY-MM-DD`. */
export function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function sessionEnd(s: PomodoroSession): Date {
  return s.end_at ? new Date(s.end_at) : new Date(new Date(s.start_at).getTime() + s.duration_minutes * 60_000);
}

type Walked =
  | { kind: 'session'; start: number; session: PomodoroSession }
  | { kind: 'other'; start: number };

/**
 * Merge consecutive focus sessions of the same task. Focus sessions, meetings and
 * scheduled adhoc entries are walked in start order; breaks are skipped, so a
 * break between two sessions of one task does not split them, but a meeting or
 * an entry does. Id-less sessions never merge.
 */
export function groupTimeline(
  sessions: PomodoroSession[],
  proposals: CalendarProposal[] = [],
  adhocEntries: AdhocEntry[] = []
): TimelineGroups {
  const walked: Walked[] = [
    ...sessions.filter(s => s.source !== 'break').map(s => ({ kind: 'session' as const, start: new Date(s.start_at).getTime(), session: s })),
    ...proposals.map(p => ({ kind: 'other' as const, start: new Date(p.start_at).getTime() })),
    ...adhocEntries.filter(e => e.start_time).map(e => ({ kind: 'other' as const, start: new Date(e.start_time!).getTime() })),
  ].sort((a, b) => a.start - b.start);

  const runs: PomodoroSession[][] = [];
  let run: PomodoroSession[] = [];
  for (const item of walked) {
    const session = item.kind === 'session' ? item.session : null;
    if (session?.task_id && run.length > 0 && run[0].task_id === session.task_id) {
      run.push(session);
      continue;
    }
    runs.push(run);
    run = session?.task_id ? [session] : [];
  }
  runs.push(run);

  const groups: SessionGroup[] = runs
    .filter(r => r.length >= 2)
    .map(r => {
      const start = new Date(r[0].start_at);
      const end = new Date(Math.max(...r.map(s => sessionEnd(s).getTime())));
      return {
        id: `group:${r[0].id}`,
        taskId: r[0].task_id!,
        sessions: r,
        start,
        end,
        totalMinutes: r.reduce((sum, s) => sum + s.duration_minutes, 0),
      };
    });

  const groupedSessionIds = new Set(groups.flatMap(g => g.sessions.map(s => s.id)));
  const absorbedBreakIds = new Set(
    sessions
      .filter(s => s.source === 'break')
      .filter(b => {
        const t = new Date(b.start_at).getTime();
        return groups.some(g => t >= g.start.getTime() && t < g.end.getTime());
      })
      .map(b => b.id)
  );

  return { groups, groupedSessionIds, absorbedBreakIds };
}

const hhmm = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

/** `3 × 25m · 11:20–13:05`; `3 sessions · …` when the lengths differ. */
export function groupFooter(group: SessionGroup): string {
  const n = group.sessions.length;
  const first = group.sessions[0].duration_minutes;
  const count = group.sessions.every(s => s.duration_minutes === first) ? `${n} × ${first}m` : `${n} sessions`;
  return `${count} · ${hhmm(group.start)}–${hhmm(group.end)}`;
}
