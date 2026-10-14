#!/usr/bin/env python3
"""
drip_plan.py — inspect and move items on Drip's plan (Backlog / This week / Today)
and check each task's Easy8 status.

Writes go ONLY to Drip's `list_items` and `lists` tables and mirror the app's own writes
(src/services/db.ts createListItem / updateListItem, src/utils/todaySince.ts).
Easy8 is read-only: the only Easy8 call is `easy8 issue show -id <id> -quiet [-include journals]`.

Usage:
  python3 drip_plan.py list   [--column today] [--list "TopGis"] [--json]
  python3 drip_plan.py status [--column backlog] [--json]
  python3 drip_plan.py move   <ref> <backlog|this_week|today> [--dry-run]
  python3 drip_plan.py done   <ref> [--dry-run]
  python3 drip_plan.py review [--since 7d] [--column today] [--json]
  python3 drip_plan.py reopen <ref> [--dry-run]          # also undoes remove
  python3 drip_plan.py remove <ref> [--dry-run]          # archived = 1, recoverable
  python3 drip_plan.py add-list [<task-id>] [--name N] [--color HEX] [--not-billable] [--dry-run]
  python3 drip_plan.py add    <task-id> [--list NAME] [--column backlog] [--title T] [--force] [--dry-run]

<ref> = item id or a prefix of it (4+ chars), or an Easy8 task id (effective:
the list's task id wins over the item's). An ambiguous ref is an error that
lists the matches. Every command takes --db (default: the real Drip DB).
"""
import argparse
import json
import html
import os
import re
import sqlite3
import subprocess
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

DEFAULT_DB = Path(
    os.environ.get("DRIP_DB", Path.home() / "Library/Application Support/drip/productivity.db")
)
COLUMNS = ("backlog", "this_week", "today")
USER_ID = 28668  # src/services/api.ts USER_ID
EASY8_TIMEOUT_S = 30
MIN_PREFIX = 4
COMMENT_CHARS = 200
BUSY_TIMEOUT_S = 10
DEFAULT_LIST_COLOR = "#10b981"  # src/utils/listColors.ts DEFAULT_LIST_COLOR
# `easy8 issue show` returns status {id, name} without is_closed / closed_on /
# done_ratio, so "closed" falls back to the status name.
CLOSED_STATUS_WORDS = ("to backlog", "closed", "done", "resolved", "rejected", "finished", "cancel",
                       "uzavřen", "hotovo", "vyřešen", "zamítnut", "dokončen", "zrušen")


class PlanError(Exception):
    pass


# ---------- dates (local, never UTC) ----------

def today_local() -> date:
    return date.today()


def iso_now_utc_ms() -> str:
    """Same shape as JS `new Date().toISOString()` (what updateListItem writes)."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def today_since_for(prev_column: Optional[str], next_column: str,
                    prev_since: Optional[str], today: str) -> Optional[str]:
    """Port of src/utils/todaySince.ts todaySinceFor."""
    if next_column != "today":
        return None
    if prev_column == "today":
        return prev_since
    return today


# ---------- db ----------

def connect(db_path: Path, write: bool) -> sqlite3.Connection:
    if not db_path.exists():
        raise PlanError(f"Drip DB not found at {db_path}")
    if write:
        conn = sqlite3.connect(str(db_path), timeout=BUSY_TIMEOUT_S)
    else:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=BUSY_TIMEOUT_S)
    conn.row_factory = sqlite3.Row
    conn.execute(f"PRAGMA busy_timeout = {int(BUSY_TIMEOUT_S * 1000)}")
    return conn


ITEM_SQL = (
    'SELECT i.id, i.list_id, i.title, i.task_id AS item_task_id, i."column" AS col, i."order" AS ord, '
    "i.completed, i.archived, i.completed_at, i.created_at, i.today_since, i.billable, "
    "l.name AS list_name, l.task_id AS list_task_id "
    "FROM list_items i JOIN lists l ON l.id = i.list_id "
    "WHERE COALESCE(l.archived, 0) = 0"
)


def effective_task_id(row) -> Optional[str]:
    """src/components/Plan/boardLogic.ts effectiveTaskId: list.task_id || item.task_id || null."""
    return row["list_task_id"] or row["item_task_id"] or None


def item_dict(row) -> dict:
    return {
        "id": row["id"],
        "short_id": row["id"][:8],
        "list": row["list_name"],
        "column": row["col"],
        "order": row["ord"],
        "task_id": effective_task_id(row),
        "title": row["title"],
        "created_at": row["created_at"],
        "today_since": row["today_since"],
        "completed": row["completed"],
        "completed_at": row["completed_at"],
    }


def open_items(conn, column: Optional[str] = None, list_name: Optional[str] = None) -> list:
    sql = ITEM_SQL + " AND i.completed = 0 AND COALESCE(i.archived, 0) = 0"
    params: list = []
    if column:
        sql += ' AND i."column" = ?'
        params.append(column)
    if list_name:
        sql += " AND lower(l.name) = lower(?)"
        params.append(list_name)
    sql += ' ORDER BY l."order", CASE i."column" WHEN \'today\' THEN 0 WHEN \'this_week\' THEN 1 ELSE 2 END, i."order"'
    return conn.execute(sql, params).fetchall()


def resolve_ref(conn, ref: str, state: str = "open") -> sqlite3.Row:
    """Find exactly one item by id, id prefix, or effective task id.
    state "open" = on the plan; "closed" = completed or removed (archived)."""
    ref = ref.strip()
    if state == "open":
        sql = ITEM_SQL + " AND i.completed = 0 AND COALESCE(i.archived, 0) = 0"
    else:
        sql = ITEM_SQL + " AND (i.completed = 1 OR COALESCE(i.archived, 0) = 1)"
    rows = conn.execute(sql).fetchall()
    exact = [r for r in rows if r["id"] == ref]
    if exact:
        return exact[0]
    matches = [r for r in rows
               if (len(ref) >= MIN_PREFIX and r["id"].startswith(ref)) or effective_task_id(r) == ref]
    if not matches:
        raise PlanError(f"No {'open' if state == 'open' else 'completed or removed'} item matches '{ref}'")
    if len(matches) > 1:
        lines = [f"Ambiguous ref '{ref}' matches {len(matches)} items — use an item id prefix:"]
        lines += [f"  {r['id'][:8]}  {r['list_name']} / {r['col']}  {effective_task_id(r) or '-'}  {r['title']}"
                  for r in matches]
        raise PlanError("\n".join(lines))
    return matches[0]


def describe(row) -> str:
    tid = effective_task_id(row)
    return f"{row['id'][:8]} \"{row['title']}\"{' (' + tid + ')' if tid else ''} [{row['list_name']}]"


# ---------- easy8 (read-only) ----------

def run_easy8(task_id: str, journals: bool = False) -> dict:
    """Read one issue through the easy8 CLI. Only `issue show` is ever called."""
    cmd = ["easy8", "issue", "show", "-id", str(int(task_id)), "-quiet"]
    if journals:
        cmd += ["-include", "journals"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=EASY8_TIMEOUT_S)
    if proc.returncode != 0:
        raise PlanError((proc.stderr or proc.stdout).strip().splitlines()[0] if (proc.stderr or proc.stdout).strip()
                        else f"easy8 exited {proc.returncode}")
    data = json.loads(proc.stdout)
    return data.get("issue", data)


def is_closed(issue: dict) -> bool:
    status = issue.get("status") or {}
    if "is_closed" in status:
        return bool(status["is_closed"])
    if issue.get("closed_on"):
        return True
    name = (status.get("name") or "").lower()
    return any(w in name for w in CLOSED_STATUS_WORDS)


def hints_for(column: str, issue: dict, today: date) -> list:
    hints = []
    if is_closed(issue):
        hints.append("closed in Easy8 → suggest done")
    assignee = issue.get("assigned_to") or {}
    if not assignee:
        hints.append("note: unassigned")
    elif assignee.get("id") != USER_ID:
        hints.append(f"note: assigned to {assignee.get('name', assignee.get('id'))}")
    due_raw = issue.get("due_date")
    if due_raw and not is_closed(issue):
        try:
            due = date.fromisoformat(due_raw)
        except ValueError:
            due = None
        if due is not None:
            week_end = today + timedelta(days=6 - today.weekday())  # local Sunday
            if due <= today and column != "today":
                hints.append(("overdue" if due < today else "due today") + " → suggest today")
            elif today < due <= week_end and column == "backlog":
                hints.append("due this week → suggest this_week")
    return hints


# ---------- commands ----------

def cmd_list(args) -> None:
    conn = connect(args.db, write=False)
    try:
        items = [item_dict(r) for r in open_items(conn, args.column, args.list)]
    finally:
        conn.close()
    if args.json:
        print(json.dumps(items, indent=2, ensure_ascii=False))
        return
    if not items:
        print("No open items.")
        return
    for it in items:
        since = f" since {it['today_since']}" if it["today_since"] else ""
        print(f"{it['short_id']}  {it['column']:<9}  {it['task_id'] or '-':<7}  {it['list']}: {it['title']}"
              f"  (created {it['created_at'][:10] if it['created_at'] else '-'}{since})")
    print(f"{len(items)} open item(s)")


def strip_html(text: str) -> str:
    text = re.sub(r"<br\s*/?>|</p>|</li>", " ", text or "", flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return re.sub(r"\s+", " ", text).strip()


def trim(text: str, limit: int = COMMENT_CHARS) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def parse_since(raw: str) -> int:
    m = re.fullmatch(r"(\d+)d?", raw.strip())
    if not m:
        raise PlanError(f"--since takes days like 7d, got '{raw}'")
    return int(m.group(1))


def describe_detail(d: dict) -> str:
    name = d.get("name", "?")
    label = {"status_id": "status", "assigned_to_id": "assignee", "done_ratio": "done %",
             "due_date": "due date", "priority_id": "priority", "fixed_version_id": "milestone"}.get(name, name)
    old, new = d.get("old_value"), d.get("new_value")
    if name in ("status_id", "assigned_to_id", "priority_id", "fixed_version_id"):
        return f"{label} changed"  # the CLI gives ids, not names
    if d.get("property") == "attachment":
        return "attachment added" if new else "attachment removed"
    if name in ("description",):
        return "description edited"
    return f"{label} {old or '-'} → {new or '-'}"


def journal_digest(issue: dict, since_days: int, now: datetime) -> dict:
    """Changes in the window + the latest 1–2 comments (any age, flagged if recent)."""
    cutoff = now - timedelta(days=since_days)
    changes, comments = [], []
    for j in issue.get("journals") or []:
        try:
            when = datetime.fromisoformat((j.get("created_on") or "").replace("Z", "+00:00"))
        except ValueError:
            continue
        who = (j.get("user") or {}).get("name", "?")
        note = strip_html(j.get("notes") or "")
        private = bool(j.get("private_notes"))
        if note:
            comments.append({"on": when.astimezone().date().isoformat(), "by": who,
                             "text": trim(("private note: " if private else "") + note),
                             "private": private, "recent": when >= cutoff, "_ts": when})
        if when >= cutoff:
            for d in j.get("details") or []:
                changes.append(f"{when.astimezone().date().isoformat()} {describe_detail(d)} ({who})")
            if note:
                kind = "private note" if private else "comment"
                changes.append(f"{when.astimezone().date().isoformat()} {kind} ({who})")
    comments.sort(key=lambda c: c["_ts"], reverse=True)
    for c in comments:
        del c["_ts"]
    return {"changes": changes, "latest_comments": comments[:2]}


def collect(db: Path, column: Optional[str], fetch, since_days: Optional[int] = None) -> list:
    """Open items with a task id + their Easy8 state. One CLI call per task id; errors kept per item."""
    conn = connect(db, write=False)
    try:
        rows = [r for r in open_items(conn, column) if effective_task_id(r)]
    finally:
        conn.close()
    today = today_local()
    now = datetime.now(timezone.utc)
    cache: dict = {}
    out = []
    for r in rows:
        tid = effective_task_id(r)
        if tid not in cache:
            try:
                cache[tid] = {"issue": fetch(tid, journals=since_days is not None)}
            except Exception as e:  # tolerate per-item CLI errors
                cache[tid] = {"error": str(e) or e.__class__.__name__}
        entry = item_dict(r)
        res = cache[tid]
        if "error" in res:
            entry.update({"easy8_error": res["error"], "hints": []})
        else:
            iss = res["issue"]
            entry.update({
                "subject": iss.get("subject"),
                "status": (iss.get("status") or {}).get("name"),
                "closed": is_closed(iss),
                "assignee": (iss.get("assigned_to") or {}).get("name"),
                "assignee_id": (iss.get("assigned_to") or {}).get("id"),
                "due_date": iss.get("due_date"),
                "done_ratio": iss.get("done_ratio"),
                "updated_on": iss.get("updated_on"),
                "hints": hints_for(r["col"], iss, today),
            })
            if since_days is not None:
                entry.update(journal_digest(iss, since_days, now))
        out.append(entry)
    return out


def easy8_line(e: dict) -> str:
    if "easy8_error" in e:
        return f"Easy8: ERROR {e['easy8_error']}"
    ratio = f"{e['done_ratio']}%" if e["done_ratio"] is not None else "-"
    return (f"Easy8: {e['status']}{' (closed)' if e['closed'] else ''} · {e['assignee'] or 'unassigned'}"
            f" · due {e['due_date'] or '-'} · done {ratio} · updated {(e['updated_on'] or '-')[:10]}")


def compact_changes(changes: list) -> str:
    """'2026-10-12 description edited (Marek)' x3 → 'description edited ×3' (value changes kept verbatim)."""
    counts: dict = {}
    for c in changes:
        what = re.sub(r"^\S+ ", "", c)
        what = re.sub(r" \([^()]*\)$", "", what)
        counts[what] = counts.get(what, 0) + 1
    return "; ".join(w if n == 1 else f"{w} ×{n}" for w, n in counts.items())


def cmd_status(args, fetch=None) -> None:
    out = collect(args.db, args.column, fetch or run_easy8)
    if args.json:
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return
    if not out:
        print("No open items with an Easy8 task.")
        return
    for e in out:
        print(f"{e['short_id']}  {e['column']:<9}  {e['task_id']:<7}  {e['title'][:50]}\n    {easy8_line(e)}")
        for h in e["hints"]:
            print(f"    → {h}")
    print(f"{len(out)} item(s) checked, {len({e['task_id'] for e in out})} Easy8 task(s)")


def cmd_review(args, fetch=None) -> None:
    days = parse_since(args.since)
    out = collect(args.db, args.column, fetch or run_easy8, since_days=days)
    if args.json:
        print(json.dumps({"since_days": days, "items": out}, indent=2, ensure_ascii=False))
        return
    if not out:
        print("No open items with an Easy8 task.")
        return
    for col in ("today", "this_week", "backlog"):
        group = [e for e in out if e["column"] == col]
        if not group:
            continue
        print(f"== {col} ({len(group)}) ==")
        for e in group:
            print(f"{e['short_id']}  {e['task_id']:<7}  {e['title'][:60]}\n    {easy8_line(e)}")
            if "easy8_error" in e:
                continue
            print(f"    last {days}d: " + (compact_changes(e["changes"]) if e["changes"] else "no changes"))
            for c in e["latest_comments"]:
                print(f"    {'*' if c['recent'] else ' '} {c['on']} {c['by']}: {c['text']}")
            for h in e["hints"]:
                print(f"    → {h}")
    print(f"{len(out)} item(s), window {days}d (* = comment inside the window)")


def _finish(conn, args, line: str) -> None:
    if args.dry_run:
        conn.rollback()
        print(f"DRY RUN: {line}")
    else:
        conn.commit()
        print(line)


def cmd_move(args) -> None:
    conn = connect(args.db, write=True)
    try:
        row = resolve_ref(conn, args.ref)
        if row["col"] == args.column:
            print(f"UNCHANGED: {describe(row)} already in {args.column}")
            return
        order = conn.execute('SELECT COALESCE(MAX("order"), -1) + 1 FROM list_items WHERE list_id = ? AND "column" = ?',
                             (row["list_id"], args.column)).fetchone()[0]
        since = today_since_for(row["col"], args.column, row["today_since"], today_local().isoformat())
        conn.execute('UPDATE list_items SET "column" = ?, "order" = ?, today_since = ? WHERE id = ?',
                     (args.column, order, since, row["id"]))
        _finish(conn, args, f"MOVED {describe(row)}: {row['col']} → {args.column}"
                            f" (order {order}, today_since {row['today_since'] or '-'} → {since or '-'})")
    finally:
        conn.close()


def cmd_done(args) -> None:
    conn = connect(args.db, write=True)
    try:
        row = resolve_ref(conn, args.ref)
        stamp = iso_now_utc_ms()
        conn.execute("UPDATE list_items SET completed = 1, completed_at = ? WHERE id = ?", (stamp, row["id"]))
        _finish(conn, args, f"DONE {describe(row)}: open → completed (completed_at {stamp})")
    finally:
        conn.close()


def cmd_reopen(args) -> None:
    conn = connect(args.db, write=True)
    try:
        row = resolve_ref(conn, args.ref, state="closed")
        before = "completed" if row["completed"] else "removed"
        # updateListItem({completed: 0}) also clears completed_at and archived
        conn.execute("UPDATE list_items SET completed = 0, completed_at = NULL, archived = 0 WHERE id = ?",
                     (row["id"],))
        _finish(conn, args, f"REOPENED {describe(row)}: {before} → open in {row['col']}")
    finally:
        conn.close()


def cmd_remove(args) -> None:
    """Take an item off the plan without deleting it: archived = 1 hides it from Plan
    (getItemsByColumn filters archived); `reopen` brings it back."""
    conn = connect(args.db, write=True)
    try:
        row = resolve_ref(conn, args.ref)
        conn.execute("UPDATE list_items SET archived = 1 WHERE id = ?", (row["id"],))
        _finish(conn, args, f"REMOVED {describe(row)}: {row['col']} → archived (undo: reopen {row['id'][:8]})")
    finally:
        conn.close()


def cmd_add_list(args, fetch=None) -> None:
    """Mirror CreateListModal + db.createList: uuid, default colour, billable default on."""
    fetch = fetch or run_easy8
    task_id = (args.task_id or "").strip() or None
    if task_id and not task_id.isdigit():
        raise PlanError(f"Task id must be numeric, got '{task_id}'")
    if not task_id and not (args.name or "").strip():
        raise PlanError("A folder list (no task id) needs --name")
    conn = connect(args.db, write=True)
    try:
        if task_id:
            dupes = conn.execute("SELECT name FROM lists WHERE task_id = ? AND COALESCE(archived, 0) = 0",
                                 (task_id,)).fetchall()
            if dupes:
                raise PlanError(f"List '{dupes[0]['name']}' already logs to {task_id}")
        name = (args.name or "").strip()
        if not name:
            try:
                name = (fetch(task_id).get("subject") or "").strip()
            except Exception as e:
                raise PlanError(f"Could not read Easy8 subject for {task_id} ({e}) — pass --name")
            if not name:
                raise PlanError(f"Easy8 task {task_id} has no subject — pass --name")
        if conn.execute("SELECT 1 FROM lists WHERE lower(name) = lower(?) AND COALESCE(archived, 0) = 0",
                        (name,)).fetchone():
            raise PlanError(f"An active list named '{name}' already exists — pass a different --name")
        order = conn.execute('SELECT COALESCE(MAX("order"), -1) + 1 FROM lists').fetchone()[0]
        list_id = str(uuid.uuid4())
        billable = 0 if args.not_billable else 1
        conn.execute('INSERT INTO lists (id, name, color, icon_path, task_id, "order", billable) '
                     "VALUES (?, ?, ?, ?, ?, ?, ?)",
                     (list_id, name, args.color, None, task_id, order, billable))
        _finish(conn, args, f"ADDED LIST {list_id[:8]} \"{name}\": none → "
                            f"{'logs to ' + task_id if task_id else 'folder list'} (order {order}, billable {billable})")
    finally:
        conn.close()


def cmd_add(args, fetch=None) -> None:
    fetch = fetch or run_easy8
    task_id = args.task_id.strip()
    if not task_id.isdigit():
        raise PlanError(f"Task id must be numeric, got '{task_id}'")
    conn = connect(args.db, write=True)
    try:
        lists = conn.execute("SELECT id, name, task_id, billable FROM lists WHERE COALESCE(archived, 0) = 0").fetchall()
        if args.list:
            target = [l for l in lists if l["name"].lower() == args.list.lower()]
            if not target:
                raise PlanError(f"No active list named '{args.list}'. Lists: " + ", ".join(l["name"] for l in lists))
        else:
            target = [l for l in lists if l["task_id"] == task_id]
            if len(target) != 1:
                raise PlanError(f"No single list logs to {task_id} — pass --list NAME. Lists: "
                                + ", ".join(l["name"] for l in lists))
        lst = target[0]
        if lst["task_id"] and lst["task_id"] != task_id:
            raise PlanError(f"List '{lst['name']}' logs to {lst['task_id']}; its items cannot carry task {task_id}")
        # Effective task id (list.task_id overrides item.task_id), same rule as resolve_ref.
        dupes = [r for r in conn.execute(ITEM_SQL + " AND i.completed = 0 AND COALESCE(i.archived, 0) = 0").fetchall()
                 if effective_task_id(r) == task_id]
        if dupes and not args.force:
            raise PlanError(f"Open item with task {task_id} already exists: "
                            + "; ".join(f"{d['id'][:8]} \"{d['title']}\" [{d['list_name']}]" for d in dupes)
                            + " — use --force to add anyway")
        title = (args.title or "").strip()
        if not title:
            try:
                title = (fetch(task_id).get("subject") or "").strip()
            except Exception as e:
                raise PlanError(f"Could not read Easy8 subject for {task_id} ({e}) — pass --title")
            if not title:
                raise PlanError(f"Easy8 task {task_id} has no subject — pass --title")
        order = conn.execute('SELECT COALESCE(MAX("order"), -1) + 1 FROM list_items WHERE list_id = ? AND "column" = ?',
                             (lst["id"], args.column)).fetchone()[0]
        item_id = str(uuid.uuid4())
        # A bound list's items store no task id (AddItemInline passes null); the list's id wins anyway.
        stored_task = None if lst["task_id"] else task_id
        billable = 0 if lst["billable"] == 0 else 1  # PlanBoard.handleAddItem: list default
        since = today_since_for(None, args.column, None, today_local().isoformat())
        conn.execute(
            'INSERT INTO list_items (id, list_id, title, task_id, "column", "order", completed, billable, today_since) '
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (item_id, lst["id"], title, stored_task, args.column, order, 0, billable, since))
        _finish(conn, args, f"ADDED {item_id[:8]} \"{title}\" ({task_id}) [{lst['name']}]: none → {args.column}"
                            f" (order {order}, billable {billable}{', today_since ' + since if since else ''})")
    finally:
        conn.close()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Inspect and move items on Drip's plan; Easy8 read-only.")
    p.add_argument("--db", type=Path, default=DEFAULT_DB, help="SQLite file (default: the real Drip DB)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("list", help="open plan items")
    s.add_argument("--column", choices=COLUMNS)
    s.add_argument("--list", help="list name (case-insensitive)")
    s.add_argument("--json", action="store_true")

    s = sub.add_parser("status", help="open items with an Easy8 task + Easy8 status and hints")
    s.add_argument("--column", choices=COLUMNS)
    s.add_argument("--json", action="store_true")

    s = sub.add_parser("move", help="move an item to the end of a column")
    s.add_argument("ref")
    s.add_argument("column", choices=COLUMNS)
    s.add_argument("--dry-run", action="store_true")

    s = sub.add_parser("review", help="weekly digest: status + Easy8 changes and comments")
    s.add_argument("--since", default="7d", help="window in days, e.g. 7d")
    s.add_argument("--column", choices=COLUMNS)
    s.add_argument("--json", action="store_true")

    for name in ("done", "reopen", "remove"):
        s = sub.add_parser(name)
        s.add_argument("ref")
        s.add_argument("--dry-run", action="store_true")

    s = sub.add_parser("add", help="add an Easy8 task as a plan item")
    s.add_argument("task_id")
    s.add_argument("--list")
    s.add_argument("--column", choices=COLUMNS, default="backlog")
    s.add_argument("--title")
    s.add_argument("--force", action="store_true")
    s.add_argument("--dry-run", action="store_true")

    s = sub.add_parser("add-list", help="add an Easy8 task (umbrella) as a Drip list, or a folder list")
    s.add_argument("task_id", nargs="?")
    s.add_argument("--name")
    s.add_argument("--color", default=DEFAULT_LIST_COLOR)
    s.add_argument("--not-billable", action="store_true")
    s.add_argument("--dry-run", action="store_true")
    return p


COMMANDS = {"list": cmd_list, "status": cmd_status, "review": cmd_review, "move": cmd_move,
            "done": cmd_done, "reopen": cmd_reopen, "remove": cmd_remove, "add": cmd_add,
            "add-list": cmd_add_list}


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        COMMANDS[args.cmd](args)
    except PlanError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    except sqlite3.OperationalError as e:
        if "locked" in str(e) or "busy" in str(e):
            print("ERROR: Drip database is busy, try again", file=sys.stderr)
            return 1
        raise
    return 0


if __name__ == "__main__":
    sys.exit(main())
