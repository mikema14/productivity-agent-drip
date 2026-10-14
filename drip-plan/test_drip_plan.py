#!/usr/bin/env python3
"""Tests for drip_plan.py — each test runs on its own temp DB built from Drip's
real `lists` / `list_items` schema (copied from the live file, incl. migrations).
Easy8 is stubbed; nothing touches the real DB or the network.

Run: python3 -m unittest drip-plan/test_drip_plan.py   (or cd drip-plan && python3 -m unittest)
"""
import io
import json
import re
import sqlite3
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).parent))
import drip_plan  # noqa: E402

SCHEMA = """
CREATE TABLE lists (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#10b981', icon_path TEXT,
  task_id TEXT, "order" INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archived INTEGER DEFAULT 0, billable INTEGER NOT NULL DEFAULT 1);
CREATE TABLE list_items (
  id TEXT PRIMARY KEY, list_id TEXT NOT NULL, title TEXT NOT NULL, task_id TEXT,
  "column" TEXT NOT NULL DEFAULT 'backlog' CHECK("column" IN ('backlog','this_week','today')),
  "order" INTEGER NOT NULL DEFAULT 0, completed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, archived INTEGER DEFAULT 0, completed_at DATETIME,
  description TEXT, subtasks TEXT DEFAULT '[]', billable INTEGER NOT NULL DEFAULT 1, today_since TEXT,
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE);
"""

TODAY = date.today().isoformat()


def issue(**kw):
    base = {"id": 1, "subject": "Easy8 subject", "status": {"id": 15, "name": "Realisation"},
            "assigned_to": {"id": 28668, "name": "Marek Mikesz"}, "due_date": None,
            "updated_on": "2026-10-01T10:00:00Z"}
    base.update(kw)
    return base


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "plan.db"
        c = sqlite3.connect(self.db)
        c.executescript(SCHEMA)
        c.executemany('INSERT INTO lists (id, name, task_id, "order", billable) VALUES (?,?,?,?,?)', [
            ("L1", "Folder", None, 0, 0),
            ("L2", "Bound", "667776", 1, 1),
        ])
        c.executemany('INSERT INTO list_items (id, list_id, title, task_id, "column", "order", today_since) '
                      "VALUES (?,?,?,?,?,?,?)", [
            ("aaaa1111-0000-0000-0000-000000000001", "L1", "Write spec", "700001", "backlog", 0, None),
            ("aaaa2222-0000-0000-0000-000000000002", "L1", "Review PR", "700002", "today", 0, "2026-10-01"),
            ("bbbb1111-0000-0000-0000-000000000003", "L1", "Plain item", None, "today", 5, "2026-10-02"),
            ("cccc1111-0000-0000-0000-000000000004", "L2", "Bound one", None, "backlog", 0, None),
            ("cccc2222-0000-0000-0000-000000000005", "L2", "Bound two", None, "this_week", 0, None),
        ])
        c.commit()
        c.close()

    def tearDown(self):
        self.tmp.cleanup()

    def run_cli(self, *argv, stub=None):
        out, err = io.StringIO(), io.StringIO()
        fake = stub or (lambda tid, journals=False: issue(id=int(tid)))
        with mock.patch.object(drip_plan, "run_easy8", side_effect=fake), redirect_stdout(out), redirect_stderr(err):
            code = drip_plan.main(["--db", str(self.db), *argv])
        return code, out.getvalue(), err.getvalue()

    def row(self, item_id):
        c = sqlite3.connect(self.db)
        c.row_factory = sqlite3.Row
        r = c.execute('SELECT *, "column" AS col, "order" AS ord FROM list_items WHERE id = ?', (item_id,)).fetchone()
        c.close()
        return r

    def count(self, sql, *p):
        c = sqlite3.connect(self.db)
        n = c.execute(sql, p).fetchone()[0]
        c.close()
        return n


class TestMove(Base):
    def test_move_into_today_appends_and_sets_today_since(self):
        code, out, _ = self.run_cli("move", "700001", "today")
        self.assertEqual(code, 0, out)
        r = self.row("aaaa1111-0000-0000-0000-000000000001")
        self.assertEqual(r["col"], "today")
        self.assertEqual(r["ord"], 6)  # max(0, 5) + 1
        self.assertEqual(r["today_since"], TODAY)
        self.assertIn("backlog → today", out)

    def test_leaving_today_clears_today_since(self):
        self.run_cli("move", "aaaa2222", "this_week")
        r = self.row("aaaa2222-0000-0000-0000-000000000002")
        self.assertEqual((r["col"], r["ord"], r["today_since"]), ("this_week", 0, None))

    def test_same_column_keeps_today_since(self):
        code, out, _ = self.run_cli("move", "aaaa2222", "today")
        self.assertEqual(code, 0)
        self.assertIn("UNCHANGED", out)
        self.assertEqual(self.row("aaaa2222-0000-0000-0000-000000000002")["today_since"], "2026-10-01")

    def test_today_since_port(self):
        f = drip_plan.today_since_for
        self.assertEqual(f("today", "today", "2026-10-01", "2026-10-14"), "2026-10-01")
        self.assertEqual(f("backlog", "today", None, "2026-10-14"), "2026-10-14")
        self.assertIsNone(f("today", "backlog", "2026-10-01", "2026-10-14"))

    def test_dry_run_writes_nothing(self):
        code, out, _ = self.run_cli("move", "700001", "today", "--dry-run")
        self.assertEqual(code, 0)
        self.assertTrue(out.startswith("DRY RUN: MOVED"))
        self.assertEqual(self.row("aaaa1111-0000-0000-0000-000000000001")["col"], "backlog")


class TestRefs(Base):
    def test_ambiguous_task_ref_lists_matches(self):
        # both L2 items take the list's task id 667776 (list wins over item)
        code, _, err = self.run_cli("move", "667776", "today")
        self.assertEqual(code, 1)
        self.assertIn("Ambiguous", err)
        self.assertIn("cccc1111", err)
        self.assertIn("cccc2222", err)

    def test_ambiguous_prefix(self):
        code, _, err = self.run_cli("done", "aaaa")
        self.assertEqual(code, 1)
        self.assertIn("matches 2 items", err)

    def test_short_prefix_rejected(self):
        code, _, err = self.run_cli("done", "aaa")
        self.assertEqual(code, 1)
        self.assertIn("No open item", err)

    def test_unique_prefix_resolves(self):
        code, _, _ = self.run_cli("move", "cccc2222", "today")
        self.assertEqual(code, 0)
        self.assertEqual(self.row("cccc2222-0000-0000-0000-000000000005")["col"], "today")


class TestDoneReopen(Base):
    def test_done_then_reopen(self):
        iid = "aaaa1111-0000-0000-0000-000000000001"
        code, _, _ = self.run_cli("done", "700001")
        self.assertEqual(code, 0)
        r = self.row(iid)
        self.assertEqual(r["completed"], 1)
        self.assertRegex(r["completed_at"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$")  # JS toISOString
        # completed items no longer resolve as open
        self.assertEqual(self.run_cli("done", "700001")[0], 1)
        code, out, _ = self.run_cli("reopen", "700001")
        self.assertEqual(code, 0, out)
        r = self.row(iid)
        self.assertEqual((r["completed"], r["completed_at"], r["archived"]), (0, None, 0))


class TestRemove(Base):
    def test_remove_archives_and_reopen_restores(self):
        iid = "bbbb1111-0000-0000-0000-000000000003"
        code, out, _ = self.run_cli("remove", "bbbb1111")
        self.assertEqual(code, 0, out)
        r = self.row(iid)
        self.assertEqual((r["archived"], r["completed"]), (1, 0))
        self.assertEqual(self.count("SELECT COUNT(*) FROM list_items WHERE id = ?", iid), 1)  # not deleted
        _, listed, _ = self.run_cli("list", "--json")
        self.assertNotIn(iid, [i["id"] for i in json.loads(listed)])
        self.run_cli("reopen", "bbbb1111")
        self.assertEqual(self.row(iid)["archived"], 0)

    def test_remove_dry_run(self):
        code, out, _ = self.run_cli("remove", "700002", "--dry-run")
        self.assertEqual(code, 0)
        self.assertIn("DRY RUN: REMOVED", out)
        self.assertEqual(self.row("aaaa2222-0000-0000-0000-000000000002")["archived"], 0)


class TestAdd(Base):
    def test_add_with_title_from_easy8(self):
        code, out, _ = self.run_cli("add", "712345", "--list", "folder", "--column", "today")
        self.assertEqual(code, 0, out)
        c = sqlite3.connect(self.db)
        r = c.execute('SELECT title, list_id, "column", "order", billable, today_since, completed, id '
                      "FROM list_items WHERE task_id = '712345'").fetchone()
        c.close()
        self.assertEqual(r[:7], ("Easy8 subject", "L1", "today", 6, 0, TODAY, 0))  # billable from list L1
        self.assertRegex(r[7], r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")

    def test_duplicate_refused_unless_force(self):
        code, _, err = self.run_cli("add", "700001", "--list", "Folder", "--title", "Again")
        self.assertEqual(code, 1)
        self.assertIn("already exists", err)
        code, _, _ = self.run_cli("add", "700001", "--list", "Folder", "--title", "Again", "--force")
        self.assertEqual(code, 0)
        self.assertEqual(self.count("SELECT COUNT(*) FROM list_items WHERE task_id = '700001'"), 2)

    def test_duplicate_uses_effective_task_id(self):
        # list L2 is bound to 667776 and has open items with item.task_id NULL
        code, _, err = self.run_cli("add", "667776", "--title", "Sub job")
        self.assertEqual(code, 1)
        self.assertIn("already exists", err)
        self.assertIn("cccc1111", err)

    def test_default_list_is_bound_list_and_item_task_null(self):
        code, out, _ = self.run_cli("add", "667776", "--title", "Sub job", "--force")
        self.assertEqual(code, 0, out)
        c = sqlite3.connect(self.db)
        r = c.execute("SELECT list_id, task_id, billable, \"order\" FROM list_items WHERE title = 'Sub job'").fetchone()
        c.close()
        self.assertEqual(r, ("L2", None, 1, 1))

    def test_no_matching_list_asks_for_list(self):
        code, _, err = self.run_cli("add", "799999")
        self.assertEqual(code, 1)
        self.assertIn("--list", err)

    def test_easy8_error_asks_for_title(self):
        def boom(tid, journals=False):
            raise drip_plan.PlanError("Issue not found")
        code, _, err = self.run_cli("add", "799999", "--list", "Folder", stub=boom)
        self.assertEqual(code, 1)
        self.assertIn("--title", err)

    def test_add_dry_run(self):
        before = self.count("SELECT COUNT(*) FROM list_items")
        code, out, _ = self.run_cli("add", "712345", "--list", "Folder", "--dry-run")
        self.assertEqual(code, 0)
        self.assertIn("DRY RUN: ADDED", out)
        self.assertEqual(self.count("SELECT COUNT(*) FROM list_items"), before)


class TestBusy(Base):
    def test_locked_db_clean_error(self):
        holder = sqlite3.connect(self.db, isolation_level=None)
        holder.execute("BEGIN EXCLUSIVE")
        try:
            with mock.patch.object(drip_plan, "BUSY_TIMEOUT_S", 0.1):
                code, _, err = self.run_cli("move", "700001", "today")
        finally:
            holder.execute("ROLLBACK")
            holder.close()
        self.assertEqual(code, 1)
        self.assertIn("ERROR: Drip database is busy, try again", err)
        self.assertEqual(self.row("aaaa1111-0000-0000-0000-000000000001")["col"], "backlog")


class TestAddList(Base):
    def test_add_list_from_task(self):
        code, out, _ = self.run_cli("add-list", "680000")
        self.assertEqual(code, 0, out)
        c = sqlite3.connect(self.db)
        r = c.execute('SELECT name, color, task_id, "order", billable, archived, icon_path FROM lists '
                      "WHERE task_id = '680000'").fetchone()
        c.close()
        self.assertEqual(r, ("Easy8 subject", "#10b981", "680000", 2, 1, 0, None))

    def test_duplicate_task_list_refused(self):
        code, _, err = self.run_cli("add-list", "667776", "--name", "Other")
        self.assertEqual(code, 1)
        self.assertIn("already logs to 667776", err)

    def test_folder_list_needs_name(self):
        self.assertEqual(self.run_cli("add-list")[0], 1)
        code, _, _ = self.run_cli("add-list", "--name", "Ideas", "--not-billable")
        self.assertEqual(code, 0)
        self.assertEqual(self.count("SELECT billable FROM lists WHERE name = 'Ideas' AND task_id IS NULL"), 0)

    def test_add_list_dry_run(self):
        code, out, _ = self.run_cli("add-list", "680000", "--name", "X", "--dry-run")
        self.assertEqual(code, 0)
        self.assertIn("DRY RUN: ADDED LIST", out)
        self.assertEqual(self.count("SELECT COUNT(*) FROM lists"), 2)


class TestStatusReview(Base):
    def test_status_hints_and_cache(self):
        calls = []
        today = date.today()
        week_end = today + timedelta(days=6 - today.weekday())

        def stub(tid, journals=False):
            calls.append(tid)
            if tid == "700001":
                return issue(due_date=today.isoformat(), assigned_to={"id": 5, "name": "Jana"})
            if tid == "700002":
                return issue(status={"id": 5, "name": "Closed"})
            if tid == "667776":
                return issue(due_date=week_end.isoformat() if week_end > today else None)
            raise RuntimeError("boom")

        code, out, _ = self.run_cli("status", "--json", stub=stub)
        self.assertEqual(code, 0)
        data = {e["short_id"]: e for e in json.loads(out)}
        self.assertEqual(sorted(calls), ["667776", "700001", "700002"])  # one call per task id
        self.assertIn("due today → suggest today", data["aaaa1111"]["hints"])
        self.assertIn("note: assigned to Jana", data["aaaa1111"]["hints"])
        self.assertIn("closed in Easy8 → suggest done", data["aaaa2222"]["hints"])
        if week_end > today:
            self.assertIn("due this week → suggest this_week", data["cccc1111"]["hints"])
            self.assertEqual(data["cccc2222"]["hints"], [])  # already in this_week
        self.assertNotIn("bbbb1111", data)  # no task id

    def test_status_tolerates_cli_errors(self):
        def stub(tid, journals=False):
            raise RuntimeError("timeout")
        code, out, _ = self.run_cli("status", stub=stub)
        self.assertEqual(code, 0)
        self.assertIn("ERROR timeout", out)

    def test_review_digest(self):
        now = datetime.now(timezone.utc)
        recent = (now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        old = (now - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
        seen = []

        def stub(tid, journals=False):
            seen.append(journals)
            return issue(journals=[
                {"user": {"name": "Jana"}, "notes": "<p>Old &amp; done</p>", "created_on": old, "details": []},
                {"user": {"name": "Petr"}, "notes": "<p>" + "x" * 300 + "</p>", "created_on": recent,
                 "details": [{"property": "attr", "name": "done_ratio", "old_value": "20", "new_value": "50"},
                             {"property": "attr", "name": "status_id", "old_value": "1", "new_value": "15"}]},
            ])

        code, out, _ = self.run_cli("review", "--since", "7d", "--column", "backlog", "--json", stub=stub)
        self.assertEqual(code, 0)
        self.assertTrue(all(seen))
        data = json.loads(out)
        self.assertEqual(data["since_days"], 7)
        e = data["items"][0]
        self.assertEqual(len(e["changes"]), 3)
        self.assertTrue(any("done % 20 → 50" in c for c in e["changes"]))
        self.assertTrue(any("status changed" in c for c in e["changes"]))
        self.assertEqual(len(e["latest_comments"]), 2)
        self.assertTrue(e["latest_comments"][0]["recent"])
        self.assertLessEqual(len(e["latest_comments"][0]["text"]), 200)
        self.assertEqual(e["latest_comments"][1]["text"], "Old & done")
        code, text, _ = self.run_cli("review", stub=stub)
        self.assertEqual(code, 0)
        self.assertTrue(re.search(r"== today \(\d\) ==", text))

    def test_to_backlog_status_counts_as_closed(self):
        self.assertTrue(drip_plan.is_closed(issue(status={"id": 30, "name": "To backlog"})))
        self.assertFalse(drip_plan.is_closed(issue(status={"id": 15, "name": "Realisation"})))
        self.assertTrue(drip_plan.is_closed(issue(status={"id": 1, "name": "New", "is_closed": True})))

    def test_private_notes_shown_as_private(self):
        now = datetime.now(timezone.utc)
        iss = issue(journals=[{"user": {"name": "Jana"}, "notes": "secret plan", "private_notes": True,
                               "created_on": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "details": []}])
        d = drip_plan.journal_digest(iss, 7, now + timedelta(seconds=1))
        self.assertEqual(d["changes"][0].split(" ", 1)[1], "private note (Jana)")
        self.assertEqual(d["latest_comments"][0]["text"], "private note: secret plan")
        self.assertTrue(d["latest_comments"][0]["private"])

    def test_compact_changes(self):
        out = drip_plan.compact_changes(["2026-10-14 description edited (A)", "2026-10-12 description edited (B)",
                                         "2026-10-12 due date - → 2026-10-15 (B)"])
        self.assertEqual(out, "description edited ×2; due date - → 2026-10-15")

    def test_list_filters(self):
        _, out, _ = self.run_cli("list", "--column", "today", "--json")
        items = json.loads(out)
        self.assertEqual({i["short_id"] for i in items}, {"aaaa2222", "bbbb1111"})
        _, out, _ = self.run_cli("list", "--list", "bound", "--json")
        self.assertEqual({i["task_id"] for i in json.loads(out)}, {"667776"})


if __name__ == "__main__":
    unittest.main()
