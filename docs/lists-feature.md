# Lists — Task Management System

## Overview

Lists is a kanban-style task organizer that helps you group and manage tasks across different projects or areas of work. Each list acts as a container with three columns — **Backlog**, **This Week**, and **Today** — so you can prioritize what needs your attention now versus later.

Lists integrate directly with the timer: selecting a task from your lists populates the Task ID and Intention fields, making it seamless to start focused work sessions.

### Two types of lists

- **Folder lists** — Simple organizational containers. Individual tasks within them can optionally have their own Easy Project task IDs.
- **ID-bound lists** — Linked to a specific Easy Project task ID. When you select any task from this list in the timer, the list's task ID is automatically used for logging.

### Key features

- **Drag and drop** — Reorder tasks within columns or move them across columns by dragging
- **Task details** — Click a task title to expand and add a description or subtask checklist
- **Subtask checklists** — Break tasks into smaller steps with completion tracking
- **All Tasks view** — See every task across all lists in one aggregated board with a Done column
- **Auto-archive** — Completed tasks are automatically archived after 7 days to keep boards clean
- **List archive** — Archive entire lists when a project wraps up; restore them anytime
- **Timer integration** — A task picker in the timer's right panel lets you search, filter, and select tasks to work on
- **Task ID tooltips** — Hover over any task ID badge to see the full Easy Project task name

---

## Technical Details

### Architecture

| Layer | Technology | Files |
|-------|-----------|-------|
| Database | SQLite (better-sqlite3) | `src/services/db.ts` |
| IPC Bridge | Electron IPC | `electron/main.ts`, `electron/preload.ts` |
| State | Zustand | `src/stores/listsStore.ts` |
| Drag & Drop | @dnd-kit | `@dnd-kit/core`, `@dnd-kit/sortable` |
| UI | React + Tailwind | `src/components/Lists/` |

### Database Schema

**`lists`** table:
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| name | TEXT | List name |
| color | TEXT | Hex color code |
| icon_path | TEXT | Optional icon file path |
| task_id | TEXT | Easy Project task ID binding (null = folder list) |
| order | INTEGER | Display order |
| archived | INTEGER | 0 or 1 |
| created_at | DATETIME | Auto-set |

**`list_items`** table:
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | UUID |
| list_id | TEXT FK | Parent list reference |
| title | TEXT | Task title |
| task_id | TEXT | Optional EP task ID (folder lists only) |
| column | TEXT | `backlog`, `this_week`, or `today` |
| order | INTEGER | Sort order within column |
| completed | INTEGER | 0 or 1 |
| archived | INTEGER | 0 or 1 (auto-set after 7 days) |
| completed_at | DATETIME | Set when completed, cleared on uncomplete |
| description | TEXT | Plain text description |
| subtasks | TEXT | JSON array of `{id, title, completed}` |
| created_at | DATETIME | Auto-set |

### Component Map

```
src/components/Lists/
  ListPlanningView.tsx    — Main kanban board (3 columns, DnD, task expansion)
  AllListsOverview.tsx    — Aggregated view (4 columns including Done)
  TimerTaskList.tsx       — Timer panel task picker (filters, search, card UI)
  CreateListModal.tsx     — List creation dialog (name, color, optional task ID)
  TaskDetailInline.tsx    — Expandable task detail (description, subtasks)
  DraggableItem.tsx       — @dnd-kit sortable wrapper
  AddItemInline.tsx       — Inline task creation input

src/components/shared/TaskIdBadge.tsx — Reusable task ID badge with hover tooltip
src/stores/listsStore.ts  — Zustand store (CRUD, archive, column filtering)
src/hooks/useTaskName.ts  — Resolves task ID to EP task name (cache + API fallback)
src/utils/listColors.ts   — 8-color preset palette
```

### IPC API (`window.listsAPI`)

| Method | Returns | Description |
|--------|---------|-------------|
| `getLists()` | `TaskList[]` | Active (non-archived) lists |
| `getArchivedLists()` | `TaskList[]` | Archived lists |
| `createList(list)` | `string` (id) | Create new list |
| `updateList(id, updates)` | void | Update list properties |
| `deleteList(id)` | void | Delete list and all items |
| `archiveList(id)` | void | Archive a list |
| `unarchiveList(id)` | void | Restore archived list |
| `getListItems(listId)` | `ListItem[]` | Items for a specific list |
| `getAllListItems()` | `ListItem[]` | All items across lists |
| `createListItem(item)` | `string` (id) | Create task in list |
| `updateListItem(id, updates)` | void | Update task (auto-sets completed_at) |
| `deleteListItem(id)` | void | Delete task |
| `archiveOldCompleted()` | `number` | Auto-archive items completed 7+ days ago |

### Task ID Tooltips

Hovering over any `#taskId` badge shows a floating popup with the full Easy Project task name. The resolution uses a two-step approach:

1. **Local cache** — checks `task_cache` table via `getCachedTask()`
2. **API fallback** — if not cached, fetches from Easy Project via `getIssue()` (also populates cache)

Results are stored in a shared in-memory cache (`useTaskName.ts`) to avoid duplicate API calls across components and re-renders. The tooltip (`TaskIdBadge.tsx`) uses fixed viewport positioning with `clamp()` to stay visible near window edges, and wraps long names at 280px.

### Navigation

- **Sidebar**: Lists section below main nav. Click a list to open its kanban. "All Tasks" shows aggregated view.
- **Timer**: Right panel toggle switches between Timeline and Tasks views.
- **Routing**: `App.tsx` handles `'lists'` (single list) and `'all-lists'` (aggregated) views.
