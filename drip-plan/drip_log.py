#!/usr/bin/env python3
"""Log time into Drip's Review for one Easy8 task on one day — used by Claude's /log command.

The number Marek gives covers this Claude session's work only:
- today's *unnamed* focus sessions on the task (comment empty, "Focus session" or "Kickoff",
  not yet sent to Easy8) are merged / stretched / trimmed into that number;
- whatever the sessions don't cover becomes new Review entries (adhoc_entries, marked to log);
- no entry is longer than 2 h: 3 h -> 2 h + 1 h;
- named entries and anything already sent to Easy8 are never touched.

Nothing goes to Easy8 — Marek sends it from Drip -> Review -> "Log N to Easy8".

  drip_log.py plan  --task 645001 --minutes 180 [--date 2026-11-13]
  drip_log.py apply --task 645001 --minutes 180 [--date ...] --billable 1 --comment "..." --comment "..."

`plan` prints JSON with one chunk per entry; `apply` needs exactly one --comment per chunk.
"""
import argparse
import json
import sqlite3
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path.home() / "Library/Application Support/drip/productivity.db"
MAX_ENTRY_MIN = 120
UNNAMED = ("", "focus session", "kickoff")
BUSY_TIMEOUT_S = 5.0


def connect(db_path: Path, write: bool) -> sqlite3.Connection:
    if write:
        conn = sqlite3.connect(str(db_path), timeout=BUSY_TIMEOUT_S)
    else:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=BUSY_TIMEOUT_S)
    conn.row_factory = sqlite3.Row
    return conn


def chunk_sizes(minutes: int) -> list[int]:
    sizes = [MAX_ENTRY_MIN] * (minutes // MAX_ENTRY_MIN)
    if minutes % MAX_ENTRY_MIN:
        sizes.append(minutes % MAX_ENTRY_MIN)
    return sizes


def unnamed_sessions(conn: sqlite3.Connection, task: str, day: str) -> list[sqlite3.Row]:
    # Same day rule as Drip's getSessions: date(start_at) = day.
    rows = conn.execute(
        """SELECT id, start_at, end_at, duration_minutes, comment FROM pomodoro_sessions
           WHERE date(start_at) = date(?) AND task_id = ? AND source = 'pomodoro'
             AND COALESCE(logged, 0) = 0 ORDER BY start_at""",
        (day, task),
    ).fetchall()
    return [r for r in rows if (r["comment"] or "").strip().lower() in UNNAMED]


def build_plan(conn: sqlite3.Connection, task: str, minutes: int, day: str) -> dict:
    sizes = chunk_sizes(minutes)
    sessions = unnamed_sessions(conn, task, day)
    groups: list[list[sqlite3.Row]] = [[] for _ in sizes]
    total = sum(max(s["duration_minutes"], 0) for s in sessions)
    cum = 0
    for s in sessions:
        # Scaled position of the session's start inside the target number decides its entry.
        pos = cum * minutes / total if total else 0
        idx = min(int(pos // MAX_ENTRY_MIN), len(sizes) - 1)
        groups[idx].append(s)
        cum += max(s["duration_minutes"], 0)
    title_row = conn.execute("SELECT title FROM task_cache WHERE task_id = ?", (task,)).fetchone()
    chunks = []
    for i, (size, grp) in enumerate(zip(sizes, groups)):
        chunks.append({
            "index": i + 1,
            "minutes": size,
            "kind": "session" if grp else "new",
            "keeps_session": grp[0]["id"] if grp else None,
            "merges_sessions": [
                {"id": s["id"], "start_at": s["start_at"], "end_at": s["end_at"],
                 "minutes": s["duration_minutes"], "comment": s["comment"]} for s in grp
            ],
        })
    return {
        "task": task,
        "title": title_row["title"] if title_row else None,
        "date": day,
        "minutes": minutes,
        "unnamed_session_minutes": total,
        "chunks": chunks,
    }


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def parse_iso(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def apply_plan(conn: sqlite3.Connection, plan: dict, comments: list[str], billable: int,
               now: datetime | None = None) -> list[str]:
    chunks = plan["chunks"]
    if len(comments) != len(chunks):
        raise ValueError(f"need {len(chunks)} --comment values, got {len(comments)}")
    if any(not c.strip() for c in comments):
        raise ValueError("comments must not be empty")
    now = now or datetime.now(timezone.utc)
    title = plan["title"] or f"Task {plan['task']}"
    out: list[str] = []
    # New entries with no session to anchor them sit back-to-back, ending now.
    new_total = sum(c["minutes"] for c in chunks if c["kind"] == "new")
    cursor = now - timedelta(minutes=new_total)
    with conn:
        for chunk, comment in zip(chunks, comments):
            size = chunk["minutes"]
            if chunk["kind"] == "session":
                keep = chunk["merges_sessions"][0]
                start = parse_iso(keep["start_at"])
                conn.execute(
                    """UPDATE pomodoro_sessions SET duration_minutes = ?, end_at = ?, comment = ?,
                       billable = ? WHERE id = ? AND COALESCE(logged, 0) = 0""",
                    (size, iso(start + timedelta(minutes=size)), comment, billable, keep["id"]),
                )
                merged = chunk["merges_sessions"][1:]
                for s in merged:
                    conn.execute(
                        "DELETE FROM pomodoro_sessions WHERE id = ? AND COALESCE(logged, 0) = 0",
                        (s["id"],),
                    )
                before = " + ".join(f"{s['minutes']}m" for s in chunk["merges_sessions"])
                out.append(f"session {keep['id'][:8]}: {before} '{keep['comment'] or ''}' → "
                           f"{size}m '{comment}' (billable {billable})"
                           + (f", merged {len(merged)} session(s)" if merged else ""))
            else:
                new_id = str(uuid.uuid4())
                conn.execute(
                    """INSERT INTO adhoc_entries (id, date, duration_minutes, title, task_id, is_todo,
                       due_date, completed, marked_to_log, logged, comment, billable, start_time)
                       VALUES (?, ?, ?, ?, ?, 0, NULL, 0, 1, 0, ?, ?, ?)""",
                    (new_id, plan["date"], size, title, plan["task"], comment, billable, iso(cursor)),
                )
                cursor += timedelta(minutes=size)
                out.append(f"new entry {new_id[:8]}: none → {size}m '{comment}' (billable {billable})")
    return out


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("action", choices=["plan", "apply"])
    p.add_argument("--task", required=True)
    p.add_argument("--minutes", type=int, required=True)
    p.add_argument("--date", default=date.today().isoformat(), help="local day, YYYY-MM-DD (default today)")
    p.add_argument("--billable", type=int, choices=[0, 1])
    p.add_argument("--comment", action="append", default=[])
    p.add_argument("--db", type=Path, default=DB_PATH)
    a = p.parse_args(argv)
    if not a.task.isdigit():
        print("ERROR: --task must be an Easy8 task number", file=sys.stderr)
        return 2
    if not 1 <= a.minutes <= 1440:
        print("ERROR: --minutes must be 1–1440", file=sys.stderr)
        return 2
    try:
        date.fromisoformat(a.date)
    except ValueError:
        print("ERROR: --date must be YYYY-MM-DD", file=sys.stderr)
        return 2
    try:
        if a.action == "plan":
            with connect(a.db, write=False) as conn:
                print(json.dumps(build_plan(conn, a.task, a.minutes, a.date), indent=2))
            return 0
        if a.billable is None:
            print("ERROR: apply needs --billable 0|1", file=sys.stderr)
            return 2
        conn = connect(a.db, write=True)
        plan = build_plan(conn, a.task, a.minutes, a.date)
        for line in apply_plan(conn, plan, a.comment, a.billable):
            print(line)
        conn.close()
        return 0
    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2
    except sqlite3.OperationalError as e:
        if "locked" in str(e) or "busy" in str(e):
            print("ERROR: Drip database is busy, try again", file=sys.stderr)
            return 3
        raise


if __name__ == "__main__":
    sys.exit(main())
