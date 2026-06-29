import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { PomodoroSession, Setting, TaskPreference, Milestone, Goal, DailyIntentions, ShutdownRitual, TaskList, ListItem } from '../types';

let db: Database.Database | null = null;

export function initDB(): Database.Database {
  if (db) return db;

  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'productivity.db');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Execute schema inline instead of reading from file
  const schema = `
    CREATE TABLE IF NOT EXISTS task_cache (
      task_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      project_name TEXT,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id TEXT PRIMARY KEY,
      start_at DATETIME NOT NULL,
      end_at DATETIME,
      duration_minutes INTEGER NOT NULL DEFAULT 25,
      task_id TEXT,
      source TEXT CHECK(source IN ('pomodoro', 'manual', 'calendar', 'break')) DEFAULT 'pomodoro',
      comment TEXT,
      logged INTEGER DEFAULT 0,
      log_sent_at DATETIME,
      server_entry_id INTEGER,
      billable INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS adhoc_entries (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      date TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      title TEXT NOT NULL,
      task_id TEXT,
      is_todo INTEGER DEFAULT 0,
      due_date TEXT,
      completed INTEGER DEFAULT 0,
      marked_to_log INTEGER DEFAULT 0,
      logged INTEGER DEFAULT 0,
      comment TEXT,
      billable INTEGER DEFAULT 1,
      start_time TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_proposals (
      id TEXT PRIMARY KEY,
      event_uid TEXT NOT NULL,
      title TEXT NOT NULL,
      start_at DATETIME NOT NULL,
      end_at DATETIME NOT NULL,
      duration_minutes INTEGER NOT NULL,
      date TEXT NOT NULL,
      accepted INTEGER DEFAULT 0,
      dismissed INTEGER DEFAULT 0,
      task_id TEXT,
      comment TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_summaries (
      date TEXT PRIMARY KEY,
      payload JSON NOT NULL,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS log_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      task_id TEXT NOT NULL,
      default_duration INTEGER,
      billable INTEGER DEFAULT 1,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_preferences (
      task_id TEXT PRIMARY KEY,
      tracked INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      milestone_ids TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      parent_type TEXT CHECK(parent_type IN ('task', 'goal')) NOT NULL,
      parent_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER DEFAULT 0,
      order_num INTEGER DEFAULT 0,
      weight REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      identity_reinforcement TEXT,
      milestone_ids TEXT DEFAULT '[]',
      active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_intentions (
      date TEXT PRIMARY KEY,
      intentions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shutdown_rituals (
      date TEXT PRIMARY KEY,
      total_minutes INTEGER NOT NULL,
      deep_work_minutes INTEGER NOT NULL,
      tasks_worked TEXT NOT NULL,
      reflection TEXT,
      notes TEXT,
      tomorrow_intentions TEXT,
      locked INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#10b981',
      icon_path TEXT,
      task_id TEXT,
      "order" INTEGER NOT NULL DEFAULT 0,
      billable INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS list_items (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      task_id TEXT,
      "column" TEXT NOT NULL DEFAULT 'backlog' CHECK("column" IN ('backlog','this_week','today')),
      "order" INTEGER NOT NULL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      billable INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_date ON pomodoro_sessions(date(start_at));
    CREATE INDEX IF NOT EXISTS idx_sessions_logged ON pomodoro_sessions(logged);
    CREATE INDEX IF NOT EXISTS idx_sessions_task_id ON pomodoro_sessions(task_id);
    CREATE INDEX IF NOT EXISTS idx_adhoc_date ON adhoc_entries(date);
    CREATE INDEX IF NOT EXISTS idx_adhoc_task_id ON adhoc_entries(task_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_proposals(date);
    CREATE INDEX IF NOT EXISTS idx_task_cache_last_seen ON task_cache(last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_milestones_parent ON milestones(parent_type, parent_id);
    CREATE INDEX IF NOT EXISTS idx_milestones_completed ON milestones(completed);
    CREATE INDEX IF NOT EXISTS idx_task_prefs_tracked ON task_preferences(tracked);
    CREATE INDEX IF NOT EXISTS idx_goals_active ON goals(active);
    CREATE INDEX IF NOT EXISTS idx_list_items_list ON list_items(list_id);
    CREATE INDEX IF NOT EXISTS idx_list_items_column ON list_items("column");
  `;

  // Execute schema statements
  db.exec(schema);

  // Run migrations for existing databases
  runMigrations(db);

  // Initialize default settings if not present
  initializeDefaultSettings(db);

  // Initialize default templates if not present
  initializeDefaultTemplates(db);

  return db;
}

// ==================== WEEKLY SUMMARIES ====================

export function getWeeklySummary(weekStart: string) {
  const database = getDB();
  return database.prepare('SELECT * FROM weekly_summaries WHERE week_start = ?').get(weekStart) as any | null;
}

export function getWeeklySummariesInRange(startDate: string, endDate: string) {
  const database = getDB();
  return database.prepare(
    'SELECT * FROM weekly_summaries WHERE week_start BETWEEN ? AND ? ORDER BY week_start ASC'
  ).all(startDate, endDate) as any[];
}

export function computeWeeklySummary(weekStart: string): void {
  const database = getDB();

  // Calculate week end (Sunday)
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const endStr = end.toISOString().split('T')[0];

  // Get all sessions in the week
  const sessions = database.prepare(`
    SELECT * FROM pomodoro_sessions
    WHERE date(start_at) BETWEEN date(?) AND date(?)
  `).all(weekStart, endStr) as any[];

  // Get all adhoc entries in the week
  const adhocEntries = database.prepare(`
    SELECT * FROM adhoc_entries
    WHERE date BETWEEN ? AND ?
  `).all(weekStart, endStr) as any[];

  // Total minutes = all work (sessions excl. breaks + adhoc)
  const totalMinutes = sessions
    .filter((s: any) => s.source !== 'break')
    .reduce((sum: number, s: any) => sum + s.duration_minutes, 0)
    + adhocEntries.reduce((sum: number, e: any) => sum + e.duration_minutes, 0);

  // Deep work = pomodoro focus sessions only
  const deepWorkSessions = sessions.filter((s: any) => s.source === 'pomodoro');
  const deepWorkMinutes = deepWorkSessions.reduce((sum: number, s: any) => sum + s.duration_minutes, 0);

  // Sessions completed = pomodoro sessions (focus only, not breaks)
  const sessionsCompleted = deepWorkSessions.length;

  // Sessions started — we count all non-break sessions (pomodoro + manual that have a timer context)
  // For now, same as completed since we only save completed sessions
  const sessionsStarted = sessionsCompleted;

  // Average session duration
  const avgSessionMinutes = sessionsCompleted > 0
    ? deepWorkMinutes / sessionsCompleted
    : 0;

  // Time-of-day breakdown from pomodoro sessions (deep work only)
  const hourBuckets: Record<number, number> = {};
  let morningMinutes = 0;
  let afternoonMinutes = 0;
  let eveningMinutes = 0;

  for (const s of deepWorkSessions) {
    const hour = new Date(s.start_at).getHours();
    hourBuckets[hour] = (hourBuckets[hour] || 0) + s.duration_minutes;

    if (hour >= 6 && hour < 12) morningMinutes += s.duration_minutes;
    else if (hour >= 12 && hour < 18) afternoonMinutes += s.duration_minutes;
    else eveningMinutes += s.duration_minutes;
  }

  // Peak hour
  let peakHour: number | null = null;
  let peakMinutes = 0;
  for (const [hour, minutes] of Object.entries(hourBuckets)) {
    if (minutes > peakMinutes) {
      peakMinutes = minutes;
      peakHour = parseInt(hour);
    }
  }

  // Unique tasks touched
  const taskIds = new Set<string>();
  sessions.forEach((s: any) => { if (s.task_id) taskIds.add(s.task_id); });
  adhocEntries.forEach((e: any) => { if (e.task_id) taskIds.add(e.task_id); });

  // Reflections count
  const reflectionsCount = database.prepare(`
    SELECT COUNT(*) as count FROM shutdown_rituals
    WHERE date BETWEEN ? AND ? AND reflection IS NOT NULL AND reflection != ''
  `).get(weekStart, endStr) as any;

  // Upsert
  database.prepare(`
    INSERT INTO weekly_summaries (
      week_start, total_minutes, deep_work_minutes, sessions_completed, sessions_started,
      avg_session_minutes, peak_hour, morning_minutes, afternoon_minutes, evening_minutes,
      tasks_touched, reflections_count, computed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(week_start) DO UPDATE SET
      total_minutes = excluded.total_minutes,
      deep_work_minutes = excluded.deep_work_minutes,
      sessions_completed = excluded.sessions_completed,
      sessions_started = excluded.sessions_started,
      avg_session_minutes = excluded.avg_session_minutes,
      peak_hour = excluded.peak_hour,
      morning_minutes = excluded.morning_minutes,
      afternoon_minutes = excluded.afternoon_minutes,
      evening_minutes = excluded.evening_minutes,
      tasks_touched = excluded.tasks_touched,
      reflections_count = excluded.reflections_count,
      computed_at = datetime('now')
  `).run(
    weekStart, totalMinutes, deepWorkMinutes, sessionsCompleted, sessionsStarted,
    avgSessionMinutes, peakHour, morningMinutes, afternoonMinutes, eveningMinutes,
    taskIds.size, reflectionsCount?.count || 0
  );
}

export function getTaskTotalMinutes(taskId: string): number {
  const database = getDB();
  const result = database.prepare(`
    SELECT COALESCE(
      (SELECT SUM(duration_minutes) FROM pomodoro_sessions WHERE task_id = ? AND source != 'break'), 0
    ) + COALESCE(
      (SELECT SUM(duration_minutes) FROM adhoc_entries WHERE task_id = ?), 0
    ) as total_minutes
  `).get(taskId, taskId) as any;
  return result?.total_minutes || 0;
}

export function getShutdownReflectionsInRange(startDate: string, endDate: string) {
  const database = getDB();
  return database.prepare(`
    SELECT date, reflection, notes FROM shutdown_rituals
    WHERE date BETWEEN ? AND ? AND (reflection IS NOT NULL AND reflection != '')
    ORDER BY date ASC
  `).all(startDate, endDate) as Array<{ date: string; reflection: string; notes: string | null }>;
}

export function getSessionsByTimeOfDay(startDate: string, endDate: string) {
  const database = getDB();
  const sessions = database.prepare(`
    SELECT start_at, duration_minutes FROM pomodoro_sessions
    WHERE date(start_at) BETWEEN date(?) AND date(?) AND source = 'pomodoro'
    ORDER BY start_at ASC
  `).all(startDate, endDate) as Array<{ start_at: string; duration_minutes: number }>;

  const hourMap: Record<number, number> = {};
  for (const s of sessions) {
    const hour = new Date(s.start_at).getHours();
    hourMap[hour] = (hourMap[hour] || 0) + s.duration_minutes;
  }

  return Object.entries(hourMap).map(([hour, minutes]) => ({
    hour: parseInt(hour),
    minutes
  })).sort((a, b) => a.hour - b.hour);
}

function runMigrations(database: Database.Database) {
  // Migration: Add comment column to calendar_proposals if it doesn't exist
  try {
    const tableInfo = database.pragma('table_info(calendar_proposals)');
    const hasCommentColumn = tableInfo.some((col: any) => col.name === 'comment');

    if (!hasCommentColumn) {
      console.log('Running migration: Adding comment column to calendar_proposals');
      database.exec('ALTER TABLE calendar_proposals ADD COLUMN comment TEXT');
      console.log('Migration complete');
    }

    const hasLoggedColumn = tableInfo.some((col: any) => col.name === 'logged');
    if (!hasLoggedColumn) {
      console.log('Running migration: Adding logged column to calendar_proposals');
      database.exec('ALTER TABLE calendar_proposals ADD COLUMN logged INTEGER DEFAULT 0');
      console.log('Migration complete: calendar_proposals.logged');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }

  // Migration: Add billable column to pomodoro_sessions
  try {
    const sessionsInfo = database.pragma('table_info(pomodoro_sessions)');
    const sessionHasBillable = sessionsInfo.some((col: any) => col.name === 'billable');

    if (!sessionHasBillable) {
      console.log('Running migration: Adding billable column to pomodoro_sessions');
      database.exec('ALTER TABLE pomodoro_sessions ADD COLUMN billable INTEGER DEFAULT 1');
      console.log('Migration complete: pomodoro_sessions.billable');
    }
  } catch (error) {
    console.error('Migration error (pomodoro_sessions billable):', error);
  }

  // Migration: Add billable column to adhoc_entries
  try {
    const adhocInfo = database.pragma('table_info(adhoc_entries)');
    const adhocHasBillable = adhocInfo.some((col: any) => col.name === 'billable');

    if (!adhocHasBillable) {
      console.log('Running migration: Adding billable column to adhoc_entries');
      database.exec('ALTER TABLE adhoc_entries ADD COLUMN billable INTEGER DEFAULT 1');
      console.log('Migration complete: adhoc_entries.billable');
    }
  } catch (error) {
    console.error('Migration error (adhoc_entries billable):', error);
  }

  // Migration: Add comment column to log_templates
  try {
    const templatesInfo = database.pragma('table_info(log_templates)');
    const hasCommentColumn = templatesInfo.some((col: any) => col.name === 'comment');

    if (!hasCommentColumn) {
      console.log('Running migration: Adding comment column to log_templates');
      database.exec('ALTER TABLE log_templates ADD COLUMN comment TEXT');
      console.log('Migration complete: log_templates.comment');
    }
  } catch (error) {
    console.error('Migration error (log_templates comment):', error);
  }

  // Migration: Add start_time column to adhoc_entries
  try {
    const adhocInfo2 = database.pragma('table_info(adhoc_entries)');
    const hasStartTime = adhocInfo2.some((col: any) => col.name === 'start_time');

    if (!hasStartTime) {
      console.log('Running migration: Adding start_time column to adhoc_entries');
      database.exec('ALTER TABLE adhoc_entries ADD COLUMN start_time TEXT');
      console.log('Migration complete: adhoc_entries.start_time');
    }
  } catch (error) {
    console.error('Migration error (adhoc_entries start_time):', error);
  }

  // Migration: Add 'break' to source CHECK constraint on pomodoro_sessions
  try {
    const tableInfo = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pomodoro_sessions'").get() as { sql: string } | undefined;
    if (tableInfo && !tableInfo.sql.includes("'break'")) {
      console.log('Running migration: Adding break to source CHECK constraint');
      database.exec(`
        ALTER TABLE pomodoro_sessions RENAME TO pomodoro_sessions_old;
        CREATE TABLE pomodoro_sessions (
          id TEXT PRIMARY KEY,
          start_at DATETIME NOT NULL,
          end_at DATETIME,
          duration_minutes INTEGER NOT NULL DEFAULT 25,
          task_id TEXT,
          source TEXT CHECK(source IN ('pomodoro', 'manual', 'calendar', 'break')) DEFAULT 'pomodoro',
          comment TEXT,
          logged INTEGER DEFAULT 0,
          log_sent_at DATETIME,
          server_entry_id INTEGER,
          billable INTEGER DEFAULT 1
        );
        INSERT INTO pomodoro_sessions SELECT * FROM pomodoro_sessions_old;
        DROP TABLE pomodoro_sessions_old;
      `);
      console.log('Migration complete: pomodoro_sessions source CHECK updated');
    }
  } catch (error) {
    console.error('Migration error (pomodoro_sessions source CHECK):', error);
  }

  // Migration: Create weekly_summaries table
  try {
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='weekly_summaries'").all();
    if (tables.length === 0) {
      console.log('Running migration: Creating weekly_summaries table');
      database.exec(`
        CREATE TABLE weekly_summaries (
          week_start TEXT PRIMARY KEY,
          total_minutes INTEGER DEFAULT 0,
          deep_work_minutes INTEGER DEFAULT 0,
          sessions_completed INTEGER DEFAULT 0,
          sessions_started INTEGER DEFAULT 0,
          avg_session_minutes REAL DEFAULT 0,
          peak_hour INTEGER,
          morning_minutes INTEGER DEFAULT 0,
          afternoon_minutes INTEGER DEFAULT 0,
          evening_minutes INTEGER DEFAULT 0,
          tasks_touched INTEGER DEFAULT 0,
          reflections_count INTEGER DEFAULT 0,
          computed_at TEXT
        )
      `);
      console.log('Migration complete: weekly_summaries table created');
    }
  } catch (error) {
    console.error('Migration error (weekly_summaries table):', error);
  }

  // Migration: Add target_hours to goals
  try {
    const goalsInfo = database.pragma('table_info(goals)');
    const hasTargetHours = goalsInfo.some((col: any) => col.name === 'target_hours');
    if (!hasTargetHours) {
      console.log('Running migration: Adding target_hours column to goals');
      database.exec('ALTER TABLE goals ADD COLUMN target_hours INTEGER');
      console.log('Migration complete: goals.target_hours');
    }
  } catch (error) {
    console.error('Migration error (goals target_hours):', error);
  }

  // Migration: Add goal_id to task_preferences
  try {
    const tpInfo = database.pragma('table_info(task_preferences)');
    const hasGoalId = tpInfo.some((col: any) => col.name === 'goal_id');
    if (!hasGoalId) {
      console.log('Running migration: Adding goal_id column to task_preferences');
      database.exec('ALTER TABLE task_preferences ADD COLUMN goal_id TEXT');
      console.log('Migration complete: task_preferences.goal_id');
    }
  } catch (error) {
    console.error('Migration error (task_preferences goal_id):', error);
  }

  // Migration: Create shutdown_rituals table if it doesn't exist
  try {
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shutdown_rituals'").all();

    if (tables.length === 0) {
      console.log('Running migration: Creating shutdown_rituals table');
      database.exec(`
        CREATE TABLE shutdown_rituals (
          date TEXT PRIMARY KEY,
          total_minutes INTEGER NOT NULL,
          deep_work_minutes INTEGER NOT NULL,
          tasks_worked TEXT NOT NULL,
          reflection TEXT,
          notes TEXT,
          tomorrow_intentions TEXT,
          locked INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Migration complete: shutdown_rituals table created');
    }
  } catch (error) {
    console.error('Migration error (shutdown_rituals table):', error);
  }

  // Migration: Add archived, completed_at, description, subtasks to list_items
  try {
    const listItemsInfo = database.pragma('table_info(list_items)') as any[];
    if (listItemsInfo.length > 0) {
      if (!listItemsInfo.some((c: any) => c.name === 'archived'))
        database.exec('ALTER TABLE list_items ADD COLUMN archived INTEGER DEFAULT 0');
      if (!listItemsInfo.some((c: any) => c.name === 'completed_at'))
        database.exec('ALTER TABLE list_items ADD COLUMN completed_at DATETIME');
      if (!listItemsInfo.some((c: any) => c.name === 'description'))
        database.exec('ALTER TABLE list_items ADD COLUMN description TEXT');
      if (!listItemsInfo.some((c: any) => c.name === 'subtasks'))
        database.exec("ALTER TABLE list_items ADD COLUMN subtasks TEXT DEFAULT '[]'");
      if (!listItemsInfo.some((c: any) => c.name === 'billable'))
        database.exec('ALTER TABLE list_items ADD COLUMN billable INTEGER NOT NULL DEFAULT 1');
    }
  } catch (error) {
    console.error('Migration error (list_items extensions):', error);
  }

  // Migration: Add archived + billable to lists
  try {
    const listsInfo = database.pragma('table_info(lists)') as any[];
    if (listsInfo.length > 0) {
      if (!listsInfo.some((c: any) => c.name === 'archived'))
        database.exec('ALTER TABLE lists ADD COLUMN archived INTEGER DEFAULT 0');
      if (!listsInfo.some((c: any) => c.name === 'billable'))
        database.exec('ALTER TABLE lists ADD COLUMN billable INTEGER NOT NULL DEFAULT 1');
    }
  } catch (error) {
    console.error('Migration error (lists archived/billable):', error);
  }
}

function initializeDefaultSettings(database: Database.Database) {
  const defaultSettings = [
    { key: 'apiBaseUrl', value: 'https://es.easyproject.com' },
    { key: 'pomodoroFocus', value: '25' },
    { key: 'pomodoroShortBreak', value: '5' },
    { key: 'pomodoroLongBreak', value: '10' },
    { key: 'sessionsUntilLongBreak', value: '3' },
    { key: 'defaultBillable', value: 'true' },
    { key: 'roundingMode', value: 'none' }
  ];

  const insertStmt = database.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );

  for (const setting of defaultSettings) {
    insertStmt.run(setting.key, setting.value);
  }
}

function initializeDefaultTemplates(database: Database.Database) {
  const defaultTemplates = [
    { id: 'tpl-admin', name: 'Admin', task_id: '229602', default_duration: 15, billable: 0 },
    { id: 'tpl-meeting', name: 'Meeting', task_id: '138850', default_duration: 30, billable: 1 }
  ];

  const insertStmt = database.prepare(
    'INSERT OR IGNORE INTO log_templates (id, name, task_id, default_duration, billable) VALUES (?, ?, ?, ?, ?)'
  );

  for (const template of defaultTemplates) {
    insertStmt.run(template.id, template.name, template.task_id, template.default_duration, template.billable);
  }
}

export function getDB(): Database.Database {
  if (!db) {
    // Auto-initialize if not already initialized
    return initDB();
  }
  return db;
}

export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

// Session operations
export function saveSession(
  session: Omit<PomodoroSession, 'id'>
): string {
  const database = getDB();
  const id = uuidv4();

  const stmt = database.prepare(`
    INSERT INTO pomodoro_sessions
    (id, start_at, end_at, duration_minutes, task_id, source, comment, logged, billable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    session.start_at,
    session.end_at,
    session.duration_minutes,
    session.task_id,
    session.source,
    session.comment,
    session.logged,
    session.billable !== undefined ? (session.billable ? 1 : 0) : 1 // Default to billable=true
  );

  // Update task cache last_seen_at if task_id is provided
  if (session.task_id) {
    try {
      const updateStmt = database.prepare(`
        UPDATE task_cache
        SET last_seen_at = datetime('now')
        WHERE task_id = ?
      `);
      updateStmt.run(session.task_id);
    } catch (error) {
      console.error('Failed to update task cache timestamp:', error);
      // Don't fail the session save if cache update fails
    }
  }

  return id;
}

export function getSessions(date: string): PomodoroSession[] {
  const database = getDB();

  const stmt = database.prepare(`
    SELECT * FROM pomodoro_sessions
    WHERE date(start_at) = date(?)
    ORDER BY start_at DESC
  `);

  return stmt.all(date) as PomodoroSession[];
}

export function getLastSessionWithTask(date: string): PomodoroSession | null {
  const database = getDB();

  const stmt = database.prepare(`
    SELECT * FROM pomodoro_sessions
    WHERE date(start_at) = date(?)
      AND source != 'break'
      AND (task_id IS NOT NULL OR comment IS NOT NULL)
    ORDER BY start_at DESC
    LIMIT 1
  `);

  return (stmt.get(date) as PomodoroSession) || null;
}

export function getAllSessionsForToday(): PomodoroSession[] {
  const database = getDB();
  const today = new Date().toISOString().split('T')[0];

  return getSessions(today);
}

// Get sessions within a date range (for dashboard)
export function getSessionsInRange(startDate: string, endDate: string): PomodoroSession[] {
  const database = getDB();

  const stmt = database.prepare(`
    SELECT * FROM pomodoro_sessions
    WHERE date(start_at) BETWEEN date(?) AND date(?)
    ORDER BY start_at ASC
  `);

  return stmt.all(startDate, endDate) as PomodoroSession[];
}

export function updateSession(
  id: string,
  updates: Partial<PomodoroSession>
): void {
  const database = getDB();

  const fields = Object.keys(updates)
    .map(key => `${key} = ?`)
    .join(', ');

  const values = Object.values(updates);
  values.push(id);

  const stmt = database.prepare(`
    UPDATE pomodoro_sessions
    SET ${fields}
    WHERE id = ?
  `);

  stmt.run(...values);
}

export function deleteSession(id: string): void {
  const database = getDB();

  const stmt = database.prepare(`
    DELETE FROM pomodoro_sessions
    WHERE id = ?
  `);

  stmt.run(id);
}

// Settings operations
export function getSetting(key: string): string | null {
  const database = getDB();

  const stmt = database.prepare(
    'SELECT value FROM settings WHERE key = ?'
  );

  const result = stmt.get(key) as Setting | undefined;
  return result?.value ?? null;
}

export function saveSetting(key: string, value: string): void {
  const database = getDB();

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?)
  `);

  stmt.run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const database = getDB();

  const stmt = database.prepare('SELECT key, value FROM settings');
  const rows = stmt.all() as Setting[];

  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as Record<string, string>);
}

// Task cache operations
export function cacheTask(
  taskId: string,
  title: string,
  projectId: number,
  projectName: string
): void {
  const database = getDB();

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO task_cache
    (task_id, title, project_id, project_name, last_seen_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(taskId, title, projectId, projectName);
}

export function getCachedTask(taskId: string) {
  const database = getDB();

  const stmt = database.prepare(
    'SELECT * FROM task_cache WHERE task_id = ?'
  );

  return stmt.get(taskId);
}

export function getAllCachedTasks() {
  const database = getDB();

  const stmt = database.prepare(`
    SELECT * FROM task_cache
    ORDER BY last_seen_at DESC
    LIMIT 50
  `);

  return stmt.all();
}

export function getRecentTasks() {
  const database = getDB();

  const stmt = database.prepare(`
    SELECT task_id, title FROM task_cache
    ORDER BY last_seen_at DESC
    LIMIT 10
  `);

  return stmt.all();
}

// Adhoc entry operations
export function addAdhocEntry(
  entry: Omit<import('../types').AdhocEntry, 'id' | 'created_at'>
): string {
  const database = getDB();
  const id = uuidv4();

  const stmt = database.prepare(`
    INSERT INTO adhoc_entries
    (id, date, duration_minutes, title, task_id, is_todo, due_date, completed, marked_to_log, logged, comment, billable, start_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    entry.date,
    entry.duration_minutes,
    entry.title,
    entry.task_id,
    entry.is_todo || 0,
    entry.due_date || null,
    entry.completed || 0,
    entry.marked_to_log || 1,
    entry.logged || 0,
    entry.comment,
    entry.billable !== undefined ? (entry.billable ? 1 : 0) : 1, // Default to billable=true
    entry.start_time || null
  );

  return id;
}

export function getAdhocEntries(date: string) {
  const database = getDB();

  const stmt = database.prepare(`
    SELECT * FROM adhoc_entries
    WHERE date = ?
    ORDER BY created_at DESC
  `);

  return stmt.all(date);
}

// Get adhoc entries within a date range (for dashboard)
export function getAdhocEntriesInRange(startDate: string, endDate: string) {
  const database = getDB();

  const stmt = database.prepare(`
    SELECT * FROM adhoc_entries
    WHERE date BETWEEN ? AND ?
    ORDER BY date ASC, created_at ASC
  `);

  return stmt.all(startDate, endDate);
}

export function updateAdhocEntry(
  id: string,
  updates: Partial<import('../types').AdhocEntry>
): void {
  const database = getDB();

  const fields = Object.keys(updates)
    .filter(key => key !== 'id' && key !== 'created_at')
    .map(key => `${key} = ?`)
    .join(', ');

  if (!fields) return;

  const values = Object.keys(updates)
    .filter(key => key !== 'id' && key !== 'created_at')
    .map(key => updates[key as keyof typeof updates]);
  values.push(id);

  const stmt = database.prepare(`
    UPDATE adhoc_entries
    SET ${fields}
    WHERE id = ?
  `);

  stmt.run(...values);
}

export function deleteAdhocEntry(id: string): void {
  const database = getDB();

  const stmt = database.prepare(`
    DELETE FROM adhoc_entries
    WHERE id = ?
  `);

  stmt.run(id);
}

// Calendar proposal operations
export function getCalendarProposals(date: string, includeAll: boolean = false) {
  const database = getDB();

  const whereClause = includeAll
    ? 'WHERE date = ?'
    : 'WHERE date = ? AND dismissed = 0';

  const stmt = database.prepare(`
    SELECT * FROM calendar_proposals
    ${whereClause}
    ORDER BY start_at ASC
  `);

  return stmt.all(date);
}

export function addCalendarProposal(proposal: any): string {
  const database = getDB();
  const id = uuidv4();

  const stmt = database.prepare(`
    INSERT INTO calendar_proposals
    (id, event_uid, title, start_at, end_at, duration_minutes, date, accepted, dismissed, task_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    proposal.event_uid,
    proposal.title,
    proposal.start_at,
    proposal.end_at,
    proposal.duration_minutes,
    proposal.date,
    proposal.accepted || 0,
    proposal.dismissed || 0,
    proposal.task_id || null
  );

  return id;
}

export function updateCalendarProposal(id: string, updates: any): void {
  const database = getDB();

  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.start_at !== undefined) {
    fields.push('start_at = ?');
    values.push(updates.start_at);
  }
  if (updates.end_at !== undefined) {
    fields.push('end_at = ?');
    values.push(updates.end_at);
  }
  if (updates.duration_minutes !== undefined) {
    fields.push('duration_minutes = ?');
    values.push(updates.duration_minutes);
  }
  if (updates.accepted !== undefined) {
    fields.push('accepted = ?');
    values.push(updates.accepted);
  }
  if (updates.dismissed !== undefined) {
    fields.push('dismissed = ?');
    values.push(updates.dismissed);
  }
  if (updates.task_id !== undefined) {
    fields.push('task_id = ?');
    values.push(updates.task_id);
  }
  if (updates.comment !== undefined) {
    fields.push('comment = ?');
    values.push(updates.comment);
  }
  if (updates.date !== undefined) {
    fields.push('date = ?');
    values.push(updates.date);
  }
  if (updates.logged !== undefined) {
    fields.push('logged = ?');
    values.push(updates.logged);
  }

  if (fields.length === 0) return;

  values.push(id);

  const stmt = database.prepare(`
    UPDATE calendar_proposals
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);
}

export function acceptCalendarProposal(id: string, taskId?: string): void {
  updateCalendarProposal(id, {
    accepted: 1,
    task_id: taskId || null
  });
}

export function dismissCalendarProposal(id: string): void {
  updateCalendarProposal(id, { dismissed: 1 });
}

// Template operations
export function getTemplates() {
  const database = getDB();

  const stmt = database.prepare(`
    SELECT * FROM log_templates
    ORDER BY created_at ASC
  `);

  return stmt.all();
}

export function addTemplate(
  template: { name: string; task_id: string; default_duration?: number; billable?: boolean; comment?: string }
): string {
  const database = getDB();
  const id = `tpl-${Date.now()}`;

  const stmt = database.prepare(`
    INSERT INTO log_templates (id, name, task_id, default_duration, billable, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    template.name,
    template.task_id,
    template.default_duration || null,
    template.billable !== undefined ? (template.billable ? 1 : 0) : 1,
    template.comment || null
  );

  return id;
}

export function updateTemplate(
  id: string,
  template: { name: string; task_id: string; default_duration?: number; billable?: boolean; comment?: string }
): void {
  const database = getDB();

  const stmt = database.prepare(`
    UPDATE log_templates
    SET name = ?, task_id = ?, default_duration = ?, billable = ?, comment = ?
    WHERE id = ?
  `);

  stmt.run(
    template.name,
    template.task_id,
    template.default_duration || null,
    template.billable !== undefined ? (template.billable ? 1 : 0) : 1,
    template.comment || null,
    id
  );
}

export function deleteTemplate(id: string): void {
  const database = getDB();

  const stmt = database.prepare(`
    DELETE FROM log_templates
    WHERE id = ?
  `);

  stmt.run(id);
}

// Get days since last logged entry
export function getDaysSinceLastLog(): number | null {
  const database = getDB();

  // Find most recent logged entry from both pomodoro_sessions and adhoc_entries
  const lastPomodoroStmt = database.prepare(`
    SELECT date(start_at) as last_date
    FROM pomodoro_sessions
    WHERE logged = 1
    ORDER BY start_at DESC
    LIMIT 1
  `);

  const lastAdhocStmt = database.prepare(`
    SELECT date
    FROM adhoc_entries
    WHERE logged = 1
    ORDER BY date DESC
    LIMIT 1
  `);

  const lastPomodoro = lastPomodoroStmt.get() as { last_date?: string } | undefined;
  const lastAdhoc = lastAdhocStmt.get() as { date?: string } | undefined;

  // Get the most recent date between the two
  let lastLoggedDate: string | null = null;

  if (lastPomodoro?.last_date && lastAdhoc?.date) {
    lastLoggedDate = lastPomodoro.last_date > lastAdhoc.date ? lastPomodoro.last_date : lastAdhoc.date;
  } else if (lastPomodoro?.last_date) {
    lastLoggedDate = lastPomodoro.last_date;
  } else if (lastAdhoc?.date) {
    lastLoggedDate = lastAdhoc.date;
  }

  if (!lastLoggedDate) {
    return null; // No logged entries found
  }

  // Calculate days between last logged date and today
  const lastDate = new Date(lastLoggedDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day
  lastDate.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

// ==================== TASK PREFERENCES ====================

export function getTaskPreference(taskId: string): TaskPreference | null {
  const database = getDB();
  const row = database.prepare('SELECT * FROM task_preferences WHERE task_id = ?').get(taskId) as any;
  if (!row) return null;

  return {
    taskId: row.task_id,
    tracked: Boolean(row.tracked),
    pinned: Boolean(row.pinned),
    milestoneIds: JSON.parse(row.milestone_ids),
    goalId: row.goal_id || undefined
  };
}

export function getAllTaskPreferences(): TaskPreference[] {
  const database = getDB();
  const rows = database.prepare('SELECT * FROM task_preferences').all() as any[];
  return rows.map(row => ({
    taskId: row.task_id,
    tracked: Boolean(row.tracked),
    pinned: Boolean(row.pinned),
    milestoneIds: JSON.parse(row.milestone_ids),
    goalId: row.goal_id || undefined
  }));
}

export function setTaskPreference(taskId: string, pref: Partial<TaskPreference>): void {
  const database = getDB();
  database.prepare(`
    INSERT INTO task_preferences (task_id, tracked, pinned, milestone_ids, goal_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET
      tracked = excluded.tracked,
      pinned = excluded.pinned,
      milestone_ids = excluded.milestone_ids,
      goal_id = excluded.goal_id,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    taskId,
    pref.tracked ? 1 : 0,
    pref.pinned ? 1 : 0,
    JSON.stringify(pref.milestoneIds || []),
    pref.goalId || null
  );
}

export function setTaskGoalId(taskId: string, goalId: string | null): void {
  const database = getDB();
  database.prepare(`
    UPDATE task_preferences SET goal_id = ?, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?
  `).run(goalId, taskId);
}

// ==================== MILESTONES ====================

export function getMilestone(id: string): Milestone | null {
  const database = getDB();
  const row = database.prepare('SELECT * FROM milestones WHERE id = ?').get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    parentType: row.parent_type,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    completed: Boolean(row.completed),
    order: row.order_num,
    weight: row.weight
  };
}

export function getMilestonesByParent(parentType: string, parentId: string): Milestone[] {
  const database = getDB();
  const rows = database.prepare(
    'SELECT * FROM milestones WHERE parent_type = ? AND parent_id = ? ORDER BY order_num'
  ).all(parentType, parentId) as any[];

  return rows.map(row => ({
    id: row.id,
    parentType: row.parent_type,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    completed: Boolean(row.completed),
    order: row.order_num,
    weight: row.weight
  }));
}

export function createMilestone(milestone: Milestone): void {
  const database = getDB();
  database.prepare(`
    INSERT INTO milestones (id, parent_type, parent_id, title, description, completed, order_num, weight)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    milestone.id,
    milestone.parentType,
    milestone.parentId,
    milestone.title,
    milestone.description || null,
    milestone.completed ? 1 : 0,
    milestone.order,
    milestone.weight || null
  );
}

export function updateMilestone(id: string, patch: Partial<Milestone>): void {
  const database = getDB();
  const fields: string[] = [];
  const values: any[] = [];

  if (patch.title !== undefined) { fields.push('title = ?'); values.push(patch.title); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.completed !== undefined) { fields.push('completed = ?'); values.push(patch.completed ? 1 : 0); }
  if (patch.order !== undefined) { fields.push('order_num = ?'); values.push(patch.order); }
  if (patch.weight !== undefined) { fields.push('weight = ?'); values.push(patch.weight); }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  database.prepare(`UPDATE milestones SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteMilestone(id: string): void {
  const database = getDB();
  database.prepare('DELETE FROM milestones WHERE id = ?').run(id);
}

// ==================== GOALS ====================

export function getGoal(id: string): Goal | null {
  const database = getDB();
  const row = database.prepare('SELECT * FROM goals WHERE id = ?').get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    identityReinforcement: row.identity_reinforcement,
    milestoneIds: JSON.parse(row.milestone_ids),
    active: Boolean(row.active),
    targetHours: row.target_hours ?? undefined
  };
}

export function getAllGoals(): Goal[] {
  const database = getDB();
  const rows = database.prepare('SELECT * FROM goals ORDER BY active DESC, created_at DESC').all() as any[];
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    identityReinforcement: row.identity_reinforcement,
    milestoneIds: JSON.parse(row.milestone_ids),
    active: Boolean(row.active),
    targetHours: row.target_hours ?? undefined
  }));
}

export function getActiveGoal(): Goal | null {
  const database = getDB();
  const row = database.prepare('SELECT * FROM goals WHERE active = 1').get() as any;
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    identityReinforcement: row.identity_reinforcement,
    milestoneIds: JSON.parse(row.milestone_ids),
    active: true,
    targetHours: row.target_hours ?? undefined
  };
}

export function createGoal(goal: Goal): void {
  const database = getDB();
  database.prepare(`
    INSERT INTO goals (id, title, description, identity_reinforcement, milestone_ids, active, target_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    goal.id,
    goal.title,
    goal.description,
    goal.identityReinforcement || null,
    JSON.stringify(goal.milestoneIds),
    goal.active ? 1 : 0,
    goal.targetHours ?? null
  );
}

export function updateGoal(id: string, patch: Partial<Goal>): void {
  const database = getDB();
  const fields: string[] = [];
  const values: any[] = [];

  if (patch.title !== undefined) { fields.push('title = ?'); values.push(patch.title); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.identityReinforcement !== undefined) { fields.push('identity_reinforcement = ?'); values.push(patch.identityReinforcement); }
  if (patch.milestoneIds !== undefined) { fields.push('milestone_ids = ?'); values.push(JSON.stringify(patch.milestoneIds)); }
  if (patch.active !== undefined) { fields.push('active = ?'); values.push(patch.active ? 1 : 0); }
  if (patch.targetHours !== undefined) { fields.push('target_hours = ?'); values.push(patch.targetHours ?? null); }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  database.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function setActiveGoal(id: string): void {
  const database = getDB();
  database.prepare('UPDATE goals SET active = 0').run();
  database.prepare('UPDATE goals SET active = 1 WHERE id = ?').run(id);
}

// ==================== DAILY INTENTIONS ====================

export function getDailyIntentions(date: string): DailyIntentions | null {
  const database = getDB();
  const row = database.prepare('SELECT * FROM daily_intentions WHERE date = ?').get(date) as any;
  if (!row) return null;

  return {
    date: row.date,
    intentions: JSON.parse(row.intentions)
  };
}

export function setDailyIntentions(date: string, intentions: string[]): void {
  const database = getDB();
  database.prepare(`
    INSERT INTO daily_intentions (date, intentions)
    VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET
      intentions = excluded.intentions,
      updated_at = CURRENT_TIMESTAMP
  `).run(date, JSON.stringify(intentions));
}

// ==================== SHUTDOWN RITUALS ====================

export function getShutdownRitual(date: string): ShutdownRitual | null {
  const database = getDB();
  const row = database.prepare('SELECT * FROM shutdown_rituals WHERE date = ?').get(date) as any;
  if (!row) return null;

  return {
    date: row.date,
    totalMinutes: row.total_minutes,
    deepWorkMinutes: row.deep_work_minutes,
    tasksWorked: JSON.parse(row.tasks_worked),
    reflection: row.reflection,
    notes: row.notes,
    tomorrowIntentions: row.tomorrow_intentions ? JSON.parse(row.tomorrow_intentions) : null,
    locked: row.locked === 1,
    createdAt: row.created_at
  };
}

export function saveShutdownRitual(
  date: string,
  totalMinutes: number,
  deepWorkMinutes: number,
  tasksWorked: string[],
  reflection: string | null,
  notes: string | null,
  tomorrowIntentions: string[] | null
): void {
  const database = getDB();
  database.prepare(`
    INSERT INTO shutdown_rituals (
      date, total_minutes, deep_work_minutes, tasks_worked,
      reflection, notes, tomorrow_intentions, locked
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(date) DO UPDATE SET
      total_minutes = excluded.total_minutes,
      deep_work_minutes = excluded.deep_work_minutes,
      tasks_worked = excluded.tasks_worked,
      reflection = excluded.reflection,
      notes = excluded.notes,
      tomorrow_intentions = excluded.tomorrow_intentions,
      locked = 1
  `).run(
    date,
    totalMinutes,
    deepWorkMinutes,
    JSON.stringify(tasksWorked),
    reflection,
    notes,
    tomorrowIntentions ? JSON.stringify(tomorrowIntentions) : null
  );
}

export function unlockDay(date: string): void {
  const database = getDB();
  database.prepare('UPDATE shutdown_rituals SET locked = 0 WHERE date = ?').run(date);
}

export function isDayLocked(date: string): boolean {
  const database = getDB();
  const row = database.prepare('SELECT locked FROM shutdown_rituals WHERE date = ?').get(date) as any;
  return row ? row.locked === 1 : false;
}

// ==================== LISTS ====================

export function getLists(): TaskList[] {
  const database = getDB();
  return database.prepare('SELECT * FROM lists WHERE archived = 0 ORDER BY "order" ASC, created_at ASC').all() as TaskList[];
}

export function getArchivedLists(): TaskList[] {
  const database = getDB();
  return database.prepare('SELECT * FROM lists WHERE archived = 1 ORDER BY "order" ASC').all() as TaskList[];
}

export function archiveList(id: string): void {
  const database = getDB();
  database.prepare('UPDATE lists SET archived = 1 WHERE id = ?').run(id);
}

export function unarchiveList(id: string): void {
  const database = getDB();
  database.prepare('UPDATE lists SET archived = 0 WHERE id = ?').run(id);
}

export function archiveOldCompleted(): number {
  const database = getDB();
  const result = database.prepare(
    "UPDATE list_items SET archived = 1 WHERE completed = 1 AND completed_at IS NOT NULL AND completed_at < datetime('now', '-7 days') AND archived = 0"
  ).run();
  return result.changes;
}

export function reorderItemsInColumn(listId: string, column: string): void {
  const database = getDB();
  const items = database.prepare(
    'SELECT id FROM list_items WHERE list_id = ? AND "column" = ? ORDER BY "order" ASC'
  ).all(listId, column) as Array<{ id: string }>;
  const stmt = database.prepare('UPDATE list_items SET "order" = ? WHERE id = ?');
  items.forEach((item, i) => stmt.run(i, item.id));
}

export function createList(list: Omit<TaskList, 'id' | 'created_at'>): string {
  const database = getDB();
  const id = uuidv4();
  database.prepare(
    'INSERT INTO lists (id, name, color, icon_path, task_id, "order", billable) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, list.name, list.color, list.icon_path, list.task_id, list.order, list.billable ?? 1);
  return id;
}

export function updateList(id: string, updates: Partial<TaskList>): void {
  const database = getDB();
  const allowed = ['name', 'color', 'icon_path', 'task_id', 'order', 'archived', 'billable'] as const;
  const sets: string[] = [];
  const values: any[] = [];
  for (const key of allowed) {
    if (key in updates) {
      sets.push(key === 'order' ? `"order" = ?` : `${key} = ?`);
      values.push(updates[key as keyof TaskList]);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  database.prepare(`UPDATE lists SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteList(id: string): void {
  const database = getDB();
  database.prepare('DELETE FROM list_items WHERE list_id = ?').run(id);
  database.prepare('DELETE FROM lists WHERE id = ?').run(id);
}

export function getListItems(listId: string): ListItem[] {
  const database = getDB();
  return database.prepare(
    'SELECT * FROM list_items WHERE list_id = ? ORDER BY "column" ASC, "order" ASC'
  ).all(listId) as ListItem[];
}

export function getAllListItems(): ListItem[] {
  const database = getDB();
  return database.prepare('SELECT * FROM list_items ORDER BY "order" ASC').all() as ListItem[];
}

export function createListItem(item: Omit<ListItem, 'id' | 'created_at'>): string {
  const database = getDB();
  const id = uuidv4();
  database.prepare(
    'INSERT INTO list_items (id, list_id, title, task_id, "column", "order", completed, billable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, item.list_id, item.title, item.task_id, item.column, item.order, item.completed, item.billable ?? 1);
  return id;
}

export function updateListItem(id: string, updates: Partial<ListItem>): void {
  const database = getDB();
  // Auto-set completed_at when toggling completed
  if ('completed' in updates) {
    if (updates.completed === 1 && !('completed_at' in updates)) {
      updates.completed_at = new Date().toISOString();
    } else if (updates.completed === 0) {
      updates.completed_at = null;
      updates.archived = 0;
    }
  }
  const allowed = ['title', 'task_id', 'column', 'order', 'completed', 'archived', 'completed_at', 'description', 'subtasks', 'billable'] as const;
  const sets: string[] = [];
  const values: any[] = [];
  for (const key of allowed) {
    if (key in updates) {
      sets.push(key === 'order' || key === 'column' ? `"${key}" = ?` : `${key} = ?`);
      values.push(updates[key as keyof ListItem]);
    }
  }
  if (sets.length === 0) return;
  values.push(id);
  database.prepare(`UPDATE list_items SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteListItem(id: string): void {
  const database = getDB();
  database.prepare('DELETE FROM list_items WHERE id = ?').run(id);
}

/**
 * Resolve the billable default for a Task ID. Most specific wins:
 *   list item (most recent match) -> parent list -> global `defaultBillable` setting.
 * Returns true when no match and no setting (matching the historic default).
 */
export function getBillableDefaultForTask(taskId: string | null | undefined): boolean {
  if (!taskId) {
    return getSetting('defaultBillable') !== 'false';
  }
  const database = getDB();

  const item = database.prepare(
    'SELECT billable FROM list_items WHERE task_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(taskId) as { billable: number } | undefined;
  if (item) return item.billable !== 0;

  const list = database.prepare(
    'SELECT billable FROM lists WHERE task_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(taskId) as { billable: number } | undefined;
  if (list) return list.billable !== 0;

  return getSetting('defaultBillable') !== 'false';
}
