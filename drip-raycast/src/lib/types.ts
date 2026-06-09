export interface TimerStatePayload {
  status: "idle" | "focus" | "break";
  remainingSeconds: number;
  startTime: string | null;
  totalDuration: number;
  taskId: string | null;
  paused: boolean;
  pendingBreak?: {
    durationMinutes: 5 | 10;
    isLong: boolean;
    taskId: string | null;
  };
}

export interface TaskCache {
  task_id: string;
  title: string;
  project_id: number;
  project_name: string | null;
  last_seen_at: string;
}

export interface PomodoroSession {
  id: string;
  start_at: string;
  end_at: string | null;
  duration_minutes: number;
  task_id: string | null;
  source: "pomodoro" | "manual" | "calendar" | "break";
  comment: string | null;
  logged: number;
  log_sent_at: string | null;
  server_entry_id: number | null;
  billable: number;
}

export interface AdhocEntry {
  id: string;
  created_at: string;
  date: string;
  duration_minutes: number;
  title: string;
  task_id: string | null;
  is_todo: number;
  due_date: string | null;
  completed: number;
  marked_to_log: number;
  logged: number;
  comment: string | null;
}

export interface CalendarProposal {
  id: string;
  event_uid: string;
  title: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  date: string;
  accepted: number;
  dismissed: number;
  task_id: string | null;
}

export interface DailyIntention {
  text: string;
  completed: boolean;
  taskId?: string;
}

export interface WeeklySummary {
  week_start: string;
  total_minutes: number;
  deep_work_minutes: number;
  sessions_completed: number;
  sessions_started: number;
  avg_session_minutes: number;
  peak_hour: number;
  morning_minutes: number;
  afternoon_minutes: number;
  evening_minutes: number;
  tasks_touched: number;
  reflections_count: number;
}

export interface DripList {
  id: string;
  name: string;
  color: string;
  task_id: string | null;
  order: number;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface DripListItem {
  id: string;
  list_id: string;
  title: string;
  task_id: string | null;
  column: "backlog" | "this_week" | "today";
  order: number;
  completed: number;
  list_name: string;
  list_color: string;
  list_task_id: string | null;
  subtasks: string | null;
}

/** A unified entry for display in Today's Log and Log Unlogged */
export interface UnifiedEntry {
  id: string;
  type: "session" | "adhoc" | "calendar";
  title: string;
  duration_minutes: number;
  task_id: string | null;
  logged: boolean;
  billable: boolean;
  comment: string | null;
  time: string; // HH:MM display
  date: string;
  project_id?: number;
}
