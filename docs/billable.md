# Billable System — Fix + Billable-by-Default

_Last updated: 2026-06-09_

## Summary

Two changes shipped together:

1. **Bug fix** — Manual/ad-hoc entries marked billable could display **"Not billable"**
   after logging. The cause was local UI/state divergence in the daily-log edit path
   (not the API — the POST always sent the right value).
2. **Feature** — A **billable-by-default** control on lists, tasks (list items), the
   timer task picker, and the manual/template add flows. A task's default applies
   automatically by Task ID everywhere a new session/entry is created, with a manual
   per-entry override still available.

---

## How billable resolves

When a new session/entry is created with a Task ID, the billable default is resolved by
**`getBillableDefaultForTask(taskId)`** ([src/services/db.ts](../src/services/db.ts)),
most specific wins:

```
list_items.billable  (most recent item matching the task_id)
        ↓ (none)
lists.billable        (most recent list matching the task_id)
        ↓ (none)
settings.defaultBillable   (global, defaults to true)
```

Exposed to the renderer as **`window.listsAPI.getBillableForTask(taskId)`** via the
`get-billable-for-task` IPC channel.

---

## Data model

`billable INTEGER NOT NULL DEFAULT 1` was added to two tables (idempotent
`ALTER TABLE … ADD COLUMN` migrations in [src/services/db.ts](../src/services/db.ts),
plus [database/schema.sql](../database/schema.sql) for fresh installs):

| Table | Meaning of `billable` |
|-------|-----------------------|
| `lists` | Default for new items added to the list; also the task-level default when the list is bound to a `task_id`. |
| `list_items` | Per-task default; overrides the parent list. |

Existing rows backfill to `1` (billable) on first launch of the updated app — additive
and safe. `pomodoro_sessions` and `adhoc_entries` already had `billable`; calendar
proposals remain out of scope (no `billable` column).

Types updated in [src/types/index.ts](../src/types/index.ts): `TaskList.billable`,
`ListItem.billable` (`0 | 1`), `TimerState.currentBillable`, and the `ListsAPI` interface.

---

## Where the default is applied (propagation)

| Creation path | Behavior |
|---------------|----------|
| **Timer focus session** | `timerStore.currentBillable` is written on both save paths (`handleFocusComplete`, `finishEarly`). `startFocus(taskId, billable?)` resolves from the task default when no explicit value is passed (resume/continue/restore). |
| **Manual / ad-hoc entry** | `AddEntryModal` pre-fills the billable toggle from the resolver when a Task ID is selected. |
| **List item** | `ListPlanningView.handleAddItem` seeds new items from the parent list's `billable`; the add form can override. |
| **Quick-log template** | `AddTemplateModal` seeds billable from the resolver on Task ID blur. |

---

## UI controls

A single reusable pill — **`BillableToggle`**
([src/components/shared/BillableToggle.tsx](../src/components/shared/BillableToggle.tsx))
— is used everywhere for visual consistency (see `UI_DESIGN_SYSTEM.md` → "Billable toggle").

- **Timer task picker** — toggle next to the selected task, pre-filled from the task default.
- **CreateListModal** — "Billable by default" row under the Task ID field.
- **List header** (`ListPlanningView`) — toggle wired to `updateList`.
- **TaskDetailInline** — per-item toggle wired to `updateItem`.
- **AddItemInline** — toggle shown when adding a task to a task-bound list (seeded from the list default).
- **AddEntryModal / EntryRow edit** — billable control standardized to `BillableToggle`.
- **Daily-view badge** — the read-only `✓ Billable` / `Not billable` status indicator in
  `EntryRow` is unchanged.

---

## The bug fix in detail

Root cause was in the daily-log edit path, not the API:

1. **Stale edit snapshot** — `EntryRow` held its edit buffer from a one-time
   `useState(entry)`. Because the row is `memo`-ized, the buffer was never re-synced when
   the `entry` prop changed (e.g. after `logSelected` → `loadDay`). A later Edit + Save
   wrote the stale `billable` back, silently reverting it.
   → Fix: `useEffect` re-syncs the buffer to `entry` while not editing.
2. **`marked_to_log` clobber** — `logStore.updateEntry` wrote every field even when the
   change set didn't include it (`marked_to_log: changes.markedToLog ? 1 : 0` →
   `undefined → 0`), so editing an entry un-marked it.
   → Fix: build the DB update from only the keys present in `changes`.
3. **Merged-row masking** — merged rows computed `billable: group.some(...)`, which could
   show a mixed group as billable. → Fix: `group.every(...)`.

---

## Testing

1. **Bug repro** — Add an ad-hoc entry, mark billable, log it → badge shows **✓ Billable**.
   Edit (change only the comment), Save → stays billable and stays marked.
2. **List/task defaults** — Create a list with billable **off**, bound to a Task ID; add a
   task → inherits non-billable; flip the item to billable → sticks after reload.
3. **Timer** — Pick that Task ID → toggle pre-fills from the default; run a short session →
   appears billable in the daily view.
4. **Global fallback** — A Task ID in no list falls back to the `defaultBillable` setting.
5. **DB check** — `lists`, `list_items`, `adhoc_entries`, `pomodoro_sessions` all have a
   `0/1` billable, never NULL.
