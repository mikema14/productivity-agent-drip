# Productivity Agent - Phase 2.0 Development

## Overview

This document covers the next development phase. Apply these features to the existing codebase.

**Priority Order:**
- Phase A: Core UX Fixes
- Phase B: Task Intelligence  
- Phase C: Efficiency Features (Templates & Mappings)
- Phase D: Polish

---

## Phase A: Core UX Fixes

### A1. Delete Entry (Unlogged Only)

**Behavior:**
- Show delete button (trash icon) on entry rows where `logged === false`
- Hide delete button for logged entries (already sent to API)
- Confirm before delete: "Delete this entry?"

**Implementation:**

```typescript
// In EntryRow.tsx or equivalent
{!entry.logged && (
  <button 
    onClick={() => handleDelete(entry.id)}
    className="text-red-500 hover:text-red-700"
    title="Delete entry"
  >
    <TrashIcon className="w-4 h-4" />
  </button>
)}
```

```typescript
// In logStore.ts
deleteEntry: async (id: string) => {
  const entry = get().entries.find(e => e.id === id);
  
  // Guard: don't delete logged entries
  if (entry?.logged) {
    console.warn('Cannot delete logged entry');
    return;
  }
  
  // Delete from DB
  await db.run('DELETE FROM pomodoro_sessions WHERE id = ?', [id]);
  await db.run('DELETE FROM adhoc_entries WHERE id = ?', [id]);
  
  // Reload (skip calendar sync)
  await get().loadDay(get().selectedDate, true);
}
```

---

### A2. Billable Toggle Per Entry

**Behavior:**
- Each entry row has a clickable checkbox/toggle for billable status
- Default value from settings (`defaultBillable`)
- Persists to DB on change
- Sends correct `easy_is_billable` value when logging

**Implementation:**

```typescript
// In EntryRow.tsx
<input
  type="checkbox"
  checked={entry.billable}
  onChange={(e) => updateEntry(entry.id, { billable: e.target.checked })}
  className="w-4 h-4"
  title="Billable"
/>
```

```typescript
// In logStore.ts updateEntry
updateEntry: async (id: string, changes: Partial<LogEntry>) => {
  // Update in appropriate table based on source
  if (changes.billable !== undefined) {
    await db.run(
      'UPDATE pomodoro_sessions SET billable = ? WHERE id = ?',
      [changes.billable ? 1 : 0, id]
    );
    await db.run(
      'UPDATE adhoc_entries SET billable = ? WHERE id = ?', 
      [changes.billable ? 1 : 0, id]
    );
  }
  // ... handle other changes
  await get().loadDay(get().selectedDate, true);
}
```

**DB Migration** - Add billable column if missing:

```sql
ALTER TABLE pomodoro_sessions ADD COLUMN billable INTEGER DEFAULT 1;
ALTER TABLE adhoc_entries ADD COLUMN billable INTEGER DEFAULT 1;
```

---

### A3. Finish Pomodoro Early Button

**Behavior:**
- During active focus session, show "Finish Early" button alongside Pause/Cancel
- Clicking it:
  1. Stops timer immediately
  2. Calculates actual elapsed time
  3. Creates session record with actual duration (not full 25 min)
  4. Proceeds to break as normal

**Implementation:**

```typescript
// In timerStore.ts
finishEarly: () => {
  const { status, startedAt, currentTaskId } = get();
  
  if (status !== 'focus') return;
  
  const now = new Date();
  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedMinutes = Math.ceil(elapsedMs / 60000); // Round up
  
  // Create session with actual duration
  const session = {
    id: crypto.randomUUID(),
    startAt: startedAt.toISOString(),
    endAt: now.toISOString(),
    durationMinutes: elapsedMinutes,
    taskId: currentTaskId,
    source: 'pomodoro',
    logged: false,
    billable: true // from settings default
  };
  
  // Save to DB
  saveSession(session);
  
  // Increment session count, start break
  set(state => ({ 
    sessionCount: state.sessionCount + 1,
    status: 'idle' // or auto-start break
  }));
  
  // Show notification
  showNotification(`Session complete: ${elapsedMinutes} minutes logged`);
}
```

```typescript
// In Timer.tsx
{status === 'focus' && (
  <button onClick={finishEarly} className="btn-secondary">
    Finish Early
  </button>
)}
```

---

### A4. Auto-Merge Entries by Task ID

**Behavior:**
- In Daily Log view, entries with the same Task ID are automatically combined
- Display shows merged duration (25 + 25 = 50 min)
- Individual sessions preserved in DB (for audit trail)
- When logging, POST the merged total

**Implementation:**

```typescript
// In logStore.ts or a utility function
function mergeEntriesByTask(entries: LogEntry[]): MergedEntry[] {
  const grouped = new Map<string, LogEntry[]>();
  
  entries.forEach(entry => {
    const key = entry.taskId || `unassigned-${entry.id}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  });
  
  return Array.from(grouped.entries()).map(([taskId, group]) => {
    // For unassigned, don't merge
    if (taskId.startsWith('unassigned-')) {
      return {
        ...group[0],
        isMerged: false,
        sourceEntries: [group[0]]
      };
    }
    
    // Merge entries with same Task ID
    const totalMinutes = group.reduce((sum, e) => sum + e.durationMinutes, 0);
    const comments = group
      .map(e => e.comment)
      .filter(Boolean)
      .join('; ');
    
    return {
      id: `merged-${taskId}`,
      taskId: taskId === 'null' ? null : taskId,
      taskTitle: group[0].taskTitle,
      projectId: group[0].projectId,
      durationMinutes: totalMinutes,
      comment: comments || group[0].comment,
      billable: group.some(e => e.billable), // billable if any is billable
      logged: group.every(e => e.logged),
      isMerged: group.length > 1,
      sourceEntries: group,
      sourceCount: group.length
    };
  });
}
```

```typescript
// In DailyLog.tsx
const mergedEntries = useMemo(
  () => mergeEntriesByTask(entries),
  [entries]
);

// Display merged entry
{entry.isMerged && (
  <span className="text-xs text-gray-500">
    ({entry.sourceCount} sessions)
  </span>
)}
```

---

## Phase B: Task Intelligence

### B1. Auto-Fetch Task Details on ID Entry

**Behavior:**
- When user types/pastes Task ID in Add Entry modal OR Pomodoro task input
- After ID is complete (debounce 500ms), fetch from API
- Show loading spinner while fetching
- Display task title below input
- Cache result for future use

**Implementation:**

```typescript
// In a custom hook: useTaskLookup.ts
export function useTaskLookup(taskId: string | null) {
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!taskId || taskId.length < 3) {
      setTask(null);
      return;
    }
    
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Check cache first
        const cached = await db.get(
          'SELECT * FROM task_cache WHERE task_id = ?',
          [taskId]
        );
        
        if (cached) {
          setTask(cached);
          setLoading(false);
          return;
        }
        
        // Fetch from API
        const result = await getIssue(taskId);
        setTask(result);
      } catch (err) {
        setError(err.message);
        setTask(null);
      } finally {
        setLoading(false);
      }
    }, 500); // Debounce
    
    return () => clearTimeout(timer);
  }, [taskId]);
  
  return { task, loading, error };
}
```

```typescript
// In AddEntryModal.tsx or Timer.tsx
const { task, loading, error } = useTaskLookup(taskId);

<input
  value={taskId}
  onChange={(e) => setTaskId(e.target.value)}
  placeholder="Task ID"
/>
{loading && <Spinner className="w-4 h-4" />}
{task && <span className="text-sm text-gray-600">{task.title}</span>}
{error && <span className="text-sm text-red-500">{error}</span>}
```

---

### B2. Show Task Title in Entry Row

**Behavior:**
- Entry row displays task title (from cache) alongside Task ID
- Format: "643749 - Feature Development" or just title if ID is visible elsewhere

**Implementation:**

```typescript
// In EntryRow.tsx
<div className="flex flex-col">
  <span className="font-mono text-sm">{entry.taskId}</span>
  {entry.taskTitle && (
    <span className="text-xs text-gray-500 truncate max-w-48">
      {entry.taskTitle}
    </span>
  )}
</div>
```

---

### B3. Task ID Autocomplete from Cache

**Behavior:**
- Task ID input shows dropdown of recently used tasks
- Filter as user types
- Show: ID + Title
- Click to select

**Implementation:**

```typescript
// In TaskIdInput.tsx (new component)
export function TaskIdInput({ value, onChange }) {
  const [suggestions, setSuggestions] = useState<TaskData[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  useEffect(() => {
    // Load recent tasks from cache
    const loadSuggestions = async () => {
      const tasks = await db.all(`
        SELECT * FROM task_cache 
        ORDER BY last_seen_at DESC 
        LIMIT 20
      `);
      setSuggestions(tasks);
    };
    loadSuggestions();
  }, []);
  
  const filtered = value
    ? suggestions.filter(t => 
        t.task_id.includes(value) || 
        t.title.toLowerCase().includes(value.toLowerCase())
      )
    : suggestions;
  
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder="Task ID"
      />
      
      {showDropdown && filtered.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-48 overflow-auto">
          {filtered.map(task => (
            <li
              key={task.task_id}
              onClick={() => {
                onChange(task.task_id);
                setShowDropdown(false);
              }}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
            >
              <span className="font-mono">{task.task_id}</span>
              <span className="text-gray-500 ml-2 text-sm">{task.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

### B4. Validation Before Save

**Behavior:**
- When saving entry with Task ID, validate it exists (via cache or API)
- If invalid, show error, prevent save
- Allow save without Task ID (unassigned entry)

**Implementation:**

```typescript
// In AddEntryModal.tsx
const handleSave = async () => {
  // Validate task if provided
  if (taskId) {
    const { task, error } = await validateTaskId(taskId);
    if (error) {
      setValidationError(`Invalid Task ID: ${error}`);
      return;
    }
    // Use validated task data
    entry.projectId = task.projectId;
    entry.taskTitle = task.title;
  }
  
  await addEntry(entry);
  onClose();
};

// Validation function
async function validateTaskId(taskId: string): Promise<{ task?: TaskData; error?: string }> {
  // Check cache
  const cached = await db.get('SELECT * FROM task_cache WHERE task_id = ?', [taskId]);
  if (cached) return { task: cached };
  
  // Try API
  try {
    const task = await getIssue(taskId);
    return { task };
  } catch (err) {
    return { error: err.message };
  }
}
```

---

## Phase C: Efficiency Features

### C1. Quick Log Templates (Sidebar Section)

**Behavior:**
- Sidebar has "Quick Log" section with preset buttons
- Each button creates an entry with predefined: Task ID, Title, Billable, Duration (optional)
- User can manage templates (add/edit/delete) via Settings or modal

**Data Model:**

```sql
CREATE TABLE IF NOT EXISTS log_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,           -- Display name: "Admin", "Meeting"
  task_id TEXT NOT NULL,        -- e.g., "229602"
  task_title TEXT,              -- Cached title
  project_id INTEGER,           -- Cached project ID
  default_duration INTEGER,     -- Optional default minutes
  default_comment TEXT,         -- Optional comment template
  billable INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Seed with user's examples:**

```sql
INSERT INTO log_templates (id, name, task_id, task_title, billable, default_duration) VALUES
  ('tpl-admin', 'Admin', '229602', 'Daily admin / Drone administrativa', 0, 15),
  ('tpl-meeting', 'Meeting', '138850', 'Meetings', 1, 30);
```

**Implementation:**

```typescript
// In Sidebar.tsx
const QuickLogSection = () => {
  const [templates, setTemplates] = useState<LogTemplate[]>([]);
  const { addManualEntry, selectedDate } = useLogStore();
  
  useEffect(() => {
    loadTemplates().then(setTemplates);
  }, []);
  
  const handleQuickLog = async (template: LogTemplate) => {
    await addManualEntry({
      date: selectedDate,
      taskId: template.taskId,
      taskTitle: template.taskTitle,
      projectId: template.projectId,
      durationMinutes: template.defaultDuration || 25,
      comment: template.defaultComment || template.name,
      billable: template.billable,
      markedToLog: true
    });
  };
  
  return (
    <div className="p-3 border-t">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-500">Quick Log</h3>
        <button onClick={openTemplateManager} className="text-xs text-blue-500">
          Edit
        </button>
      </div>
      <div className="space-y-1">
        {templates.map(tpl => (
          <button
            key={tpl.id}
            onClick={() => handleQuickLog(tpl)}
            className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 flex justify-between"
          >
            <span>{tpl.name}</span>
            {tpl.defaultDuration && (
              <span className="text-gray-400">{tpl.defaultDuration}m</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
```

**Template Manager Modal:**

```typescript
// Simple form to add/edit templates
const TemplateForm = ({ template, onSave, onDelete }) => {
  const [name, setName] = useState(template?.name || '');
  const [taskId, setTaskId] = useState(template?.taskId || '');
  const [duration, setDuration] = useState(template?.defaultDuration || '');
  const [billable, setBillable] = useState(template?.billable ?? true);
  
  const { task, loading } = useTaskLookup(taskId);
  
  return (
    <form onSubmit={handleSubmit}>
      <input placeholder="Template Name" value={name} onChange={...} />
      <TaskIdInput value={taskId} onChange={setTaskId} />
      {task && <p className="text-sm text-green-600">✓ {task.title}</p>}
      <input type="number" placeholder="Default minutes" value={duration} onChange={...} />
      <label>
        <input type="checkbox" checked={billable} onChange={...} />
        Billable
      </label>
      <button type="submit">Save Template</button>
      {template && <button type="button" onClick={onDelete}>Delete</button>}
    </form>
  );
};
```

---

### C2. Calendar Event → Task ID Mapping

**Behavior:**
- When calendar proposal appears without a Task ID, show "Remember Task" button
- Clicking opens a small modal to assign Task ID
- System remembers: "Events with title X → always use Task ID Y"
- Future syncs auto-apply the mapping

**Data Model:**

```sql
CREATE TABLE IF NOT EXISTS calendar_task_mappings (
  id TEXT PRIMARY KEY,
  event_title_pattern TEXT NOT NULL UNIQUE,  -- Exact title or pattern
  task_id TEXT NOT NULL,
  task_title TEXT,
  project_id INTEGER,
  billable INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Example mappings:**

```sql
INSERT INTO calendar_task_mappings (id, event_title_pattern, task_id, billable) VALUES
  ('map-standup', 'Daily Standup', '138850', 1),
  ('map-review', 'Sprint Review', '138850', 1);
```

**Implementation - Sync Side:**

```typescript
// In calendar.ts syncCalendarProposals()
// After creating proposal, check for mapping

async function applyTaskMapping(proposal: CalendarProposal): Promise<CalendarProposal> {
  const mapping = await db.get(
    'SELECT * FROM calendar_task_mappings WHERE event_title_pattern = ?',
    [proposal.title]
  );
  
  if (mapping) {
    return {
      ...proposal,
      taskId: mapping.task_id,
      taskTitle: mapping.task_title,
      projectId: mapping.project_id,
      billable: mapping.billable
    };
  }
  
  return proposal;
}
```

**Implementation - UI Side:**

```typescript
// In CalendarProposalRow.tsx
const CalendarProposalRow = ({ proposal }) => {
  const [showMappingModal, setShowMappingModal] = useState(false);
  
  return (
    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
      <span>{proposal.title}</span>
      <span className="text-gray-500">{proposal.durationMinutes}m</span>
      
      {!proposal.taskId && (
        <button 
          onClick={() => setShowMappingModal(true)}
          className="text-xs text-blue-600"
        >
          Assign Task
        </button>
      )}
      
      {proposal.taskId && (
        <span className="text-xs bg-gray-200 px-1 rounded">
          → {proposal.taskId}
        </span>
      )}
      
      <button onClick={() => acceptProposal(proposal.id)}>Accept</button>
      <button onClick={() => dismissProposal(proposal.id)}>Dismiss</button>
      
      {showMappingModal && (
        <TaskMappingModal
          eventTitle={proposal.title}
          onSave={async (taskId) => {
            await saveTaskMapping(proposal.title, taskId);
            setShowMappingModal(false);
            // Refresh to apply mapping
            await loadDay(selectedDate);
          }}
          onClose={() => setShowMappingModal(false)}
        />
      )}
    </div>
  );
};
```

**Task Mapping Modal:**

```typescript
const TaskMappingModal = ({ eventTitle, onSave, onClose }) => {
  const [taskId, setTaskId] = useState('');
  const { task, loading, error } = useTaskLookup(taskId);
  
  const handleSave = async () => {
    if (!task) return;
    
    await db.run(`
      INSERT OR REPLACE INTO calendar_task_mappings 
      (id, event_title_pattern, task_id, task_title, project_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      `map-${Date.now()}`,
      eventTitle,
      taskId,
      task.title,
      task.projectId
    ]);
    
    onSave(taskId);
  };
  
  return (
    <div className="modal">
      <h3>Remember Task for "{eventTitle}"</h3>
      <p className="text-sm text-gray-500">
        Future events with this exact title will auto-assign this task.
      </p>
      <TaskIdInput value={taskId} onChange={setTaskId} />
      {task && <p className="text-green-600">✓ {task.title}</p>}
      {error && <p className="text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!task}>Save Mapping</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};
```

---

### C3. "Continue" Button for Timer

**Behavior:**
- After completing a Pomodoro, show "Continue" button
- Starts new focus session with same Task ID as previous
- Appears in Timer view when `status === 'idle'` and `lastTaskId` exists

**Implementation:**

```typescript
// In timerStore.ts
interface TimerState {
  // ... existing
  lastTaskId: string | null;
  lastTaskTitle: string | null;
}

// After session completes:
set({ 
  lastTaskId: currentTaskId,
  lastTaskTitle: currentTaskTitle,
  status: 'idle'
});
```

```typescript
// In Timer.tsx
{status === 'idle' && lastTaskId && (
  <button 
    onClick={() => startFocus(lastTaskId)}
    className="btn-secondary"
  >
    Continue ({lastTaskTitle || lastTaskId})
  </button>
)}
```

---

### C4. "Log All Unlogged" Button

**Behavior:**
- Button in Daily Log header
- Logs ALL entries that have:
  - `logged === false`
  - `taskId !== null` (has assigned task)
  - `markedToLog === true` OR all visible entries
- Shows progress and results

**Implementation:**

```typescript
// In DailyLog.tsx
const handleLogAll = async () => {
  const toLog = mergedEntries.filter(e => 
    !e.logged && 
    e.taskId && 
    e.projectId
  );
  
  if (toLog.length === 0) {
    alert('No entries ready to log. Assign Task IDs first.');
    return;
  }
  
  const result = await logSelected(toLog.map(e => e.id));
  
  // Show results
  alert(`Logged ${result.success} entries. ${result.failed} failed.`);
  
  // Show Easy Project link if any succeeded
  if (result.success > 0) {
    const epUrl = buildEasyProjectDayUrl(selectedDate);
    window.open(epUrl, '_blank');
  }
};
```

---

### C5. Success Link to Easy Project

**Behavior:**
- After successful log (single or bulk), show/open link to Easy Project day view
- URL format: `https://es.easyproject.com/easy_time_entries?only_me=true&set_filter=1&spent_on={date}%7C{date}&user_id=28668`

**Implementation:**

```typescript
// In utils/urls.ts
export function buildEasyProjectDayUrl(date: string): string {
  const baseUrl = 'https://es.easyproject.com/easy_time_entries';
  const params = new URLSearchParams({
    only_me: 'true',
    set_filter: '1',
    spent_on: `${date}|${date}`,  // Same date twice = single day
    user_id: '28668'
  });
  return `${baseUrl}?${params.toString()}`;
}
```

```typescript
// In logStore.ts after successful POST
const handleLogSuccess = (date: string, count: number) => {
  const url = buildEasyProjectDayUrl(date);
  
  // Option 1: Show toast with link
  showToast({
    message: `${count} entries logged successfully`,
    action: {
      label: 'View in Easy Project',
      onClick: () => window.open(url, '_blank')
    }
  });
  
  // Option 2: Auto-open (might be annoying)
  // window.open(url, '_blank');
};
```

---

### C6. Time Rounding (Round Up)

**Behavior:**
- When POSTing time entry, round duration UP to nearest increment
- Configurable: 5 min, 15 min, or none
- Example: 23 min → 25 min (5-min rounding) or 30 min (15-min rounding)

**Implementation:**

```typescript
// In utils/time.ts
export function roundUpMinutes(minutes: number, increment: number): number {
  if (increment <= 0) return minutes;
  return Math.ceil(minutes / increment) * increment;
}

// Usage in api.ts postTimeEntry
const settings = await getSettings();
const roundedMinutes = roundUpMinutes(
  entry.durationMinutes, 
  settings.roundingIncrement // 0, 5, or 15
);
const hours = roundedMinutes / 60;
```

**Settings:**

```typescript
// In Settings.tsx
<label>
  Round time entries to:
  <select value={roundingIncrement} onChange={...}>
    <option value={0}>No rounding</option>
    <option value={5}>5 minutes</option>
    <option value={15}>15 minutes</option>
  </select>
</label>
```

---

## Phase D: Polish (Later)

### D1. Calendar Agenda/Timeline View Toggle

- Toggle between current list view and timeline/agenda view
- Timeline shows entries positioned by time of day
- Lower priority - implement after core features work

---

## Database Migrations

Run these migrations to support new features:

```sql
-- Migration: Add billable column
ALTER TABLE pomodoro_sessions ADD COLUMN billable INTEGER DEFAULT 1;
ALTER TABLE adhoc_entries ADD COLUMN billable INTEGER DEFAULT 1;

-- Migration: Log templates table
CREATE TABLE IF NOT EXISTS log_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  task_id TEXT NOT NULL,
  task_title TEXT,
  project_id INTEGER,
  default_duration INTEGER,
  default_comment TEXT,
  billable INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Calendar task mappings table  
CREATE TABLE IF NOT EXISTS calendar_task_mappings (
  id TEXT PRIMARY KEY,
  event_title_pattern TEXT NOT NULL UNIQUE,
  task_id TEXT NOT NULL,
  task_title TEXT,
  project_id INTEGER,
  billable INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default templates
INSERT OR IGNORE INTO log_templates (id, name, task_id, billable, default_duration) VALUES
  ('tpl-admin', 'Admin', '229602', 0, 15),
  ('tpl-meeting', 'Meeting', '138850', 1, 30);
```

---

## Implementation Order

**Start with Phase A** (these fix existing pain points):
1. A2 - Billable toggle (quick win)
2. A1 - Delete entry (quick win)
3. A3 - Finish early button
4. A4 - Auto-merge entries

**Then Phase B** (builds foundation for C):
5. B1 - Auto-fetch task on ID entry
6. B2 - Show task title in rows
7. B3 - Task ID autocomplete
8. B4 - Validation before save

**Then Phase C** (efficiency features):
9. C4 - Log All button
10. C5 - Success link to Easy Project
11. C6 - Time rounding
12. C3 - Continue button
13. C1 - Quick Log templates
14. C2 - Calendar event mappings

---

## Notes for Claude Code

1. **Check existing code structure** before implementing - some of this may partially exist
2. **Migration safety** - use `ALTER TABLE ... ADD COLUMN` with error handling (column may exist)
3. **Auto-merge is display-only** - don't modify underlying session records
4. **Test Task ID lookup** with real IDs from user's Easy Project instance
5. **Keep UI minimal** - Tailwind defaults, no fancy animations
6. **IPC for SQLite** - all DB operations go through Electron main process
