#!/usr/bin/env node
/**
 * Real-database safety protocol for the e2e smoke (PHASE1_PLAN.md §4,
 * PHASE2_PLAN.md §7.2, PHASE3_PLAN.md §7.2).
 *
 *   node e2e/db-guard.mjs prepare                       → backup + snapshot, prints the backup dir
 *   node e2e/db-guard.mjs verify-and-clean <backupDir> <main.log>
 *                                                        → delete inserts, restore updates, assert no POST
 *
 * Uses the sqlite3 CLI (better-sqlite3 in node_modules is built for Electron's
 * ABI). Never deletes backups. Exit code 1 on any violation.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const SQLITE = '/usr/bin/sqlite3';
export const USER_DATA = join(homedir(), 'Library', 'Application Support', 'drip');
export const DB_PATH = join(USER_DATA, 'productivity.db');
const BACKUP_ROOT = join(USER_DATA, 'backups');

/** Rowid tables keyed by TEXT PRIMARY KEY: inserts are detected by rowid. */
const ROWID_TABLES = [
  'pomodoro_sessions', 'adhoc_entries', 'calendar_proposals', 'list_items', 'lists',
  'task_cache', 'log_templates', 'task_preferences', 'milestones', 'goals',
];
/** Tables updated in place; snapshotted by content. */
const CONTENT_TABLES = ['daily_intentions', 'shutdown_rituals', 'daily_summaries', 'weekly_summaries'];
/** Tables where a run must never create anything. */
const MUST_BE_EMPTY = ['pomodoro_sessions', 'adhoc_entries', 'lists', 'list_items', 'log_templates', 'task_preferences', 'milestones', 'goals'];
/**
 * Cache tables (P17): the Plan walk resolves names for every task id on the
 * boards, and an uncached id triggers a legitimate GET that fills task_cache.
 * Inserts are deleted and reported, not violations. Replaced rows are
 * restored from the backup like everywhere else.
 */
const CACHE_TABLES = ['task_cache'];
const LOGGED_TABLES = ['pomodoro_sessions', 'adhoc_entries', 'calendar_proposals'];
/**
 * Entry tables (Phase 3): the Review walk never toggles, edits, accepts,
 * dismisses, moves or bills anything, so any change to these columns on a
 * pre-existing row is a violation (restored from the backup).
 */
const ENTRY_TABLES = {
  pomodoro_sessions: ['task_id', 'comment', 'duration_minutes', 'billable', 'start_at', 'logged'],
  adhoc_entries: ['date', 'duration_minutes', 'title', 'task_id', 'comment', 'marked_to_log', 'logged', 'billable', 'start_time'],
  calendar_proposals: ['accepted', 'dismissed', 'task_id', 'comment', 'date', 'start_at', 'end_at', 'duration_minutes', 'logged', 'billable'],
};
/** The ICS sync may legitimately rewrite these on an existing proposal when the feed changed: restore + report, not a violation. */
const FEED_DRIFT_COLUMNS = ['title', 'start_at', 'end_at', 'duration_minutes'];
/** Only End Day and the intention modal write these; the walk uses neither → restore + violation. */
const MUST_NOT_CHANGE = ['shutdown_rituals', 'daily_intentions'];

function usage(code = 0) {
  console.log(`Usage:
  node e2e/db-guard.mjs prepare
  node e2e/db-guard.mjs verify-and-clean <backupDir> <main.log>
  node e2e/db-guard.mjs --help

Preconditions (enforced by smoke.mjs): the installed Drip is quit and no
"npm run dev" is running, because both share ${DB_PATH}.
The Plan walk toggles Done / IDs and restores them; localStorage is outside
the guard. task_cache rows fetched during the run are deleted and reported,
not violations. The Review walk navigates one day back and forth (calendar
sync inserts for those days are deleted), opens and cancels the Add Entry /
Templates / End Day modals, and never marks, edits, logs or ends a day: any
change to a pre-existing entry row, shutdown ritual or daily intention is a
violation (restored from the backup).`);
  process.exit(code);
}

function sql(query, { json = true } = {}) {
  const args = json ? ['-json', DB_PATH, query] : [DB_PATH, query];
  const out = execFileSync(SQLITE, args, { encoding: 'utf8' });
  if (!json) return out;
  return out.trim() ? JSON.parse(out) : [];
}

function q(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function columns(table) {
  return sql(`PRAGMA table_info(${table})`).map(c => c.name);
}

/** Not every logged table has log_sent_at / server_entry_id. */
function loggedQuery(table) {
  const cols = ['id', 'logged', 'log_sent_at', 'server_entry_id'].filter(c => columns(table).includes(c));
  return `SELECT ${cols.join(', ')} FROM ${table} WHERE logged=1 ORDER BY id`;
}

function tableExists(name) {
  return sql(`SELECT name FROM sqlite_master WHERE type='table' AND name=${q(name)}`).length > 0;
}

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}

export function prepare() {
  if (!existsSync(DB_PATH)) {
    console.error(`No database at ${DB_PATH}`);
    process.exit(1);
  }
  const backupDir = join(BACKUP_ROOT, utcStamp());
  mkdirSync(backupDir, { recursive: true });

  // (a) Consistent backup including WAL content, plus raw copies of the sidecars.
  execFileSync(SQLITE, [DB_PATH, `.backup '${join(backupDir, 'productivity.db')}'`]);
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(DB_PATH + suffix)) copyFileSync(DB_PATH + suffix, join(backupDir, 'productivity.db' + suffix));
  }

  // (b) Snapshot in the database's own clock.
  const snapshot = {
    run_start_utc: sql(`SELECT strftime('%Y-%m-%d %H:%M:%S','now') AS t`)[0].t,
    rowid: {},
    settings: sql('SELECT key, value FROM settings ORDER BY key'),
    content: {},
    listItems: tableExists('list_items')
      ? sql('SELECT id, archived, completed, "column", "order" FROM list_items ORDER BY id')
      : [],
    logged: {},
    entries: {},
  };
  for (const [t, cols] of Object.entries(ENTRY_TABLES)) {
    if (!tableExists(t)) continue;
    const present = cols.filter(c => columns(t).includes(c));
    snapshot.entries[t] = { cols: present, rows: sql(`SELECT id, ${present.map(c => `"${c}"`).join(', ')} FROM ${t} ORDER BY id`) };
  }
  for (const t of ROWID_TABLES) {
    if (!tableExists(t)) continue;
    const [row] = sql(`SELECT max(rowid) AS maxRowid, count(*) AS count FROM ${t}`);
    snapshot.rowid[t] = { maxRowid: row.maxRowid ?? 0, count: row.count };
  }
  for (const t of CONTENT_TABLES) {
    if (tableExists(t)) snapshot.content[t] = sql(`SELECT * FROM ${t}`);
  }
  for (const t of LOGGED_TABLES) {
    snapshot.logged[t] = sql(loggedQuery(t));
  }

  writeFileSync(join(backupDir, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
  console.log(`[db-guard] backup + snapshot at ${backupDir}`);
  return backupDir;
}

function primaryKey(table) {
  const cols = sql(`PRAGMA table_info(${table})`);
  return cols.find(c => c.pk === 1)?.name ?? 'rowid';
}

export function verifyAndClean(backupDir, logPath) {
  const snapshot = JSON.parse(readFileSync(join(backupDir, 'snapshot.json'), 'utf8'));
  const report = [];
  const violations = [];
  const line = (table, inserted, deleted, updated, restored) => report.push({ table, inserted, deleted, updated, restored });

  // (c) Inserts. A rowid above the snapshot can also be an INSERT OR REPLACE of
  // an existing key (task_cache): restore those from the backup instead of deleting.
  const bk = join(backupDir, 'productivity.db');
  const withBackup = (query) => sql(`ATTACH ${q(bk)} AS bk; ${query}`);
  for (const [t, snap] of Object.entries(snapshot.rowid)) {
    const pk = primaryKey(t);
    const replaced = pk === 'rowid' ? [] : withBackup(`SELECT "${pk}" AS k FROM main.${t} WHERE rowid > ${snap.maxRowid} AND "${pk}" IN (SELECT "${pk}" FROM bk.${t})`);
    for (const { k } of replaced) {
      withBackup(`DELETE FROM main.${t} WHERE "${pk}"=${q(k)}; INSERT INTO main.${t} SELECT * FROM bk.${t} WHERE "${pk}"=${q(k)}`);
      console.log(`[db-guard] ${t}: ${k} was replaced → restored from backup`);
    }
    const rows = sql(`SELECT rowid AS __rowid, * FROM ${t} WHERE rowid > ${snap.maxRowid}`)
      .filter(r => !replaced.some(x => String(x.k) === String(r[pk])));
    let deleted = 0;
    if (rows.length) {
      console.log(`[db-guard] ${t}: ${rows.length} inserted row(s)`);
      for (const r of rows) console.log('   ', JSON.stringify(r));
      if (t === 'calendar_proposals') {
        const safe = rows.filter(r => r.accepted === 0 && r.dismissed === 0 && r.task_id === null && (r.comment ?? null) === null);
        const kept = rows.length - safe.length;
        if (safe.length) sql(`DELETE FROM ${t} WHERE rowid IN (${safe.map(r => r.__rowid).join(',')})`, { json: false });
        deleted = safe.length;
        if (kept) console.log(`[db-guard] ${t}: ${kept} inserted row(s) had user data and were NOT deleted`);
      } else {
        sql(`DELETE FROM ${t} WHERE rowid IN (${rows.map(r => r.__rowid).join(',')})`, { json: false });
        deleted = rows.length;
        if (CACHE_TABLES.includes(t)) console.log(`[db-guard] ${t}: ${rows.length} cache row(s) fetched during the run — deleted`);
        else if (MUST_BE_EMPTY.includes(t)) violations.push(`${t}: ${rows.length} unexpected insert(s) (deleted)`);
      }
    }
    line(t, rows.length, deleted, 0, 0);
  }

  // (c) settings diff → restore
  const before = new Map(snapshot.settings.map(r => [r.key, r.value]));
  const after = new Map(sql('SELECT key, value FROM settings').map(r => [r.key, r.value]));
  let settingsUpdated = 0;
  for (const [key, value] of after) {
    if (!before.has(key)) {
      settingsUpdated++;
      console.log(`[db-guard] settings: added ${key} → removed`);
      sql(`DELETE FROM settings WHERE key=${q(key)}`, { json: false });
    } else if (before.get(key) !== value) {
      settingsUpdated++;
      console.log(`[db-guard] settings: ${key} changed → restored`);
      sql(`INSERT OR REPLACE INTO settings (key, value) VALUES (${q(key)}, ${q(before.get(key))})`, { json: false });
    }
  }
  for (const [key, value] of before) {
    if (!after.has(key)) {
      settingsUpdated++;
      console.log(`[db-guard] settings: ${key} deleted → restored`);
      sql(`INSERT OR REPLACE INTO settings (key, value) VALUES (${q(key)}, ${q(value)})`, { json: false });
    }
  }
  line('settings', 0, 0, settingsUpdated, settingsUpdated);

  // (c) date-keyed tables → restore changed rows; rituals / intentions are violations (Phase 3)
  for (const [t, rows] of Object.entries(snapshot.content)) {
    const pk = primaryKey(t);
    const now = new Map(sql(`SELECT * FROM ${t}`).map(r => [String(r[pk]), r]));
    let updated = 0;
    for (const r of rows) {
      const cur = now.get(String(r[pk]));
      if (!cur || JSON.stringify(cur) !== JSON.stringify(r)) {
        updated++;
        const cols = Object.keys(r);
        sql(`INSERT OR REPLACE INTO ${t} (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(c => q(r[c])).join(',')})`, { json: false });
        console.log(`[db-guard] ${t}: ${r[pk]} changed → restored`);
      }
    }
    for (const key of now.keys()) {
      if (!rows.some(r => String(r[pk]) === key)) {
        updated++;
        sql(`DELETE FROM ${t} WHERE "${pk}"=${q(key)}`, { json: false });
        console.log(`[db-guard] ${t}: ${key} added → removed`);
      }
    }
    if (updated && MUST_NOT_CHANGE.includes(t)) violations.push(`${t}: ${updated} row(s) changed during the run (restored)`);
    line(t, 0, 0, updated, updated);
  }

  // (c) entry-table drift (Phase 3): pre-existing rows whose tracked columns
  // changed are restored from the backup. Feed-driven columns on
  // calendar_proposals are reported as drift; everything else is a violation.
  for (const [t, snap] of Object.entries(snapshot.entries ?? {})) {
    if (!tableExists(t)) continue;
    const before = new Map(snap.rows.map(r => [String(r.id), r]));
    const cols = snap.cols;
    const now = sql(`SELECT id, ${cols.map(c => `"${c}"`).join(', ')} FROM ${t}`);
    let feedDrift = 0;
    let changed = 0;
    for (const r of now) {
      const was = before.get(String(r.id));
      if (!was) continue; // inserts are handled above
      const diff = cols.filter(c => JSON.stringify(was[c] ?? null) !== JSON.stringify(r[c] ?? null));
      if (!diff.length) continue;
      const onlyFeed = t === 'calendar_proposals' && diff.every(c => FEED_DRIFT_COLUMNS.includes(c));
      withBackup(`DELETE FROM main.${t} WHERE id=${q(r.id)}; INSERT INTO main.${t} SELECT * FROM bk.${t} WHERE id=${q(r.id)}`);
      if (onlyFeed) {
        feedDrift++;
        console.log(`[db-guard] ${t}: ${r.id} feed drift on ${diff.join(', ')} → restored`);
      } else {
        changed++;
        console.log(`[db-guard] ${t}: ${r.id} changed ${diff.join(', ')} (was ${JSON.stringify(was)}, now ${JSON.stringify(r)}) — VIOLATION, restored`);
      }
    }
    if (changed) violations.push(`${t}: ${changed} row(s) changed during the run (restored)`);
    line(`${t} (entry drift)`, 0, 0, changed + feedDrift, changed + feedDrift);
  }

  // (c) list_items state drift: `archived` flips alone are archiveOldCompleted
  // (report only, Q7); any column / order / completed change could only come
  // from a drag, an arrow, or a checkbox, which the walk never uses → violation.
  if (tableExists('list_items')) {
    const before = new Map(snapshot.listItems.map(r => [r.id, r]));
    const drift = sql('SELECT id, archived, completed, "column", "order" FROM list_items')
      .filter(r => before.has(r.id) && JSON.stringify(before.get(r.id)) !== JSON.stringify(r));
    let archivedFlips = 0;
    let moved = 0;
    for (const r of drift) {
      const was = before.get(r.id);
      const stateChanged = was.column !== r.column || was.order !== r.order || was.completed !== r.completed;
      if (stateChanged) {
        moved++;
        sql(`UPDATE list_items SET "column"=${q(was.column)}, "order"=${q(was.order)}, completed=${q(was.completed)} WHERE id=${q(r.id)}`, { json: false });
        console.log(`[db-guard] list_items: ${r.id} column/order/completed changed (was ${JSON.stringify(was)}, now ${JSON.stringify(r)}) — VIOLATION, restored`);
      } else {
        archivedFlips++;
        console.log(`[db-guard] list_items: ${r.id} archived flip (was ${was.archived}, now ${r.archived}) — not reverted (Q7)`);
      }
    }
    if (moved) violations.push(`list_items: ${moved} row(s) changed column/order/completed during the run`);
    console.log(`[db-guard] list_items state drift: ${archivedFlips} archived flip(s), ${moved} column/order/completed change(s)`);
    line('list_items (archived)', 0, 0, archivedFlips, 0);
    line('list_items (column/order/completed)', 0, 0, moved, moved);
  }

  // (d) No time entry posted
  if (process.env.DRIP_ALLOW_API_WRITES !== undefined) violations.push('DRIP_ALLOW_API_WRITES was set in the environment');
  const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const posted = (log.match(/Posting time entry to:/g) || []).length;
  const blocked = (log.match(/\[Safety\] Blocked/g) || []).length;
  if (posted) violations.push(`main.log: ${posted} "Posting time entry to:" line(s)`);
  if (blocked) violations.push(`main.log: ${blocked} "[Safety] Blocked" line(s) — a POST was attempted`);
  for (const t of LOGGED_TABLES) {
    const max = snapshot.rowid[t]?.maxRowid ?? 0;
    const sentAt = columns(t).includes('log_sent_at') ? `log_sent_at >= ${q(snapshot.run_start_utc)} OR ` : '';
    const [{ n }] = sql(`SELECT count(*) AS n FROM ${t} WHERE ${sentAt}(logged=1 AND rowid > ${max})`);
    if (n) violations.push(`${t}: ${n} row(s) logged during the run`);
    const loggedNow = sql(loggedQuery(t));
    if (JSON.stringify(loggedNow) !== JSON.stringify(snapshot.logged[t])) violations.push(`${t}: logged rows differ from the snapshot`);
  }

  const text = [
    'table | inserted | deleted | updated | restored',
    ...report.map(r => `${r.table} | ${r.inserted} | ${r.deleted} | ${r.updated} | ${r.restored}`),
    `backup: ${backupDir}`,
    violations.length ? `VIOLATIONS:\n  - ${violations.join('\n  - ')}` : 'no violations',
  ].join('\n');
  writeFileSync(join(backupDir, 'report.txt'), text + '\n');
  console.log(text);
  return violations;
}

const [, , command, ...args] = process.argv;
const runAsCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (runAsCli) {
  if (!command || command === '--help' || command === '-h') usage(0);
  if (command === 'prepare') {
    prepare();
  } else if (command === 'verify-and-clean') {
    if (args.length < 2) usage(1);
    const violations = verifyAndClean(args[0], args[1]);
    process.exit(violations.length ? 1 : 0);
  } else {
    usage(1);
  }
}
