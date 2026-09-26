#!/usr/bin/env node
/**
 * E2E smoke: walks the Now screen through every state (PHASE1_PLAN.md §3.2),
 * the Plan screen read-only (PHASE2_PLAN.md §7.1) and the Review screen
 * read-only (PHASE3_PLAN.md §7.1), screenshotting each
 * view at 1200×800 and 800×600 against the real database under the guard.
 * Quit the installed Drip first.
 *
 *   npm run e2e:smoke
 */
import { spawn, execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { _electron as electron } from 'playwright';
import { prepare, verifyAndClean, USER_DATA } from './db-guard.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [[1200, 800], [800, 600]];
const NOW_BUDGET_MS = 240_000;
/** Kickoff rolls over at 120 s, break-complete saves a row after 60 s: leave both well before. */
const TIMER_STEP_LIMIT_MS = 45_000;

function fail(msg) {
  console.error(`[smoke] ${msg}`);
  process.exit(1);
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function preflight() {
  if (process.env.DRIP_ALLOW_API_WRITES !== undefined) fail('DRIP_ALLOW_API_WRITES is set; refusing to run');
  try {
    const pids = execSync('pgrep -x Drip', { encoding: 'utf8' }).trim();
    if (pids) fail(`the installed Drip is running (pid ${pids}); quit it first`);
  } catch {
    // pgrep exits 1 when nothing matches
  }
  if (!(await portFree(5173))) fail('port 5173 is in use; stop `npm run dev` first');
}

async function waitFor(check, timeoutMs, what) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** The three board columns must exist by label in the current scope. */
async function assertPlanColumns(page) {
  for (const label of ['Today', 'This week', 'Backlog']) {
    if (!(await page.getByRole('region', { name: label, exact: true }).count())) throw new Error(`Plan column "${label}" missing`);
  }
  // Design rule 6: id pills never carry a '#' prefix
  const ids = await page.getByTestId('plan-card-id').allTextContents();
  const hashed = ids.filter(t => t.includes('#'));
  if (hashed.length) throw new Error(`Plan id pill(s) with '#': ${hashed.join(', ')}`);
  // P18: the CTA is only ever asserted, never clicked
  const cta = page.getByRole('button', { name: /^Start on \d+$/ });
  if (await cta.count()) console.log('[smoke] Start on CTA present (not clicked)');
}

/**
 * Plan walk (PHASE2_PLAN.md §7.1), read-only by construction: toggles are
 * restored, cards are only expanded/hovered. Never drags; never clicks Start
 * on, Restore, Move left/right, Move to list, Delete, Mark done, Add a task,
 * Archive, or anything inside TaskDetailInline.
 */
async function planWalk(page, shot) {
  const subheader = page.getByTestId('plan-subheader');
  const aside = page.locator('aside[aria-label="Lists"]');

  // 1. All tasks
  await subheader.getByText('All tasks', { exact: true }).waitFor();
  await assertPlanColumns(page);
  await shot('plan-all-tasks');

  // 2. Group by list (session state only)
  const group = subheader.getByRole('button', { name: 'Group by list', exact: true });
  await group.click();
  await shot('plan-all-grouped');
  await group.click();

  // 3. Done / IDs: toggle, screenshot, restore the persisted value (localStorage, outside the DB guard)
  for (const [name, shotName] of [['Done', 'plan-all-done'], ['IDs', 'plan-all-ids']]) {
    const pill = subheader.getByRole('button', { name, exact: true });
    const before = await pill.getAttribute('aria-pressed');
    await pill.click();
    await shot(shotName);
    await pill.click();
    const after = await pill.getAttribute('aria-pressed');
    if (after !== before) throw new Error(`${name} toggle not restored (was ${before}, now ${after})`);
  }

  // 4. Card detail: title toggles TaskDetailInline open and closed (no writes: saves only fire on changed values)
  const titles = page.getByTestId('plan-card-title');
  if (await titles.count()) {
    // Click the title's start: the hover actions overlay its right end
    await titles.first().click({ position: { x: 8, y: 8 } });
    await page.getByPlaceholder('Add a description...').waitFor();
    await shot('plan-card-detail');
    await titles.first().click({ position: { x: 8, y: 8 } });
  } else {
    console.warn('[smoke] no Plan cards; skipping plan-card-detail');
  }

  // 5. Subtasks checklist (no writes)
  const badge = page.getByRole('button', { name: /^\d+\/\d+ Subtasks$/ });
  if (await badge.count()) {
    await badge.first().click();
    await shot('plan-card-subtasks');
    await badge.first().click();
  }

  // 6. Archived lists toggle (never Restore)
  const archived = aside.getByRole('button', { name: /^Archived · \d+$/ });
  if (await archived.count()) {
    await archived.click();
    await shot('plan-archived');
    await archived.click();
  }

  // 7. First list row → single-list scope
  const listRows = aside.locator('button').filter({ has: page.getByTestId('list-color') });
  if (await listRows.count()) {
    await listRows.first().click();
    await subheader.getByRole('switch').waitFor();
    await assertPlanColumns(page);
    await shot('plan-list');

    // 8. Hover the first open card so the actions show (nothing clicked)
    const cards = page.getByTestId('plan-card');
    if (await cards.count()) {
      await cards.first().hover();
      await shot('plan-card-hover');
    }
  } else {
    console.warn('[smoke] no lists; skipping plan-list');
  }
}

/** Review must have opened on today (R1) and never show a '#' before an id (rule 6). */
async function assertReviewInvariants(page) {
  const label = await page.getByTestId('review-date').textContent();
  if (!/· Today$/.test((label || '').trim())) throw new Error(`Review date label is "${label}", expected it to end with "· Today"`);
  const ids = await page.getByTestId('entry-task-id').allTextContents();
  const hashed = ids.filter(t => t.includes('#'));
  if (hashed.length) throw new Error(`Review id pill(s) with '#': ${hashed.join(', ')}`);
}

/**
 * Review walk (PHASE3_PLAN.md §7.1), read-only by construction. Never clicks:
 * any `Log this entry` checkbox, the Billable pill, Assign task, Accept,
 * Dismiss, Edit → Save, Move (row or bulk confirm), Delete, Select all, any
 * outcome pill in Today, Sync calendar, `Log N to Easy8`, End Day inside the
 * modal, Add Entry inside the modal, or anything inside the Templates manager
 * except its close. The reflection textarea is never typed into.
 */
async function reviewWalk(page, shot) {
  const table = page.locator('section[aria-label="Time entries"]');
  const toolbar = page.getByTestId('entries-toolbar');
  const footer = page.getByTestId('entries-footer');
  const aside = page.locator('aside[aria-label="Tomorrow"]');

  // 1. Landing (writes: calendar_proposals sync inserts for today + next workday; safe rows)
  await page.getByRole('heading', { name: 'Review', exact: true }).waitFor();
  await table.waitFor();
  await aside.waitFor();
  await page.waitForTimeout(800); // day load + tomorrow sync
  await shot('review-day');

  // 2. R1 proof + rule 6; the log key is asserted, never clicked
  await assertReviewInvariants(page);
  const logKey = footer.getByRole('button', { name: /^Log( \d+)? to Easy8$/ });
  if (!(await logKey.count())) throw new Error('Log to Easy8 key missing');
  console.log('[smoke] Log to Easy8 key present (not clicked)');

  // 3. Today section (nothing clicked)
  if (await page.locator('section[aria-label="Today"]').count()) await shot('review-today-section');

  // 4. Timeline → List (localStorage viewMode; restored)
  await toolbar.getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.locator('text=/^\\d\\d:00$/').first().waitFor();
  await shot('review-timeline');
  await toolbar.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByTestId('entries-columns').waitFor();

  // 5. Group by task (session state only)
  const group = toolbar.getByRole('button', { name: 'Group by task', exact: true });
  if (await group.count()) {
    await group.click();
    await shot('review-grouped');
    await group.click();
  }

  // 6. Hover the first open row; Edit → Cancel restores the buffer (no writes)
  const openRow = page.locator('[data-testid="entry-row"][data-kind="open"]').first();
  if (await openRow.count()) {
    await openRow.hover();
    await shot('review-row-hover');
    const edit = openRow.getByRole('button', { name: 'Edit', exact: true });
    if (await edit.count()) {
      await edit.click();
      await page.getByTestId('entry-editor').waitFor();
      await shot('review-row-edit');
      await openRow.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByTestId('entry-editor').waitFor({ state: 'hidden' });
    }
  } else {
    console.warn('[smoke] no open entries today; skipping review-row-hover / review-row-edit');
  }

  // 7. Date popover → Esc (no writes)
  await page.getByTestId('review-date').click();
  await page.getByTestId('calendar-popover').waitFor();
  await shot('review-date-popover');
  await page.keyboard.press('Escape');
  await page.getByTestId('calendar-popover').waitFor({ state: 'hidden' });

  // 8. Yesterday and back (writes: calendar_proposals sync for yesterday + its next workday; safe rows)
  const todayLabel = await page.getByTestId('review-date').textContent();
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await waitFor(async () => (await page.getByTestId('review-date').textContent()) !== todayLabel, 10_000, 'yesterday label');
  await page.waitForTimeout(800);
  await shot('review-yesterday');
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await waitFor(async () => (await page.getByTestId('review-date').textContent()) === todayLabel, 10_000, 'today label');
  await assertReviewInvariants(page);

  // 9. + Entry → Cancel (no writes)
  await footer.getByRole('button', { name: '+ Entry', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
  await shot('review-add-entry');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  // 10. Templates → close (getTemplates is a read)
  await toolbar.getByRole('button', { name: 'Templates', exact: true }).click();
  await page.getByRole('heading', { name: 'Manage Templates' }).waitFor();
  await shot('review-templates');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('heading', { name: 'Manage Templates' }).waitFor({ state: 'hidden' });

  // 11. End day → modal → Cancel (saveRitual only fires from the modal's End Day key, never clicked)
  const endDay = aside.getByRole('button', { name: 'End day', exact: true });
  if (await endDay.count()) {
    await endDay.click();
    await page.getByRole('heading', { name: /^End Day - \d{4}-\d{2}-\d{2}$/ }).waitFor();
    await shot('review-end-day-modal');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('heading', { name: /^End Day - / }).waitFor({ state: 'hidden' });
  } else {
    console.log('[smoke] day is locked (Day ended); skipping review-end-day-modal');
  }
}

async function main() {
  await preflight();
  // Set by VS Code's terminal; it makes Electron start as plain Node.
  delete process.env.ELECTRON_RUN_AS_NODE;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = join(ROOT, 'e2e', 'screenshots', stamp);
  mkdirSync(outDir, { recursive: true });
  const logPath = join(outDir, 'main.log');
  const logStream = createWriteStream(logPath);

  const backupDir = prepare();

  // Vite serves the renderer and emits dist-electron/ without launching Electron.
  const vite = spawn('npx', ['vite'], { cwd: ROOT, env: { ...process.env, DRIP_E2E: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  vite.stdout.on('data', d => logStream.write(`[vite] ${d}`));
  vite.stderr.on('data', d => logStream.write(`[vite] ${d}`));

  let app = null;
  let page = null;
  let violations = [];
  try {
    execFileSync('npx', ['wait-on', 'http://localhost:5173', '-t', '60000'], { cwd: ROOT, stdio: 'inherit' });
    await waitFor(() => existsSync(join(ROOT, 'dist-electron', 'main.js')), 60_000, 'dist-electron/main.js');

    app = await electron.launch({
      // The project dir, not main.js: Electron takes the app name (and so the
      // userData dir) from package.json, otherwise it falls back to "Electron".
      args: [ROOT],
      cwd: ROOT,
      env: { ...process.env, DRIP_TEST_MODE: '1', DRIP_E2E: '1' },
    });
    app.process().stdout?.on('data', d => logStream.write(`[main] ${d}`));
    app.process().stderr?.on('data', d => logStream.write(`[main] ${d}`));

    // The guard only protects the database it snapshotted
    const userData = await app.evaluate(({ app }) => app.getPath('userData'));
    if (userData !== USER_DATA) throw new Error(`app userData is ${userData}, expected ${USER_DATA}`);

    page = await app.firstWindow();
    page.on('console', m => logStream.write(`[renderer:${m.type()}] ${m.text()}\n`));
    page.on('pageerror', e => logStream.write(`[renderer:pageerror] ${e.stack || e}\n`));
    await page.waitForSelector('nav[aria-label="Primary"]', { timeout: 60_000 });

    for (const [w, h] of SIZES) {
      await app.evaluate(({ BrowserWindow }, [width, height]) => BrowserWindow.getAllWindows()[0].setSize(width, height), [w, h]);
      await page.waitForTimeout(400);
      const shot = async (name) => {
        await page.waitForTimeout(350); // let the view fade-in finish
        await page.screenshot({ path: join(outDir, `${name}-${w}x${h}.png`) });
      };
      const key = (name) => page.getByRole('button', { name, exact: false });
      const pill = () => page.getByTestId('now-pill');
      const nowStart = Date.now();
      const stepStart = () => Date.now();
      const assertStep = (t, label) => {
        if (Date.now() - t > TIMER_STEP_LIMIT_MS) throw new Error(`${label} exceeded ${TIMER_STEP_LIMIT_MS} ms`);
      };

      await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Now' }).click();
      await pill().filter({ hasText: 'Ready' }).waitFor();
      await shot('now-ready-empty');

      // Ready-selected: click a recent row only (typing an id would hit the API and write task_cache).
      const options = page.getByRole('option');
      // Selecting a task collapses the list, so remember whether one was picked
      const hasTask = (await options.count()) > 0;
      if (hasTask) {
        await options.first().click();
        await key(/begin focus/i).waitFor();
        await shot('now-ready-selected');
      } else {
        console.warn('[smoke] no recent tasks; skipping now-ready-selected');
      }

      await key(/set intention/i).or(key(/^edit$/i)).first().click();
      await page.getByText("Today's intentions").waitFor();
      await shot('now-intention-modal');
      await page.keyboard.press('Escape');
      await page.getByText("Today's intentions").waitFor({ state: 'hidden' });

      if (!hasTask) {
        // Need a task to press BEGIN FOCUS; fall back to the previous-session CTA if present.
        const cont = key(/^continue/i);
        if (await cont.count()) await cont.first().click();
      } else {
        await key(/begin focus/i).click();
      }
      // Outside work hours the boundary check asks first
      const boundary = page.getByRole('button', { name: 'Yes, Continue' });
      await boundary.waitFor({ timeout: 2_000 }).then(async () => {
        await shot('now-boundary-dialog');
        await boundary.click();
      }, () => {});
      let t = stepStart();
      await pill().filter({ hasText: 'Focusing' }).waitFor({ timeout: 15_000 });
      await shot('now-running');
      await key(/\+5 min/i).click();
      await key(/^pause$/i).click();
      await pill().filter({ hasText: 'Paused' }).waitFor();
      await shot('now-paused');
      await key(/^resume$/i).click();
      await pill().filter({ hasText: 'Focusing' }).waitFor();
      await key(/^cancel$/i).click();
      await pill().filter({ hasText: 'Ready' }).waitFor();
      assertStep(t, 'focus sequence');

      // Kickoff: cancel well before the 120 s roll-over; stopKickoff is never used (it saves a row).
      t = stepStart();
      await key(/kickoff 2m/i).click();
      await pill().filter({ hasText: 'Kickoff' }).waitFor({ timeout: 15_000 });
      await shot('now-kickoff');
      await key(/^cancel$/i).click();
      await pill().filter({ hasText: 'Ready' }).waitFor();
      assertStep(t, 'kickoff');

      // Break via the drip:// path; skip before the 60 s break-complete save.
      t = stepStart();
      await app.evaluate(({ app }) => app.emit('open-url', { preventDefault() {} }, 'drip://start-break?duration=5'));
      await pill().filter({ hasText: 'Break' }).waitFor({ timeout: 15_000 });
      await shot('now-break');
      await key(/skip break/i).click();
      await pill().filter({ hasText: 'Ready' }).waitFor();
      assertStep(t, 'break');

      await page.getByRole('button', { name: 'Tasks', exact: true }).click();
      await shot('now-aside-tasks');
      await page.getByRole('button', { name: 'Timeline', exact: true }).click();

      if (Date.now() - nowStart > NOW_BUDGET_MS) throw new Error(`Now sequence exceeded ${NOW_BUDGET_MS} ms`);

      const nav = page.getByRole('navigation', { name: 'Primary' });
      await nav.getByRole('button', { name: 'Plan' }).click();
      await planWalk(page, shot);
      await nav.getByRole('button', { name: 'Review' }).click();
      await reviewWalk(page, shot);
      await shot('review');
      await nav.getByRole('button', { name: 'Insights' }).click();
      await page.waitForTimeout(800);
      await shot('insights');
      await nav.getByRole('button', { name: 'Settings' }).click();
      await page.waitForTimeout(400);
      await shot('settings');

      await nav.getByRole('button', { name: 'Now' }).click();
      await key(/review day/i).click();
      await nav.getByRole('button', { name: 'Review' }).and(page.locator('[aria-current="page"]')).waitFor();
      await page.getByTestId('review-date').waitFor();
      await assertReviewInvariants(page); // R1: Review day → lands on today
    }
  } catch (error) {
    console.error('[smoke] failed:', error);
    if (page) await page.screenshot({ path: join(outDir, 'failure.png') }).catch(() => {});
    violations.push(String(error));
  } finally {
    if (app) await app.close().catch(() => {});
    vite.kill('SIGTERM');
    logStream.end();
    await new Promise(r => setTimeout(r, 500));
    violations = violations.concat(verifyAndClean(backupDir, logPath));
  }

  console.log(`[smoke] screenshots: ${outDir}`);
  if (violations.length) {
    console.error(`[smoke] ${violations.length} violation(s)`);
    process.exit(1);
  }
}

main();
