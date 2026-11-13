#!/usr/bin/env python3
"""Tests for drip_log.py on a temp DB with Drip's real session / entry / cache schema.
Nothing touches the real DB.

Run: cd drip-plan && python3 -m unittest test_drip_log
"""
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import drip_log  # noqa: E402

SCHEMA = """
CREATE TABLE pomodoro_sessions (id TEXT PRIMARY KEY, start_at DATETIME NOT NULL, end_at DATETIME,
  duration_minutes INTEGER NOT NULL DEFAULT 25, task_id TEXT,
  source TEXT CHECK(source IN ('pomodoro','manual','calendar','break')) DEFAULT 'pomodoro',
  comment TEXT, logged INTEGER DEFAULT 0, log_sent_at DATETIME, server_entry_id INTEGER,
  billable INTEGER DEFAULT 1);
CREATE TABLE adhoc_entries (id TEXT PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  date TEXT NOT NULL, duration_minutes INTEGER NOT NULL, title TEXT NOT NULL, task_id TEXT,
  is_todo INTEGER DEFAULT 0, due_date TEXT, completed INTEGER DEFAULT 0,
  marked_to_log INTEGER DEFAULT 0, logged INTEGER DEFAULT 0, comment TEXT,
  billable INTEGER DEFAULT 1, start_time TEXT);
CREATE TABLE task_cache (task_id TEXT PRIMARY KEY, title TEXT NOT NULL, project_id INTEGER NOT NULL,
  project_name TEXT, last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP);
"""
DAY = "2026-11-13"
TASK = "645001"
NOW = datetime(2026, 11, 13, 15, 0, tzinfo=timezone.utc)


class DripLogTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "t.db"
        c = sqlite3.connect(self.db)
        c.executescript(SCHEMA)
        c.execute("INSERT INTO task_cache VALUES (?, 'Next level - Marek Mikesz', 1, 'Next level', NULL)", (TASK,))
        c.commit()
        c.close()
        self.conn = drip_log.connect(self.db, write=True)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def session(self, sid, start, minutes, comment="Focus session", task=TASK, logged=0):
        self.conn.execute(
            "INSERT INTO pomodoro_sessions (id, start_at, end_at, duration_minutes, task_id, source, comment, logged)"
            " VALUES (?, ?, NULL, ?, ?, 'pomodoro', ?, ?)",
            (sid, f"{DAY}T{start}:00.000Z", minutes, task, comment, logged))
        self.conn.commit()

    def run_log(self, minutes, comments=None, billable=1):
        plan = drip_log.build_plan(self.conn, TASK, minutes, DAY)
        comments = comments or [f"c{i + 1}" for i in range(len(plan["chunks"]))]
        drip_log.apply_plan(self.conn, plan, comments, billable, now=NOW)
        return plan

    def total(self):
        s = self.conn.execute("SELECT COALESCE(SUM(duration_minutes),0) FROM pomodoro_sessions WHERE task_id=?", (TASK,)).fetchone()[0]
        a = self.conn.execute("SELECT COALESCE(SUM(duration_minutes),0) FROM adhoc_entries WHERE task_id=?", (TASK,)).fetchone()[0]
        return s + a

    def test_chunk_sizes(self):
        self.assertEqual(drip_log.chunk_sizes(180), [120, 60])
        self.assertEqual(drip_log.chunk_sizes(170), [120, 50])
        self.assertEqual(drip_log.chunk_sizes(120), [120])
        self.assertEqual(drip_log.chunk_sizes(30), [30])

    def test_no_sessions_new_entries_split_at_2h(self):
        self.run_log(180, ["Built export", "Tested export"], billable=0)
        rows = self.conn.execute("SELECT duration_minutes, comment, billable, marked_to_log, logged, title, date"
                                 " FROM adhoc_entries ORDER BY start_time").fetchall()
        self.assertEqual([tuple(r) for r in rows], [
            (120, "Built export", 0, 1, 0, "Next level - Marek Mikesz", DAY),
            (60, "Tested export", 0, 1, 0, "Next level - Marek Mikesz", DAY)])

    def test_four_sessions_log_2h_merge_into_one(self):
        for i, t in enumerate(["09:00", "09:30", "10:00", "10:30"]):
            self.session(f"s{i}", t, 25)
        self.run_log(120, ["Mapped fields; fixed VAT"])
        rows = self.conn.execute("SELECT id, duration_minutes, comment, end_at FROM pomodoro_sessions").fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["id"], rows[0]["duration_minutes"], rows[0]["comment"]),
                         ("s0", 120, "Mapped fields; fixed VAT"))
        self.assertEqual(rows[0]["end_at"], f"{DAY}T11:00:00.000Z")
        self.assertEqual(self.total(), 120)

    def test_shorter_number_trims(self):
        for i, t in enumerate(["09:00", "09:30", "10:00", "10:30"]):
            self.session(f"s{i}", t, 25)
        self.run_log(60)
        self.assertEqual(self.total(), 60)

    def test_longer_number_three_hours_two_entries_from_sessions(self):
        for i, t in enumerate(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]):
            self.session(f"s{i}", t, 25)
        plan = self.run_log(180)
        self.assertEqual([c["minutes"] for c in plan["chunks"]], [120, 60])
        self.assertTrue(all(c["kind"] == "session" for c in plan["chunks"]))
        self.assertEqual(self.total(), 180)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM adhoc_entries").fetchone()[0], 0)

    def test_one_session_log_3h_keeps_session_adds_new_entry(self):
        self.session("s0", "09:00", 25)
        plan = self.run_log(180)
        self.assertEqual([c["kind"] for c in plan["chunks"]], ["session", "new"])
        self.assertEqual(self.total(), 180)

    def test_named_logged_other_task_untouched(self):
        self.session("named", "08:00", 30, comment="Morning: fixed export")
        self.session("sent", "08:40", 25, logged=1)
        self.session("other", "09:00", 25, task="999")
        self.session("kick", "10:00", 27, comment="Kickoff")
        self.run_log(60, ["Afternoon work"])
        get = lambda i: self.conn.execute("SELECT duration_minutes, comment FROM pomodoro_sessions WHERE id=?", (i,)).fetchone()
        self.assertEqual(tuple(get("named")), (30, "Morning: fixed export"))
        self.assertEqual(tuple(get("sent")), (25, "Focus session"))
        self.assertEqual(tuple(get("other")), (25, "Focus session"))
        self.assertEqual(tuple(get("kick")), (60, "Afternoon work"))

    def test_finished_early_counts_as_unnamed(self):
        self.session("fe", "09:00", 12, comment="Finished early (12m)")
        self.session("own", "10:00", 12, comment="Finished early: VAT fix")
        self.run_log(30, ["Fixed VAT field"])
        get = lambda i: tuple(self.conn.execute("SELECT duration_minutes, comment FROM pomodoro_sessions WHERE id=?", (i,)).fetchone())
        self.assertEqual(get("fe"), (30, "Fixed VAT field"))
        self.assertEqual(get("own"), (12, "Finished early: VAT fix"))

    def test_past_day_new_entries_sit_on_that_day(self):
        self.conn.execute("DELETE FROM adhoc_entries")
        plan = drip_log.build_plan(self.conn, TASK, 60, "2026-11-12")
        drip_log.apply_plan(self.conn, plan, ["Yesterday work"], 1, now=NOW)
        st = self.conn.execute("SELECT start_time FROM adhoc_entries").fetchone()[0]
        local = datetime.fromisoformat(st.replace("Z", "+00:00")).astimezone()
        self.assertEqual((local.date().isoformat(), local.hour), ("2026-11-12", 16))

    def test_second_log_adds_and_keeps_first(self):
        self.session("s0", "09:00", 25)
        self.run_log(120, ["Fixed VAT field"])
        self.session("s1", "12:00", 25)
        self.run_log(60, ["Tested export with client data"])
        self.assertEqual(self.total(), 180)
        rows = drip_log.day_entries(self.conn, TASK, DAY)
        self.assertEqual([(r["minutes"], r["comment"]) for r in rows],
                         [(120, "Fixed VAT field"), (60, "Tested export with client data")])

    def test_amend_changes_length_and_comment_then_removes(self):
        self.run_log(120, ["Fixed VAT field"])
        eid = self.conn.execute("SELECT id FROM adhoc_entries").fetchone()[0]
        drip_log.amend(self.conn, eid, 90, None)
        self.assertEqual(tuple(self.conn.execute("SELECT duration_minutes, comment FROM adhoc_entries").fetchone()),
                         (90, "Fixed VAT field"))
        drip_log.amend(self.conn, eid, 90, "Fixed VAT field in export")
        self.assertEqual(self.conn.execute("SELECT comment FROM adhoc_entries").fetchone()[0], "Fixed VAT field in export")
        drip_log.amend(self.conn, eid, 0, None)
        self.assertEqual(self.total(), 0)

    def test_amend_session_moves_end_and_refuses_sent_or_over_2h(self):
        self.session("s0", "09:00", 25)
        drip_log.amend(self.conn, "s0", 45, "Built mapping")
        self.assertEqual(self.conn.execute("SELECT end_at FROM pomodoro_sessions WHERE id='s0'").fetchone()[0],
                         f"{DAY}T09:45:00.000Z")
        self.session("sent", "10:00", 25, logged=1)
        with self.assertRaises(ValueError):
            drip_log.amend(self.conn, "sent", 30, None)
        with self.assertRaises(ValueError):
            drip_log.amend(self.conn, "s0", 150, None)
        with self.assertRaises(ValueError):
            drip_log.amend(self.conn, "nope", 30, None)

    def test_other_day_ignored(self):
        self.conn.execute("INSERT INTO pomodoro_sessions (id, start_at, duration_minutes, task_id, comment)"
                          " VALUES ('y', '2026-11-12T09:00:00.000Z', 25, ?, NULL)", (TASK,))
        plan = self.run_log(30)
        self.assertEqual(plan["chunks"][0]["kind"], "new")

    def test_comment_count_must_match(self):
        plan = drip_log.build_plan(self.conn, TASK, 180, DAY)
        with self.assertRaises(ValueError):
            drip_log.apply_plan(self.conn, plan, ["only one"], 1, now=NOW)
        self.assertEqual(self.total(), 0)

    def test_cli_rejects_bad_input(self):
        self.assertEqual(drip_log.main(["plan", "--task", "abc", "--minutes", "30", "--db", str(self.db)]), 2)
        self.assertEqual(drip_log.main(["plan", "--task", TASK, "--minutes", "0", "--db", str(self.db)]), 2)
        self.assertEqual(drip_log.main(["apply", "--task", TASK, "--minutes", "30", "--comment", "x",
                                        "--db", str(self.db)]), 2)


if __name__ == "__main__":
    unittest.main()
