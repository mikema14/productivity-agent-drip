import { baseExecuteSQL } from "@raycast/utils/dist/sql-utils";
import { execSync } from "child_process";
import { DB_PATH } from "./constants";
import type {
  TimerStatePayload,
  TaskCache,
  PomodoroSession,
  AdhocEntry,
  CalendarProposal,
  DailyIntention,
  WeeklySummary,
  UnifiedEntry,
  DripList,
  DripListItem,
  Subtask,
} from "./types";

// --- Read helpers (uses Raycast's built-in sqlite3 CLI — no native module) ---

async function query<T>(sql: string): Promise<T[]> {
  return baseExecuteSQL<T>(DB_PATH, sql);
}

// --- Write helper (uses system sqlite3 CLI directly) ---

function exec(sql: string): void {
  execSync(`sqlite3 "${DB_PATH}" "${sql.replace(/"/g, '\\"')}"`, {
    timeout: 5000,
  });
}

// No-op for backwards compat — no connection to close
export function closeDB() {}

// --- Settings ---

export async function getSetting(key: string): Promise<string | null> {
  const rows = await query<{ value: string }>(
    `SELECT value FROM settings WHERE key = '${escapeSql(key)}'`
  );
  return rows[0]?.value ?? null;
}

export function saveSettingSync(key: string, value: string): void {
  exec(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('${escapeSql(key)}', '${escapeSql(value)}')`
  );
}

// --- Timer State ---

export async function getTimerState(): Promise<TimerStatePayload | null> {
  const raw = await getSetting("timer_state");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TimerStatePayload;
  } catch {
    return null;
  }
}

// --- Task Cache ---

export async function getRecentTasks(limit = 20): Promise<TaskCache[]> {
  return query<TaskCache>(
    `SELECT * FROM task_cache ORDER BY last_seen_at DESC LIMIT ${limit}`
  );
}

export async function searchTasks(queryStr: string): Promise<TaskCache[]> {
  const escaped = escapeSql(queryStr);
  return query<TaskCache>(
    `SELECT * FROM task_cache WHERE task_id LIKE '%${escaped}%' OR title LIKE '%${escaped}%' ORDER BY last_seen_at DESC LIMIT 50`
  );
}

export async function getCachedTask(
  taskId: string
): Promise<TaskCache | null> {
  const rows = await query<TaskCache>(
    `SELECT * FROM task_cache WHERE task_id = '${escapeSql(taskId)}'`
  );
  return rows[0] ?? null;
}

export function cacheTaskSync(task: TaskCache): void {
  exec(
    `INSERT OR REPLACE INTO task_cache (task_id, title, project_id, project_name, last_seen_at) VALUES ('${escapeSql(task.task_id)}', '${escapeSql(task.title)}', ${task.project_id}, '${escapeSql(task.project_name || "")}', datetime('now'))`
  );
}

// --- Sessions ---

export async function getTodaySessions(
  date: string
): Promise<PomodoroSession[]> {
  return query<PomodoroSession>(
    `SELECT * FROM pomodoro_sessions WHERE date(start_at) = '${escapeSql(date)}' ORDER BY start_at ASC`
  );
}

export async function getSessionsInRange(
  startDate: string,
  endDate: string
): Promise<PomodoroSession[]> {
  return query<PomodoroSession>(
    `SELECT * FROM pomodoro_sessions WHERE date(start_at) BETWEEN '${escapeSql(startDate)}' AND '${escapeSql(endDate)}' ORDER BY start_at ASC`
  );
}

export function updateSessionLoggedSync(
  id: string,
  serverEntryId: number
): void {
  exec(
    `UPDATE pomodoro_sessions SET logged = 1, log_sent_at = datetime('now'), server_entry_id = ${serverEntryId} WHERE id = '${escapeSql(id)}'`
  );
}

// --- Adhoc Entries ---

export async function getTodayAdhocEntries(
  date: string
): Promise<AdhocEntry[]> {
  return query<AdhocEntry>(
    `SELECT * FROM adhoc_entries WHERE date = '${escapeSql(date)}' ORDER BY created_at ASC`
  );
}

export function addAdhocEntrySync(entry: {
  id: string;
  date: string;
  duration_minutes: number;
  title: string;
  task_id: string | null;
  comment: string | null;
  marked_to_log: number;
}): void {
  const taskId = entry.task_id ? `'${escapeSql(entry.task_id)}'` : "NULL";
  const comment = entry.comment
    ? `'${escapeSql(entry.comment)}'`
    : "NULL";
  exec(
    `INSERT INTO adhoc_entries (id, date, duration_minutes, title, task_id, comment, marked_to_log) VALUES ('${escapeSql(entry.id)}', '${escapeSql(entry.date)}', ${entry.duration_minutes}, '${escapeSql(entry.title)}', ${taskId}, ${comment}, ${entry.marked_to_log})`
  );
}

export function updateAdhocEntryLoggedSync(id: string): void {
  exec(`UPDATE adhoc_entries SET logged = 1 WHERE id = '${escapeSql(id)}'`);
}

// --- Calendar Proposals ---

export async function getTodayCalendarProposals(
  date: string
): Promise<CalendarProposal[]> {
  return query<CalendarProposal>(
    `SELECT * FROM calendar_proposals WHERE date = '${escapeSql(date)}' AND accepted = 1 AND dismissed = 0 ORDER BY start_at ASC`
  );
}

// --- Daily Intentions ---

export async function getDailyIntentions(
  date: string
): Promise<DailyIntention[] | null> {
  const rows = await query<{ intentions: string }>(
    `SELECT * FROM daily_intentions WHERE date = '${escapeSql(date)}'`
  );
  if (!rows[0]) return null;
  try {
    return JSON.parse(rows[0].intentions) as DailyIntention[];
  } catch {
    return null;
  }
}

export function saveDailyIntentionsSync(
  date: string,
  intentions: DailyIntention[]
): void {
  const json = escapeSql(JSON.stringify(intentions));
  exec(
    `INSERT INTO daily_intentions (date, intentions) VALUES ('${escapeSql(date)}', '${json}') ON CONFLICT(date) DO UPDATE SET intentions = excluded.intentions, updated_at = CURRENT_TIMESTAMP`
  );
}

// --- Weekly Summaries ---

export async function getWeeklySummary(
  weekStart: string
): Promise<WeeklySummary | null> {
  const rows = await query<WeeklySummary>(
    `SELECT * FROM weekly_summaries WHERE week_start = '${escapeSql(weekStart)}'`
  );
  return rows[0] ?? null;
}

// --- Unified Entries ---

export async function getUnifiedEntries(
  date: string
): Promise<UnifiedEntry[]> {
  const [sessions, adhoc, calendar] = await Promise.all([
    getTodaySessions(date),
    getTodayAdhocEntries(date),
    getTodayCalendarProposals(date),
  ]);

  const entries: UnifiedEntry[] = [];

  for (const s of sessions) {
    if (s.source === "break") continue;
    const startDate = new Date(s.start_at);
    entries.push({
      id: s.id,
      type: "session",
      title: s.comment || "Focus session",
      duration_minutes: s.duration_minutes,
      task_id: s.task_id,
      logged: s.logged === 1,
      billable: s.billable === 1,
      comment: s.comment,
      time: `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`,
      date,
    });
  }

  for (const a of adhoc) {
    const task = a.task_id ? await getCachedTask(a.task_id) : null;
    entries.push({
      id: a.id,
      type: "adhoc",
      title: a.title,
      duration_minutes: a.duration_minutes,
      task_id: a.task_id,
      logged: a.logged === 1,
      billable: true,
      comment: a.comment,
      time: new Date(a.created_at).toTimeString().slice(0, 5),
      date,
      project_id: task?.project_id,
    });
  }

  for (const c of calendar) {
    const startDate = new Date(c.start_at);
    entries.push({
      id: c.id,
      type: "calendar",
      title: c.title,
      duration_minutes: c.duration_minutes,
      task_id: c.task_id,
      logged: false,
      billable: false,
      comment: null,
      time: `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`,
      date,
    });
  }

  entries.sort((a, b) => a.time.localeCompare(b.time));
  return entries;
}

export async function getUnloggedEntries(
  date: string
): Promise<UnifiedEntry[]> {
  const all = await getUnifiedEntries(date);
  return all.filter((e) => !e.logged && e.task_id);
}

// --- Lists ---

export async function getLists(): Promise<DripList[]> {
  return query<DripList>(
    `SELECT id, name, color, task_id, "order" FROM lists ORDER BY "order" ASC`
  );
}

export async function getActiveListItems(): Promise<DripListItem[]> {
  return query<DripListItem>(
    `SELECT li.id, li.list_id, li.title, li.task_id, li."column", li."order", li.completed, li.subtasks, l.name AS list_name, l.color AS list_color, l.task_id AS list_task_id FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.completed = 0 ORDER BY CASE li."column" WHEN 'today' THEN 0 WHEN 'this_week' THEN 1 WHEN 'backlog' THEN 2 END, li."order" ASC`
  );
}

export async function searchListItems(queryStr: string): Promise<DripListItem[]> {
  const escaped = escapeSql(queryStr);
  return query<DripListItem>(
    `SELECT li.id, li.list_id, li.title, li.task_id, li."column", li."order", li.completed, li.subtasks, l.name AS list_name, l.color AS list_color, l.task_id AS list_task_id FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.completed = 0 AND (li.title LIKE '%${escaped}%' OR li.task_id LIKE '%${escaped}%' OR l.task_id LIKE '%${escaped}%') ORDER BY CASE li."column" WHEN 'today' THEN 0 WHEN 'this_week' THEN 1 WHEN 'backlog' THEN 2 END, li."order" ASC LIMIT 50`
  );
}

// --- Subtask Parsing ---

export function parseSubtasks(raw: string | null): Subtask[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Subtask[];
  } catch {
    return [];
  }
}

// --- Utility ---

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}
