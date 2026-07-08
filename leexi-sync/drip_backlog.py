#!/usr/bin/env python3
"""
drip_backlog.py — the ONLY writer into Drip's SQLite backlog.

The scheduled Claude agent calls this after it has extracted action items
from a Leexi transcript. Keeping all DB access in one small script means the
agent never has to hand-craft SQL, and the insert shape stays identical to
Drip's own createListItem() (electron/main.ts).

Usage:
  # list new calls the agent should look at (reads/advances nothing)
  python3 drip_backlog.py watermark            -> prints last processed ISO ts (or "none")

  # add one backlog task (idempotent per (call_uuid, title))
  python3 drip_backlog.py add \
      --title "Send Liv-Epi SharePoint mapping to Marek Baňas" \
      --call-uuid 6339e82a-20b0-4126-99af-f17f099ef558 \
      --call-title "6959 Liv-Epi (Easy8 - Sharepoint)" \
      --call-date 2026-07-07

  # advance the watermark once a call is fully processed
  python3 drip_backlog.py mark-done --call-date 2026-07-07T09:00:00+02:00
"""
import argparse
import json
import os
import sqlite3
import sys
import uuid
from pathlib import Path

DB_PATH = Path(
    os.environ.get(
        "DRIP_DB",
        Path.home() / "Library/Application Support/drip/productivity.db",
    )
)
STATE_PATH = Path(__file__).with_name("state.json")
LIST_NAME = "Meeting Inbox"
LIST_COLOR = "#8b5cf6"  # violet — visually distinct from your other lists


def load_state() -> dict:
    if STATE_PATH.exists():
        return json.loads(STATE_PATH.read_text())
    return {"watermark": None, "processed": {}}


def save_state(state: dict) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2, ensure_ascii=False))


def connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        sys.exit(f"ERROR: Drip DB not found at {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.execute("PRAGMA journal_mode = WAL")  # match how the app opens it
    return conn


def ensure_list(conn: sqlite3.Connection) -> str:
    row = conn.execute("SELECT id FROM lists WHERE name = ?", (LIST_NAME,)).fetchone()
    if row:
        return row[0]
    list_id = str(uuid.uuid4())
    next_order = conn.execute('SELECT COALESCE(MAX("order"), -1) + 1 FROM lists').fetchone()[0]
    conn.execute(
        'INSERT INTO lists (id, name, color, "order", billable) VALUES (?, ?, ?, ?, ?)',
        (list_id, LIST_NAME, LIST_COLOR, next_order, 0),
    )
    conn.commit()
    return list_id


def cmd_watermark(_args) -> None:
    del _args
    print(load_state().get("watermark") or "none")


def cmd_add(args) -> None:
    state = load_state()
    dedup_key = f"{args.call_uuid}::{args.title.strip().lower()}"
    if dedup_key in state["processed"]:
        print(f"SKIP (already added): {args.title}")
        return

    conn = connect()
    try:
        list_id = ensure_list(conn)
        next_order = conn.execute(
            'SELECT COALESCE(MAX("order"), -1) + 1 FROM list_items WHERE list_id = ? AND "column" = ?',
            (list_id, "backlog"),
        ).fetchone()[0]
        item_id = str(uuid.uuid4())
        # Provenance goes in `description` so the item card carries its source.
        description = (
            f"From Leexi call: {args.call_title} ({args.call_date})\n"
            f"https://app.leexi.ai/calls/{args.call_uuid}"
        )
        conn.execute(
            'INSERT INTO list_items '
            '(id, list_id, title, task_id, "column", "order", completed, billable, description) '
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (item_id, list_id, args.title.strip(), None, "backlog", next_order, 0, 0, description),
        )
        conn.commit()
    finally:
        conn.close()

    state["processed"][dedup_key] = item_id
    save_state(state)
    print(f"ADDED: {args.title}")


def cmd_mark_done(args) -> None:
    state = load_state()
    current = state.get("watermark")
    # advance only forward (ISO 8601 strings sort chronologically)
    if current is None or args.call_date > current:
        state["watermark"] = args.call_date
        save_state(state)
        print(f"WATERMARK -> {args.call_date}")
    else:
        print(f"WATERMARK unchanged ({current} >= {args.call_date})")


def main() -> None:
    p = argparse.ArgumentParser(description="Drip backlog writer for Leexi sync")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("watermark")

    a = sub.add_parser("add")
    a.add_argument("--title", required=True)
    a.add_argument("--call-uuid", required=True)
    a.add_argument("--call-title", required=True)
    a.add_argument("--call-date", required=True)

    m = sub.add_parser("mark-done")
    m.add_argument("--call-date", required=True, help="ISO 8601 performed_at of the call")

    args = p.parse_args()
    {"watermark": cmd_watermark, "add": cmd_add, "mark-done": cmd_mark_done}[args.cmd](args)


if __name__ == "__main__":
    main()
