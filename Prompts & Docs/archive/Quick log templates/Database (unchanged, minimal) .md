CREATE TABLE IF NOT EXISTS log_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  task_id TEXT NOT NULL,
  default_duration INTEGER DEFAULT 30,
  billable INTEGER DEFAULT 1
);

-- Seed
INSERT INTO log_templates (id, name, task_id, default_duration, billable) VALUES
  ('tpl-1', 'Admin', '229602', 15, 0),
  ('tpl-2', 'Meeting', '138850', 30, 1);
```

**Removed**: `task_title`, `project_id`, `default_comment`, `sort_order`, `created_at` — not needed for MVP.

---

### Component Structure
```
DailyLog.tsx
└── QuickLogBar.tsx        ← New (simple)
    └── AddTemplateModal.tsx  ← New (simple form)