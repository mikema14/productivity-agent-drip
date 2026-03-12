-- database/schema.sql

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
  billable INTEGER DEFAULT 1,
  FOREIGN KEY (task_id) REFERENCES task_cache(task_id)
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
  start_time TEXT,
  FOREIGN KEY (task_id) REFERENCES task_cache(task_id)
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
  comment TEXT,
  FOREIGN KEY (task_id) REFERENCES task_cache(task_id)
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

-- Task Preferences: User's tracking configuration per task
CREATE TABLE IF NOT EXISTS task_preferences (
  task_id TEXT PRIMARY KEY,
  tracked INTEGER DEFAULT 0,
  pinned INTEGER DEFAULT 0,
  milestone_ids TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES task_cache(task_id)
);

-- Milestones: Progress markers for tasks and goals
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

-- Goals: High-level objectives with identity reinforcement
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

-- Daily Intentions: Daily focus items
CREATE TABLE IF NOT EXISTS daily_intentions (
  date TEXT PRIMARY KEY,
  intentions TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shutdown Rituals: End-of-day closure with review and reflection
CREATE TABLE IF NOT EXISTS shutdown_rituals (
  date TEXT PRIMARY KEY,
  total_minutes INTEGER NOT NULL,
  deep_work_minutes INTEGER NOT NULL,
  tasks_worked TEXT NOT NULL,  -- JSON array of task IDs
  reflection TEXT,
  notes TEXT,                   -- Practical reminders for tomorrow
  tomorrow_intentions TEXT,    -- JSON array of 1-3 bullets
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_date ON pomodoro_sessions(date(start_at));
CREATE INDEX IF NOT EXISTS idx_sessions_logged ON pomodoro_sessions(logged);
CREATE INDEX IF NOT EXISTS idx_adhoc_date ON adhoc_entries(date);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_proposals(date);
CREATE INDEX IF NOT EXISTS idx_milestones_parent ON milestones(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_milestones_completed ON milestones(completed);
CREATE INDEX IF NOT EXISTS idx_task_prefs_tracked ON task_preferences(tracked);
CREATE INDEX IF NOT EXISTS idx_goals_active ON goals(active);
CREATE INDEX IF NOT EXISTS idx_rituals_locked ON shutdown_rituals(locked);
