#!/usr/bin/env node
/**
 * Real-database safety protocol for the e2e smoke (PHASE1_PLAN.md §4).
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
const MUST_BE_EMPTY = ['pomodoro_sessions', 'adhoc_entries', 'lists', 'list_items', 'task_cache', 'log_templates', 'task_preferences', 'milestones', 'goals'];
const LOGGED_TABLES = ['pomodoro_sessions', 'adhoc_entries', 'calendar_proposals'];

function usage(code = 0) {
  console.log(`Usage:
  node e2e/db-guard.mjs prepare
  node e2e/db-guard.mjs verify-and-clean <backupDir> <main.log>
  node e2e/db-guard.mjs --help

Preconditions (enforced by smoke.mjs): the installed Drip is quit and no
"npm run dev" is running, because both share ${DB_PATH}.`);
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
  };
  for (const t of ROWID_TABLES) {
    if (!tableExists(t)) continue;
    const [row] = sql(`SELECT max(rowid) AS maxRowid, count(*) AS count FROM ${t}`);
    snapshot.rowid[t] = { maxRowid: row.maxRowid ?? 0, count: row.count };
  }
  for (const t of CONTENT_TABLES) {
    if (tableExists(t)) snapshot.content[t] = sql(`SELECT * FROM ${t}`);
  }
  for (const t of LOGGED_TABLES) {
    snapshot.logged[t] = sql(`SELECT id, logged, log_sent_at, server_entry_id FROM ${t} WHERE logged=1 ORDER BY id`);
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

  // (c) Inserts
  for (const [t, snap] of Object.entries(snapshot.rowid)) {
    const rows = sql(`SELECT rowid AS __rowid, * FROM ${t} WHERE rowid > ${snap.maxRowid}`);
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
        if (MUST_BE_EMPTY.includes(t)) violations.push(`${t}: ${rows.length} unexpected insert(s) (deleted)`);
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

  // (c) date-keyed tables → restore changed rows
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
    line(t, 0, 0, updated, updated);
  }

  // (c) list_items archived/column/order → report only (Q7)
  if (tableExists('list_items')) {
    const before = new Map(snapshot.listItems.map(r => [r.id, r]));
    const drift = sql('SELECT id, archived, completed, "column", "order" FROM list_items')
      .filter(r => before.has(r.id) && JSON.stringify(before.get(r.id)) !== JSON.stringify(r));
    for (const r of drift) console.log(`[db-guard] list_items: ${r.id} changed (was ${JSON.stringify(before.get(r.id))}, now ${JSON.stringify(r)}) — not reverted (Q7)`);
    line('list_items (state)', 0, 0, drift.length, 0);
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
    const [{ n }] = sql(`SELECT count(*) AS n FROM ${t} WHERE log_sent_at >= ${q(snapshot.run_start_utc)} OR (logged=1 AND rowid > ${max})`);
    if (n) violations.push(`${t}: ${n} row(s) logged during the run`);
    const loggedNow = sql(`SELECT id, logged, log_sent_at, server_entry_id FROM ${t} WHERE logged=1 ORDER BY id`);
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
