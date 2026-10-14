# drip-plan

Small CLI so Claude Code can read and adjust Drip's plan (Backlog / This week / Today) and
check each task's Easy8 state. Python 3 stdlib only. Second external writer next to
`leexi-sync/drip_backlog.py`.

- **Writes** go only to `list_items` (and `lists` for `add-list`) and mirror the app's own
  writes: `src/services/db.ts` `createListItem` / `updateListItem` / `createList`,
  `src/utils/todaySince.ts`.
- **Easy8 is read-only**: the only call is `easy8 issue show -id <id> -quiet [-include journals]`.
- `--db <path>` picks the SQLite file (default: the live
  `~/Library/Application Support/drip/productivity.db`). Read commands open it `mode=ro`.

## Commands

```
python3 drip_plan.py list   [--column backlog|this_week|today] [--list NAME] [--json]
python3 drip_plan.py status [--column ...] [--json]            # Easy8 status + suggestions
python3 drip_plan.py review [--since 7d] [--column ...] [--json] # + changes and latest comments
python3 drip_plan.py move   <ref> <backlog|this_week|today> [--dry-run]
python3 drip_plan.py done   <ref> [--dry-run]
python3 drip_plan.py reopen <ref> [--dry-run]                  # also undoes remove
python3 drip_plan.py remove <ref> [--dry-run]                  # archived = 1, recoverable
python3 drip_plan.py add    <task-id> [--list NAME] [--column backlog] [--title T] [--force] [--dry-run]
python3 drip_plan.py add-list [<task-id>] [--name N] [--color HEX] [--not-billable] [--dry-run]
```

`<ref>` = item id or a 4+ char prefix, or an Easy8 task id. The task id is the effective one
(the list's task id wins over the item's, as in `Plan/boardLogic.ts effectiveTaskId`), so a
task id on a bound list with several items is ambiguous — the error lists the item ids.

## Behaviour notes

- `move` appends at the end of the target column (`order` = max + 1 in that list). The app's
  own card move uses the count of open items instead; max + 1 never collides.
- `today_since`: set to the local date on entering Today, kept while there, cleared on leaving.
- `done` writes `completed_at` like JS `new Date().toISOString()` (UTC, ms, `Z`). Completed items
  are auto-archived by the app after 7 days (`archiveOldCompleted`).
- `remove` sets `archived = 1` (Plan hides archived items); nothing is deleted.
- `add`: title from the Easy8 subject unless `--title`; billable = the list's default; on a list
  bound to a task the item stores no task id (as the app's add form). Refuses a duplicate open
  item with the same task id unless `--force`. Without `--list` it uses the list bound to that task.
- `add-list`: Drip lists bind to an Easy8 **task**, not a project — pass the umbrella task id, or
  only `--name` for a folder list. Colour `#10b981`, billable on, order = max + 1.
- `status`/`review` hints: closed in Easy8 → done; assignee not 28668 → note; due this week while
  in Backlog → this_week; due today/overdue and not in Today → today. "Closed" comes from the
  status name (the CLI returns no `is_closed`), e.g. Done, Closed, Canceled, Rejected.
- Drip shows external writes only after its plan reloads: entering Plan from another view, or
  clicking a list in Plan's lists panel (items only). There is no reload on window focus.

## Tests

```
cd drip-plan && python3 -m unittest test_drip_plan
```

Each test builds a temp DB from the live `lists` / `list_items` schema; Easy8 is stubbed.
Never test against the live DB — copy it first:
`sqlite3 -readonly "<live db>" ".backup /tmp/copy.db"` then `--db /tmp/copy.db`.
