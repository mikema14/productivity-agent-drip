# Phase 4 plan: idle Nudge overlay + Kickoff takeover

Spec: `mockups/Nudge.dc.html` (the red nudge card, 480×240 inside a 520×280 frame) and `mockups/Kickoff.dc.html` (a 1200×800 full-window takeover). Shared language: `mockups/Main.dc.html` as implemented in Phases 1–3 (`PHASE1_PLAN.md` §1.1, `UI_DESIGN_SYSTEM.md` "Now Screen Tokens"). Parity source: `FEATURE_INVENTORY.md` §1.11 (overlays), §1.13 (deeplinks / Raycast), §1.14 (idle watcher, kickoff, Raycast Focus), §2 rows "Session-end overlay", "Idle nudge", "Kickoff roll-over prompt", "Kickoff 2m button", §3 rows "Kickoff full-window takeover" and "Nudge takeover countdown", §5.3 last bullet (overlay `force`).

Baseline on `feature/redesign` at `151f837`: 320 tests green (27 files), `tsc --noEmit` = 34 errors, `vite build` OK.

Owner rules carried over from Phases 1–3 and still binding: square `rounded-[2px]` radii + hairlines (P15/R21) on main-window surfaces, no inert controls (Q4), no caps (P9), `KeyButton` / tokens reuse, `DAY_TARGET_MINUTES` never duplicated (not used by this phase), no `#` prefixes (rule 6), Settings / Insights / Plan / Review / Now untouched except where a row in §3 names a file, `DRIP_TEST_MODE=1` keeps disabling the idle nudge and Raycast Focus, the guard protocol (`e2e/db-guard.mjs`) stays and no time entry is ever posted.

**Owner intent vs mockups (flagged up front).** The original ask was (1) a kickoff that is "something ridiculous like a huge 2-min button over the whole screen, to just start", and (2) a nudge that is "red, same pattern as the session/break overlay". The mockups deliver a slightly different pair: `Kickoff.dc.html` is the *running* kickoff (1:37 counting down, `esc Stop`) filling the window, not a huge *start* button; `Nudge.dc.html` is a solid `#141418` card with 16px radius and a red halo, not the glass shell the session/break cards use. Both are respected as the spec in §2; the conflicts are decisions K7 and N1 in §9, with a recommendation each.

## 0. Ground truth that shapes the plan

- **Two renderers, one window each.** The main window (`src/App.tsx`, rail + views) and the overlay window (`overlay.html` → `src/overlay/main.tsx` → `SessionEndOverlay.tsx`, 706 lines) are separate BrowserWindows with separate preloads (`electron/preload.ts` = `window.timerAPI` etc., `electron/overlayPreload.ts` = `window.overlayAPI`, six methods). The overlay preload deliberately has no DB or API reach (`overlayPreload.ts:4-8`); its only write path is `overlay:save-note` (`main.ts:467-475`, session comment).
- **The overlay window** (`electron/overlayWindow.ts`): one 560×400 transparent, always-on-top (`screen-saver`), all-workspaces, click-through window created lazily (`ensureOverlay`, `:284-294`), positioned top-right of the last active display below the 96px banner band (`:107-119`), `showInactive()` only (`:320-323`, never steals keyboard focus), hover-gated interactivity (`useOverlayHoverInteractivity.ts`, `setIgnoreMouseEvents`), edge-glow strips per display on escalation (`:189-262`). `showOverlay(payload, { force })` bypasses the `sessionEndOverlay` setting for the idle nudge and the kickoff prompt (`:310-325`); `getVisibleOverlayKind()` (`:365-367`) is how `idleNudge.ts` tells its cards from the session-end ones. Geometry constants are mirrored in `src/overlay/glass.ts` (`WINDOW = { width: 560, height: 400, inset: 44 }`, `CARD_W = 440`, `GLASS.radiusCard = 24`).
- **The overlay renderer** renders five payload kinds from one `switch` (`SessionEndOverlay.tsx:260-500`): `break-running` pill, `idle` + `kickoff-continue` (shared glass card, `:308-350`, bodies `IdleBody` `:503-540` and `KickoffBody` `:542-575`), `focus-complete` + `break-complete` card (`:352-500`, note input, escalation halo after 60 s, chime, edge glow). `escalates()` (`:42-44`) keeps the idle / kickoff cards off the amber escalation clock — main owns their timing. Esc → `dismiss` on any kind (`:207-212`); Enter → `start-break` only inside the note input (`:457`). Dev fixtures: `?state=card|break-complete|break|idle|kickoff` (`devPayload`, `:47-82`) are read from the URL unconditionally; the note flush skips `sessionId === 'dev'` (`:124`) but `act()` still calls `overlayAPI.action` (`:228-235`) — which is a real IPC when the preload is present.
- **Idle nudge wiring** (`electron/idleNudge.ts`, 287 lines) is a thin layer over the pure `idleWatcher.ts` machine (`off → counting → nudged → snoozed`; `IDLE_DEFAULTS`: nudge 10 min, escalate 15 min after the nudge, snooze 15 min, away ≥ 120 s, Mon–Fri 08:00–18:00, kickoff 120 s, prompt 10 s, poll 30 s; `DRIP_IDLE_FAST=1` seconds mode). `isEnabled()` (`:38-46`) is `DRIP_TEST_MODE !== '1'` and the `idleNudgeEnabled` setting. Gates: locked / suspended via `powerMonitor` (`:259-274`), `isInMeeting` from today's `calendar_proposals` (`:58-71`), away via `getSystemIdleTime()`. `show-nudge` → `showOverlay({ kind: 'idle', idleSince, kickoffAt, kickoffSeconds, snoozeSeconds }, { force: true })` (`:91-104`); `kickoff` → `startKickoff('auto')` (`:108-111`, `:144-165`: hides the nudge, sends `IdleCommand { type: 'kickoff', seconds }` to the main window, `restore()` + `showInactive()` + `moveTop()` for `auto`, `show()` for `manual`). Overlay buttons: `idle-start-focus` → `IdleCommand start-focus`, `idle-kickoff` → `startKickoff('manual')`, `idle-snooze` → `onSnooze`, `dismiss` on the nudge only hides the card (escalation keeps running, `:223-229`), `kickoff-keep` / `kickoff-stop` / `dismiss` on the prompt → `finishKickoffPrompt` (`:174-181`, `resolveKickoffPrompt`, `stop-kickoff` command + `raycastFocusEnd()`), timeout after `kickoffPromptSeconds` (`:183-197`). `drip://kickoff` → `startKickoff('manual')` (`main.ts:204-207`).
- **Kickoff in the renderer** (`src/stores/timerStore.ts`): `KICKOFF_SECONDS = 120` (`:47`), `startFocus(taskId, billable, fromOverlay, kickoffSeconds)` starts the main timer for `kickoffSecs` with `kickoffRolloverSeconds = focusSecs` and sets `kickoff: 'warmup'` (`:160-216`); `startKickoff(seconds)` resolves the task via `resolveLastTaskId` (current → today's last session with a task via `timerAPI.getLastSessionWithTask` → persisted `lastTaskId`, `:56-65`) (`:218-223`); `stopKickoff` stops the main timer and **saves what ran as a `pomodoro` row** with comment `Kickoff` (`:226-267`); `onTimerExtended` flips `warmup → rolled` when the extension lands at zero (`:838-846`); `onIdleCommand` handles `start-focus` / `kickoff` / `stop-kickoff` (`:851-861`). Main side: `electron/timer.ts` `rollOver` (`:189-206`) extends the same session and calls `listener.onKickoffRollover`; `electron/kickoff.ts` is the pure roll-over / prompt rule.
- **Now already shows the kickoff** (Phase 1, Q2): `Kickoff 2m` `KeyButton` in both ready states (`Timer.tsx:409`, `:430`; `handleKickoff` `:266-272`: selected task wins, else `startKickoff`), `isKickoff = isActive && kickoff === 'warmup'` (`:322`) drives the `Kickoff` header pill (`NowHeader.tsx:16`), the `KICKOFF · ROLLS INTO 25M` label and `compactCounter` (`:336`, `:390`); running controls Pause / Finish / Cancel / `+5 min` stay available during the warmup. `Timer.test.tsx` covers the button (`:48-51`, `:111-124`) and the warmup label (`:295-308`). `Cancel` → `reset` (no row, no confirm under 300 s) — the e2e relies on that (`smoke.mjs:314-320`, "stopKickoff is never used (it saves a row)").
- **Raycast Focus** (`electron/raycastFocus.ts`): `isEnabled()` = `DRIP_TEST_MODE !== '1'` and the `raycastFocusEnabled` setting and Raycast owning `raycast://` (`:41-50`); `raycastFocusStart(seconds, taskId)` opens `raycast://focus/start?goal&duration&mode=block&categories=social,streaming,gaming` via `open -g` (`:80-104`), `raycastFocusEnd()` opens `raycast://focus/complete` (`:110-117`). `active` is module-private; nothing tells the renderer whether a Raycast session is on. `timer.ts` calls start on focus start / resume / extend and end on pause / stop / complete / quit.
- **Settings** (`src/components/Settings/Settings.tsx:20-22`, `:97-100`, `:434-487`): `sessionEndOverlay` (also `timerAPI.setOverlayEnabled`), `idleNudgeEnabled`, `raycastFocusEnabled` checkboxes. Read by main at decision time (`getSetting` on every poll / start), so no restart is needed. Untouched by this phase.
- **Types** (`src/types/index.ts:215-257`): `IdleNudgePayload { idleSince, kickoffAt, kickoffSeconds, snoozeSeconds }`, `KickoffContinuePayload { focusMinutes, countdownSeconds }`, `OverlayActionType` (eight values), `IdleCommand` (three). `TimerAPI.startMainTimer` returns `Promise<void>` (`preload.ts:109`; the IPC handler returns `{ success }`, `main.ts:1346-1354`).
- **Tests that exist**: `electron/idleWatcher.test.ts` (18: timings, gates, snooze, escalation, resets, break-end), `electron/kickoff.test.ts` (4), `src/overlay/SessionEndOverlay.test.tsx` (3 idle incl. the no-escalation proof, 1 prompt), `Timer.test.tsx` kickoff cases. The vitest workspace runs `electron/**/*.test.ts` in Node and `src/**` in jsdom (`vitest.workspace.ts`). `src/test/setup.ts` stubs `timerAPI.startMainTimer` (`vi.fn(async () => undefined)`), `onIdleCommand`, `showSessionOverlay → { shown: false }`.
- **E2E** (`e2e/smoke.mjs`): launches with `DRIP_TEST_MODE=1 DRIP_E2E=1`, so the idle nudge never fires and Raycast is never opened. The Now walk already clicks `Kickoff 2m`, waits for the `Kickoff` pill, screenshots `now-kickoff` and clicks `Cancel` within 45 s (`:314-320`); the break step drives `drip://start-break` through `app.emit('open-url', …)` (`:323-329`) — the same mechanism works for `drip://kickoff`. The overlay window never appears in the run (no session completes). `main.log` is grepped for `Posting time entry to:` / `[Safety] Blocked` (`db-guard.mjs:317-320`).
- **Mockup deltas worth naming now.** Nudge: `Idle` micro-label with a red dot, `takeover in 14:32` mono countdown (exists as `kickoffAt`), `Nothing running · 12m` at 22px, copy naming Raycast Focus and the target task id (neither is in the payload), `Start focus ↵` amber / `Kickoff 2m` amber-tinted / `Snooze 15m` ghost pushed right, no `×`. Kickoff: no rail, no header, `KICKOFF` label + a `Raycast Focus on · social, streaming, gaming blocked` pill, 240px `1:37` (JetBrains Mono 200), id pill + title, 520×3 progress bar, `Just start. At 0:00 this rolls into a 25m focus session.`, footer `Started automatically after 15m idle` + `esc Stop`. Neither mockup draws the session-end / break-end cards, the break pill, the edge glow or the roll-over prompt — those keep their current look.

---

## 1. Goal and scope

Goal: (a) redraw the idle nudge card to `Nudge.dc.html` inside the existing overlay window, on the existing state machine, timings and actions; (b) add the kickoff takeover from `Kickoff.dc.html` as a full-window state of the **main** renderer while a kickoff is in its warmup; (c) leave the session-end / break-end / break-running overlay states, the roll-over prompt, the edge glow, the deeplinks, Raycast Focus and the Settings toggles working exactly as today; (d) make every overlay kind screenshot-able in the e2e without ever starting a timer, writing the DB or opening `raycast://`.

In scope: `src/overlay/SessionEndOverlay.tsx` (idle branch only, extracted), a new `IdleNudgeCard`, a new `KickoffPromptCard` (verbatim extraction, no restyle), pure `nudgeCopy.ts`, the new `KickoffTakeover` in the main renderer, the payload / command additions that the two mockups need (`IdleNudgePayload.taskId/taskTitle/raycastFocus`, `IdleCommand.kickoff.source`, `startMainTimer` returning the Raycast flag), the tests, the e2e fixture windows, docs.

Out of scope (untouched files): `electron/idleWatcher.ts`, `electron/kickoff.ts`, `electron/overlayWindow.ts` (geometry unchanged: the 480px mockup card is drawn at `CARD_W` 440, N5), `electron/overlayPreload.ts`, `src/overlay/EdgeGlow.tsx`, `chime.ts`, `useOverlayHoverInteractivity.ts`, `glass.ts` except one added constant, the session-end / break-end / break-running branches of `SessionEndOverlay.tsx` (byte-identical after the extraction), `Settings.tsx`, `Timer.tsx` (the Now kickoff state stays as the layer under the takeover, K3), `drip-raycast/*`, `electron/main.ts` except the two IPC lines in §3.2, `db.ts`, the guard's table lists. No schema change. No new settings. No change to any timing constant.

---

## 2. Mockup → component mapping

### 2.1 `Nudge.dc.html` → `src/overlay/IdleNudgeCard.tsx` (overlay window, `kind: 'idle'`)

| Mockup region | Component / element | Data | Notes |
|---|---|---|---|
| Card 480×240, `#141418`, `1px rgba(248,113,113,.45)` border, `16px` radius, red halo `0 0 0 4px …06, 0 0 48px …16` (`:17`) | `IdleNudgeCard` root, `ref={shapeRef}` (hover interactivity kept) | – | N1: shell = the overlay's `GLASS` card (fill, blur, `radiusCard`, `shadowCard`, `drip-arrive`) with the mockup's red border and red halo added (`ALERT.base` at .45 / .06 / .16) — "same pattern as the session/break overlay, but red". Width `CARD_W` (440, N5). The red radial wash at the top (`:337`, today) is kept. |
| Header left: red 7px dot + `Idle` micro-label (`:19`) | `Dot` (`ALERT.base`, 6px, as today) + `label(ALERT.light, 600)` `Idle` | – | String change `Nothing running` (label) → `Idle`; `Nothing running` moves to the title |
| Header right: `takeover in 14:32` mono, red digits (`:20`) | `<span>` mono 12px muted + `<span data-testid="nudge-takeover">` `ALERT.light` | `nudgeCopy.takeoverIn(kickoffAt, now)` → `mm:ss`, floors at `0:00` | Replaces `Kickoff HH:MM`; ticks on the existing 1 s `now` interval (`:109-114`). Under `DRIP_IDLE_FAST` it counts seconds the same way. |
| `×` (not drawn) | `DismissButton` kept after the countdown (N2) | – | Esc still → `dismiss` (window `keydown`, unchanged) |
| Title `Nothing running · 12m` 22px/500, mono `12m` (`:23`) | `<span data-testid="nudge-title">` | `span((now − idleSince)/1000)` (existing helper) | Test assertion moves from `getByText('· 12m')` to the title's text content |
| Copy `Then Raycast Focus turns on and a 2-minute kickoff starts on 689742.` 13px secondary, amber mono id (`:24`) | `<p data-testid="nudge-copy">` | `nudgeCopy.explain(payload)` | Four shapes (N4): with Raycast + task → mockup sentence; without Raycast → `Then a 2-minute kickoff starts on <id>.`; no task → `… starts on your last task.`; both missing → `Then a 2-minute kickoff starts.` `2-minute` comes from `kickoffSeconds` (`span()` → `2m` → written `2-minute`; `20-second` under FAST). The id is an amber mono span, never `#`. Title from `taskTitle` as the `title=` tooltip on the id. |
| `Start focus ↵` amber solid, dark text, `↵` kbd (`:28`) | `ActionButton primary` restyled to a solid amber fill for the nudge only (`fillAlpha = 1`, text `COLOR.drip.bg`) + `<kbd>↵</kbd>` rendered **only while the overlay window has focus** (N3, `useWindowFocus`) | → `act('idle-start-focus')` | Enter on the window `keydown` → `idle-start-focus` when `kind === 'idle'` (new binding; the note-input Enter → `start-break` is untouched) |
| `Kickoff 2m` amber-tinted (`:29`) | `ActionButton` (today's `primary` look: `.16` fill, amber text) | → `act('idle-kickoff')`; label `Kickoff` + mono `span(kickoffSeconds)` as today | |
| `Snooze 15m` ghost, pushed right (`:31`) | `ActionButton` (non-primary look) after a `flexGrow` spacer | → `act('idle-snooze')`; `span(snoozeSeconds)` | |
| Not drawn: escalation | none | – | `escalates()` unchanged: the idle card never runs the amber escalation (test kept) |

### 2.2 `Kickoff.dc.html` → `src/components/Kickoff/KickoffTakeover.tsx` (main window, while `kickoff === 'warmup'`)

| Mockup region | Component / element | Data | Notes |
|---|---|---|---|
| 1200×800 frame, `padding 40px 48px`, column flex, no rail / header (`:16`) | `KickoffTakeover` root: `fixed inset-0 z-50 bg-drip-bg flex flex-col px-12 py-10` rendered by `App.tsx` over `Rail` + `MainContent` (K1) | `useTimerStore` `status === 'focus' && kickoff === 'warmup'` | Views underneath stay mounted (no unmount side effects). The top 52px is `WebkitAppRegion: drag` (hidden-inset traffic lights), the `Stop` key `no-drag`. `role="dialog" aria-modal="true" aria-label="Kickoff"`. |
| `KICKOFF` amber micro-label (`:18`) | `.now-label text-focus` | – | |
| Pill `● Raycast Focus on · social, streaming, gaming blocked` 999px radius (`:19`) | `data-testid="kickoff-raycast"` hairline pill `border-drip-border rounded-[2px]` 12.5px with a 6px square dot (`bg-focus` on / `bg-txt-dim` off) — the `NowHeader` pill pattern | `timerStore.raycastFocus` (K5) | `Raycast Focus on · social, streaming, gaming blocked` when true; `Raycast Focus off` when false (setting off, Raycast absent, or `DRIP_TEST_MODE`). Category list = `BLOCK_CATEGORIES` spelled out; exported from a shared constant so the two never drift (§3.2). |
| Digits `1:37` 240px JetBrains Mono 200, amber, `-8px` tracking (`:23`) | `<div role="timer" aria-label="Kickoff remaining" data-testid="kickoff-digits">` | `remainingSeconds` | K4: `.now-digits`-style condensed digits at 240px (`text-[240px]` override on the class; 160px below `wide:`), `m:ss` (no leading zero, kickoffs are < 10 min), `text-focus`, colon blinks (`.colon-blink`) while running, `text-txt-secondary` when paused |
| Id pill `689742` + title (`:25-26`) | id pill (Now token: `font-mono text-[15px] text-focus bg-focus/10 rounded-[2px] px-2`, never `#`) + 18px `text-txt-secondary` title | `currentTaskId`, `useTaskName(currentTaskId)` | When no task: `No task attached` (the Now string). Title falls back to the `intention` note when set. |
| Progress bar 520×3, 19% (`:28`) | `<div role="progressbar" aria-valuenow>` `h-[3px] w-[520px] max-w-full bg-drip-elevated` + `bg-focus` fill | `1 − remaining / totalDuration` | Square (no radius). `transition-[width] duration-1000 linear` as the break pill does |
| `Just start. At 0:00 this rolls into a 25m focus session.` (`:29`) | `<p data-testid="kickoff-copy">` 14px muted | `durationMinutes` | `Nm` from the store, as `KICKOFF · ROLLS INTO Nm` does |
| Footer left `Started automatically after 15m idle` (`:33`) | `<span data-testid="kickoff-source">` 12.5px muted | `timerStore.kickoffSource` (K6) | `auto` → `Started automatically after 15m idle` (15 = `escalateAfterMs / 60000`, carried in the command); `nudge` → `Started from the nudge`; `now` → `Started from Now`; `deeplink` → `Started from Raycast` |
| Footer right `esc Stop` hairline button (`:34`) | `KeyButton variant="ghost" size="sm"` `Stop` with `kbd="esc"` shown only while `document.hasFocus()` (N3) | → K2: `reset()` (Now's Cancel path: no row, no confirm under 300 s) | Window `keydown` Escape → the same handler, guarded by the takeover being mounted and no `<input>` focused. |
| Not drawn: Pause / Finish / `+5 min` | K3 override: a quiet secondary row (`data-testid="kickoff-secondary"`, `KeyButton variant="ghost" size="sm"`, low contrast) left of `esc Stop` with Pause / Resume, Finish and `+5 min` | `isPaused` | Wired to `pause` / `resume` / `finishEarly` / `extendSession(5)` — the handlers Now uses during the warmup. `+5 min` hidden while paused, as on Now. Also reachable through `drip://pause` etc. |
| Not drawn: paused kickoff (Pause key or `drip://pause` during the warmup) | digits dim, colon static, copy `Paused — resume or stop.`, Resume replaces Pause in the secondary row, Stop stays | `isPaused` | Reflects the existing state |

### 2.3 Not covered by either mockup → unchanged

`focus-complete` card (note input, `Start break Nm` / `Next focus`, `×`, escalation halo + chime + edge glow after 60 s), `break-complete` card (`Start focus Nm`), `break-running` pill (progress, tick feed), `kickoff-continue` prompt (`Kickoff done`, `0:10` countdown, `Rolling into 25m focus.`, `Keep going` / `Stop`, timeout = keep going), the overlay window's positioning / hover / click-through, `EdgeGlow`, the Now screen's kickoff state and `Kickoff 2m` keys, Settings toggles, all `drip://` commands, the Raycast extension.

---

## 3. Component and file plan

### 3.1 Tokens

No new colours. Overlay: `ALERT` (`glass.ts`) already carries `COLOR.alert`; add `GLASS.haloAlert = '0 0 0 4px rgba(239,68,68,0.06), 0 0 48px rgba(239,68,68,0.16)'` next to `shadowCard`. Main window: `.now-digits` gains a size override via an inline Tailwind class on the takeover (`text-[240px] wide:text-[240px] leading-[0.8] tracking-[-8px]` — the class sets 160/120px, the takeover overrides), no CSS file change. `KeyButton` reused for `Stop`. The id pill and the hairline pill reuse the Now tokens.

### 3.2 Store, IPC and type plumbing

| File | Change |
|---|---|
| `src/types/index.ts` | `IdleNudgePayload` gains `taskId: string \| null`, `taskTitle: string \| null`, `raycastFocus: boolean`, `escalateMinutes: number`. `IdleCommand` kickoff variant gains `source: 'auto' \| 'nudge' \| 'deeplink'` and `escalateMinutes: number`. `TimerAPI.startMainTimer` returns `Promise<{ raycastFocus: boolean }>`. New `export const RAYCAST_BLOCK_CATEGORIES = ['social', 'streaming', 'gaming'] as const` (types module is shared by both processes). |
| `electron/raycastFocus.ts` | `BLOCK_CATEGORIES` built from `RAYCAST_BLOCK_CATEGORIES.join(',')`; export `isRaycastFocusEnabled(): boolean` (= today's private `isEnabled`). No behaviour change. |
| `electron/timer.ts` | `startTimer(...)` returns `boolean` = `timerType === 'focus' && isRaycastFocusEnabled()` (evaluated once, before `raycastFocusStart`, which keeps its own check). Nothing else. |
| `electron/main.ts` | `start-main-timer` handler returns `{ success: true, raycastFocus: startTimer(...) }` (`:1346-1354`). `startKickoff` callers: `drip://kickoff` → `startKickoff('deeplink')` (`:206`). |
| `electron/preload.ts` | `startMainTimer` resolves `{ raycastFocus: result.raycastFocus === true }` (`:109`). |
| `electron/idleNudge.ts` | `startKickoff(source: 'auto' \| 'nudge' \| 'deeplink')` (was `'auto' \| 'manual'`; `'nudge'` and `'deeplink'` both take the old `manual` window branch `win.show()`); the command becomes `{ type: 'kickoff', seconds, source, escalateMinutes: Math.round(cfg.escalateAfterMs / 60000) }`. `show-nudge` builds the payload through a new pure `buildNudgePayload(action, cfg, lookup)` in `electron/nudgePayload.ts` (below) with `lookup = { lastTask: () => getLastSessionWithTask(localDateKey(new Date()))?.task_id, taskTitle: (id) => getCachedTask(id)?.title, raycastFocus: isRaycastFocusEnabled }`, each wrapped in try/catch so a DB hiccup degrades to the task-less copy. `handleIdleOverlayAction('idle-kickoff')` → `startKickoff('nudge')`. |
| `electron/nudgePayload.ts` (new, pure) | `buildNudgePayload(action: { idleSince, kickoffAt }, cfg: IdleConfig, lookup)` → `IdleNudgePayload` (ISO strings, `kickoffSeconds`, `snoozeSeconds`, `escalateMinutes`, `taskId`, `taskTitle`, `raycastFocus`). Unit-tested in the electron project. |
| `src/stores/timerStore.ts` | New non-persisted fields `raycastFocus: boolean` (set from the `startMainTimer` result in `startFocus`, cleared to `false` wherever `kickoff: null` is set: `stopKickoff`, `startBreak`, `handleFocusComplete`, `finishEarly`, `reset`, hydration) and `kickoffSource: 'auto' \| 'nudge' \| 'deeplink' \| 'now' \| null` + `kickoffEscalateMinutes: number \| null`. `startKickoff(seconds, source = 'now', escalateMinutes = null)`; `onIdleCommand` passes `command.source` / `command.escalateMinutes`; `Timer.handleKickoff` keeps calling `startKickoff(KICKOFF_SECONDS)` and `startFocus(..., KICKOFF_SECONDS)` — the latter sets `kickoffSource: 'now'` when `kickoffSecs > 0` and no source was given. All three excluded from `partialize`. The `pendingSelection` precedent (Phase 2) is the pattern. |
| `src/test/setup.ts` | `timerAPI.startMainTimer → { raycastFocus: false }`; `onIdleCommand` stays a `vi.fn`. |

### 3.3 Pure logic modules

- **`src/overlay/nudgeCopy.ts`** (new, jsdom project, fully tested): `takeoverIn(kickoffAtIso, nowMs)` → `mm:ss` floored at `0:00`; `kickoffLength(seconds)` → `2-minute` / `20-second` (`< 60` → seconds); `explain(payload)` → the four sentence shapes of §2.1 as `{ before: string; taskId: string \| null; after: string }` so the id renders as its own span; `idleFor(idleSinceIso, nowMs)` → existing `span()` moved here.
- **`electron/nudgePayload.ts`** (new, node project): `buildNudgePayload` as in §3.2.
- **`src/components/Kickoff/kickoffCopy.ts`** (new, tested): `sourceLine(source, escalateMinutes)`; `raycastLine(active)`; `formatKickoff(seconds)` → `m:ss`; `progress(remaining, total)` → `0..1` clamped.

### 3.4 Components

| File | Status | Responsibility |
|---|---|---|
| `src/overlay/SessionEndOverlay.tsx` | modified (idle branch only) | The `payload.kind === 'idle' \|\| 'kickoff-continue'` block (`:308-350`) becomes `kind === 'idle' ? <IdleNudgeCard … /> : <KickoffPromptCard … />`, each owning its card shell; `IdleBody` / `KickoffBody` are removed from this file. `escalates()`, `devPayload` (fixtures gain `taskId: '689742'`, `taskTitle`, `raycastFocus: true`, `escalateMinutes: 15` on `idle`), `act`, the hover hook, the note logic, the `focus-complete` / `break-complete` / `break-running` JSX are unchanged. Window `keydown`: `Enter` → `act('idle-start-focus')` when the current kind is `idle` and the target is not an input (new, N3). `act` becomes a no-op that logs `[Overlay] fixture action: <type>` when `window.overlayAPI` is missing (E1; today `overlayAPI?.action` already short-circuits — this only adds the log so the e2e can assert it). |
| `src/overlay/IdleNudgeCard.tsx` | new | Card per §2.1. Props: `payload: IdleNudgePayload`, `now: number`, `windowFocused: boolean`, `act`. Shell: `GLASS` card + `1px solid withAlpha(ALERT.base, .45)` + `boxShadow: GLASS.shadowCard + ', ' + GLASS.haloAlert`. `data-testid="idle-nudge"`. |
| `src/overlay/KickoffPromptCard.tsx` | new (extraction) | `KickoffBody` + its shell moved verbatim; `data-testid="kickoff-prompt"`. No restyle (K8). |
| `src/overlay/useWindowFocus.ts` | new | `document.hasFocus()` tracked on `focus` / `blur`; used for the `↵` hint (N3). Shared by the takeover through a copy in `src/hooks/useWindowFocus.ts`? No — one file at `src/hooks/useWindowFocus.ts`, imported by both renderers (the overlay bundle already imports from `../theme/tokens.js` and `../types`). |
| `src/components/Kickoff/KickoffTakeover.tsx` | new | Per §2.2. Reads `status`, `kickoff`, `remainingSeconds`, `totalDuration`, `currentTaskId`, `intention`, `durationMinutes`, `isPaused`, `raycastFocus`, `kickoffSource`, `kickoffEscalateMinutes`, `reset` from `useTimerStore`; `useTaskName(currentTaskId)` for the title; `useWindowFocus()` for the `esc` hint. Mounts a window `keydown` listener for Escape (guard: no `INPUT` / `TEXTAREA` / `contentEditable` target). Returns `null` unless `status === 'focus' && kickoff === 'warmup'`. |
| `src/App.tsx` | one line | `<KickoffTakeover />` rendered after `MainContent` (before `CreateListModal`). |
| `src/App.test.tsx` | +2 cases | takeover present for `setTimer({ status: 'focus', kickoff: 'warmup', … })` and absent for `'rolled'`; Escape → `stopMainTimer` called and status idle. Existing mocks untouched (Timer stays a stub). |
| `src/components/Timer/Timer.tsx` | unchanged | Its warmup rendering stays as the layer under the takeover (K3); `Timer.test` kickoff cases stay green. |
| `Prompts & Docs/UI_DESIGN_SYSTEM.md` | + "Overlay & Kickoff tokens" section | Nudge shell, takeover layout, hint-when-focused rule. |

### 3.5 State-by-state spec

| Element | Nudge (Raycast on, task known) | Nudge (Raycast off / no task) | Nudge under `DRIP_IDLE_FAST` | Takeover, auto | Takeover, from Now / nudge / deeplink | Takeover, paused | Kickoff rolled |
|---|---|---|---|---|---|---|---|
| Overlay card | red shell, `Idle`, `takeover in 14:32`, `×` | same | countdown in seconds (`0:25`), `20-second kickoff` | hidden (`hideIdleNudge`) | hidden | – | prompt card (unchanged) if it rolled from a kickoff |
| Copy | `Then Raycast Focus turns on and a 2-minute kickoff starts on <id>.` | `Then a 2-minute kickoff starts on <id>.` / `… on your last task.` / `Then a 2-minute kickoff starts.` | same shapes | – | – | – | – |
| `↵` hint | only while the overlay window has focus | same | same | – | – | – | – |
| Main window | untouched | untouched | untouched | takeover over every view; window restored + `showInactive` + `moveTop` (unchanged) | takeover; window `show()` (unchanged) | takeover, digits dim | Now's normal running state (label `FOCUS · hh:mm → hh:mm`) |
| Raycast pill | – | – | – | `on · …blocked` or `off` from the start result | same | `off` (main ended it on pause) — reflects `raycastFocusEnd` on pause | – |
| Source line | – | – | – | `Started automatically after 15m idle` | `Started from Now` / `the nudge` / `Raycast` | same | – |
| Esc | dismiss (hides the card, escalation continues) | same | same | `reset()` — no row; the idle clock restarts (`onStatus idle`) | same | same | Now's own handling |

---

## 4. Parity table

`Verified by` names the test that fails if the feature regresses; `e2e` means the smoke exercises it read-only.

| Inventory item | Old location | New home | Verified by |
|---|---|---|---|
| §1.14 nudge after 10 min idle; kickoff 15 min after the nudge | `idleWatcher.ts` `IDLE_DEFAULTS` | unchanged file | `idleWatcher.test` "nudges at 10 minutes", "starts the kickoff 15 minutes after the nudge", "uses the configured numbers" (existing) |
| §1.14 gates: toggle off, locked / asleep, away ≥ 120 s, off-hours, weekend, in a meeting | `idleWatcher.gateReason`, `idleNudge.poll` (`powerMonitor`, `isInMeeting`) | unchanged | `idleWatcher.test` "never nudges while …" ×6, "never nudges outside work hours", "at the weekend", "resets on unlock/resume" (existing) |
| §1.14 break-end path (green card is the nudge; escalation counts from the break end) | `idleWatcher.onTimerStatus` | unchanged | `idleWatcher.test` "break end" ×2 (existing) |
| §1.14 snooze 15 min → nudge returns with a fresh escalation clock | `idleWatcher.onSnooze`, `idleNudge.handleIdleOverlayAction('idle-snooze')` | unchanged; `Snooze 15m` key | `idleWatcher.test` "suppresses nudge and escalation for 15 minutes"; `IdleNudgeCard.test` "Snooze sends idle-snooze" |
| §1.14 dismissing the nudge does not stop the escalation | `idleNudge.ts:223-229` | `×` kept (N2), Esc kept | `idleWatcher.test` "dismissing the nudge does not stop the escalation"; `IdleNudgeCard.test` "Dismiss sends dismiss" |
| §1.11 nudge shows even with `sessionEndOverlay` off (`force`) | `overlayWindow.showOverlay` | unchanged | (no unit test possible without Electron) — manual QA with `DRIP_IDLE_FAST=1` and the overlay toggle off, noted in the report |
| §1.11 idle card: no amber escalation, main owns the clock | `escalates()` | unchanged | `SessionEndOverlay.test` "does not run the amber escalation" (existing, kept) |
| §1.11 idle card `Nothing running · 12m`, `Kickoff HH:MM`, Start focus / Kickoff 2m / Snooze 15m, `×` | `SessionEndOverlay.tsx:503-540` | `IdleNudgeCard` (`Idle` label, `Nothing running · 12m` title, `takeover in mm:ss`, three keys, `×`) | `IdleNudgeCard.test` (12 cases, §6.1); `SessionEndOverlay.test` idle cases updated to the new selectors |
| §1.11 `?state=idle` / `?state=kickoff` dev fixtures | `devPayload` | kept; fixtures carry the new fields; no-preload = no IPC (E1) | `SessionEndOverlay.test` "fixture: renders from ?state=idle and never calls overlayAPI.action when the bridge is absent"; e2e `overlay-idle`, `overlay-kickoff-prompt` |
| §1.14 kickoff: one session that rolls over at zero; Raycast started for kickoff + focus | `kickoff.ts`, `timer.ts rollOver` | unchanged | `kickoff.test` ×4 (existing) |
| §1.14 roll-over prompt Keep going / Stop, 10-s auto-keep; Stop saves what ran as `Kickoff` | `idleNudge.onKickoffRollover`, `KickoffBody`, `timerStore.stopKickoff` | `KickoffPromptCard` (verbatim), wiring unchanged | `SessionEndOverlay.test` "renders Keep going / Stop and relays them" (existing); `kickoff.test` "Stop ends the session and ends Raycast Focus" |
| §1.14 kickoff task = current > today's last session task > `lastTaskId` | `timerStore.resolveLastTaskId` | unchanged; the nudge copy predicts the same id from the DB (N4) | `timerStore.test` (new, §6.1) "startKickoff resolves the task via getLastSessionWithTask"; `nudgePayload.test` "taskId from the last session with a task" |
| §1.14 auto kickoff brings the window to front without stealing focus | `idleNudge.startKickoff('auto')` | unchanged (`showInactive` + `moveTop`) | wiring, not unit-testable; the takeover shows the `esc` hint only once the window is focused (N3) — `KickoffTakeover.test` "esc hint hidden while the window is blurred" |
| §1.14 Timer header `Kickoff` / `KICKOFF · ROLLS INTO Nm` | `Timer.tsx:322-336`, `NowHeader` | unchanged, under the takeover (K3) | `Timer.test` kickoff cases (existing, untouched) |
| §1.3 / Phase 1 `Kickoff 2m` on Now (selected task wins) | `Timer.tsx:266-272` | unchanged; `kickoffSource: 'now'` | `Timer.test` "Kickoff 2m with a selected task…" (existing); `timerStore.test` "startFocus with kickoffSeconds sets kickoffSource now" |
| §1.13 `drip://kickoff` → `startKickoff('manual')` | `main.ts:204-207` | `startKickoff('deeplink')` (same window branch) | e2e step E2 (`open-url` → takeover → `Started from Raycast` → Esc) |
| §1.13 other deeplinks (`start-focus`, `pause`, `resume`, `stop`, `finish-early`, `start-break`, `skip-break`) | `main.ts:162-215` | untouched | e2e break step (existing) |
| §1.14 Raycast Focus start on focus start / resume / extend, end on pause / stop / complete / quit; `open -g`; cold-launch guard; requires Raycast to own `raycast://` | `raycastFocus.ts`, `timer.ts` | unchanged; `isRaycastFocusEnabled` exported (same body) | `raycastFocus.test` (new, node project, `vi.mock('electron')` + `child_process`): "start builds the categories URL from RAYCAST_BLOCK_CATEGORIES", "disabled under DRIP_TEST_MODE", "end is a no-op when nothing was started" (3 cases) |
| §1.6 Settings toggles `sessionEndOverlay`, `idleNudgeEnabled`, `raycastFocusEnabled` | `Settings.tsx`, read by main | untouched | `idleWatcher.test` "never nudges while the toggle is off"; `raycastFocus.test` "disabled when the setting is false"; e2e `settings` screenshot |
| §1.11 focus-complete card (note save, Start break / Next focus, Esc, Enter in the note, escalation halo + chime + edge glow) | `SessionEndOverlay.tsx:352-500` | byte-identical | `SessionEndOverlay.test` (new, 6 cases, §6.1) — written **before** the extraction commit so the extraction is proven neutral; e2e `overlay-focus-complete` |
| §1.11 break-complete card, break-running pill + tick | same file | byte-identical | `SessionEndOverlay.test` (new, 3 cases); e2e `overlay-break-complete`, `overlay-break` |
| §1.11 overlay window: position, click-through + hover interactivity, edge glow per display, `getVisibleOverlayKind`, `setEnabled` destroys | `overlayWindow.ts` | untouched | not unit-testable; unchanged file (reviewer diffs it: zero hunks) |
| §1.14 `DRIP_TEST_MODE` disables the nudge and Raycast | `idleNudge.isEnabled`, `raycastFocus.isEnabled` | untouched | `raycastFocus.test`; e2e `main.log` must contain no `[IdleNudge] off → counting` and no `[RaycastFocus] Started` line (new grep, §7.2) |
| §2 "Idle nudge — mockup adds takeover countdown + target task" (§3 row) | new | `takeover in mm:ss`, `explain()` | `nudgeCopy.test`, `IdleNudgeCard.test` |
| §3 "Kickoff full-window takeover" (240px digits, task, progress, Raycast indicator, source line, esc Stop) | new | `KickoffTakeover` (K1–K6) | `KickoffTakeover.test` (12 cases), `kickoffCopy.test`, `App.test`; e2e `now-kickoff` (now the takeover), `now-kickoff-deeplink` |
| §3 "Raycast Focus active indicator needs a main → renderer signal" | new | `startMainTimer` result → `timerStore.raycastFocus` (K5) | `timerStore.test` "raycastFocus mirrors the start result and clears on reset/complete"; `KickoffTakeover.test` on/off pill |

Nothing from §1.11 / §1.13 / §1.14 is dropped. String changes: nudge label `Nothing running` → `Idle` (the phrase moves into the title), `Kickoff HH:MM` → `takeover in mm:ss`, `Start focus` gains a focus-gated `↵`. Prompt strings, session-end strings, Now strings, notification strings and deeplink names are unchanged.

---

## 5. Build sequence

One commit per step; every step ends with `npm test` green (count never below the previous step; 320 at the start), `npx tsc --noEmit | grep -c "error TS"` ≤ 34, `npx vite build` OK. New files are tsc-clean. No step touches `idleWatcher.ts`, `kickoff.ts`, `overlayWindow.ts`, `overlayPreload.ts`, `Settings.tsx`, `Timer.tsx`, `post-time-entry`.

1. **Overlay regression tests first.** `SessionEndOverlay.test.tsx` gains the focus-complete / break-complete / break-running cases (§6.1) against today's file, plus the "fixture without bridge never calls action" case. No production change. — `test(overlay): pin the session-end, break-end and break-pill cards before the nudge redesign`
2. **Plumbing.** Types (`IdleNudgePayload`, `IdleCommand`, `startMainTimer` result, `RAYCAST_BLOCK_CATEGORIES`), `raycastFocus.ts` export, `timer.ts` return, `main.ts` two lines, `preload.ts`, `idleNudge.ts` sources + `nudgePayload.ts`, `timerStore` fields, `setup.ts`. Tests: `nudgePayload.test.ts`, `raycastFocus.test.ts`, new `src/stores/timerStore.test.ts` (kickoff cases only, §6.1). No UI change. — `feat(idle): nudge payload carries the target task and Raycast state; kickoff commands carry their source`
3. **nudgeCopy + IdleNudgeCard + KickoffPromptCard extraction.** `nudgeCopy.ts` + test, `useWindowFocus`, the two card files, `SessionEndOverlay.tsx` idle branch replaced, Enter binding, fixture fields; `IdleNudgeCard.test.tsx`; the three idle assertions in `SessionEndOverlay.test` updated to the new selectors (the only existing assertions changed, named here). Step 1's cards stay byte-identical (reviewer diffs the `:352-500` hunk: none). — `feat(overlay): idle nudge card per mockup — Idle label, takeover countdown, target task copy`
4. **kickoffCopy + KickoffTakeover + App.** `kickoffCopy.ts` + test, `KickoffTakeover.tsx` + test, `App.tsx` line, `App.test` +2. — `feat(kickoff): full-window takeover during the warmup, esc stops without saving`
5. **E2E + guard.** `smoke.mjs`: takeover in the existing kickoff step, deeplink kickoff step, overlay fixture windows (§7.1); `db-guard.mjs` log greps (§7.2). Run once with the installed app quit; attach `report.txt` + screenshots to the review. — `test(e2e): kickoff takeover, deeplink kickoff, overlay fixture screenshots`
6. **Docs.** `UI_DESIGN_SYSTEM.md` "Overlay & Kickoff tokens"; owner decisions marked Decided in this file. — `chore(overlay): design-system notes`

---

## 6. Test plan

### 6.1 Vitest / RTL

Patterns as in Phases 1–3: `useTimerStore.setState` via the `setTimer` helper, `window.timerAPI.*` stubs from `setup.ts`, `userEvent` / `fireEvent`, `vi.useFakeTimers` for countdowns, `vi.mock` for `useTaskName` in the takeover tests. Overlay tests install `window.overlayAPI` per test as `SessionEndOverlay.test` does today (`:9-21`).

**`src/overlay/SessionEndOverlay.test.tsx`** (existing 4 → ~14):
- step 1 (against today's code): focus-complete renders `Focus complete`, the time range, the id, the note input focused, `Start break 5m` / `Next focus` / `Dismiss`; typing in the note debounces `saveNote(sessionId, value)` after 400 ms; Enter in the note → `action('start-break')`; Escape → `action('dismiss')`; escalation after 60 s → `setEscalated(true)` and the halo (`drip-halo` style present); hovering the card stops it (`setEscalated(false)`); break-complete renders `Break over` + `Start focus 25m` → `next-focus`; break-running renders `Break` / `Long break`, `3:42`, and `onTick` updates the digits; fixture `?state=card` without `window.overlayAPI` renders and clicking `Start break` throws nothing and calls nothing.
- step 3: the three idle cases re-pointed (`getByTestId('idle-nudge')`, title text `Nothing running · 12m`, keys by name `/Start focus/`, `/Kickoff 2m/`, `/Snooze 15m/`, `Dismiss`); the no-escalation case unchanged; kickoff prompt case unchanged; new: Enter on the window → `action('idle-start-focus')` for the idle kind and not for the prompt.

**`src/overlay/IdleNudgeCard.test.tsx`** (new, ~12): `Idle` label; `takeover in 14:32` from `kickoffAt = now + 872 s`; countdown ticks to `14:31` after 1 s (fake timers); floors at `0:00`; title `Nothing running · 12m`; copy with Raycast + task → exact mockup sentence with the id in its own amber span and the title as tooltip, never `#`; Raycast off → `Then a 2-minute kickoff starts on 689742.`; no task → `… on your last task.`; neither → `Then a 2-minute kickoff starts.`; `20-second` under `kickoffSeconds: 20`; `↵` kbd absent when `windowFocused=false`, present when true; the three keys + `×` relay `idle-start-focus` / `idle-kickoff` / `idle-snooze` / `dismiss`; card carries the red border (`rgba(239, 68, 68, 0.45)`).

**`src/overlay/nudgeCopy.test.ts`** (new, ~8): `takeoverIn` rounding / floor / past; `kickoffLength` 120 / 20 / 90; `explain` four shapes; `idleFor` minutes vs seconds.

**`electron/nudgePayload.test.ts`** (new, node, ~5): ISO strings from epoch ms; `kickoffSeconds` / `snoozeSeconds` / `escalateMinutes` from `IDLE_DEFAULTS` (120 / 900 / 15) and from `IDLE_FAST`; `taskId` + `taskTitle` from the lookup; a throwing lookup → `null`s and `raycastFocus: false`.

**`electron/raycastFocus.test.ts`** (new, node, 3): `vi.mock('electron', () => ({ app: { getApplicationNameForProtocol: () => 'Raycast' } }))`, `vi.mock('child_process')`, `vi.mock('../src/services/db')`: start spawns `open -g` with `mode=block&categories=social,streaming,gaming` and `duration=1620`; `DRIP_TEST_MODE=1` → no spawn; `raycastFocusEnd` without a start → no spawn.

**`src/stores/timerStore.test.ts`** (new, ~8, kickoff scope only — the rest of the store stays on the inventory's "no coverage" list): `startFocus(id, true, false, 120)` → `startMainTimer(120, 'focus', 5, id, 1500)`, `kickoff: 'warmup'`, `kickoffSource: 'now'`, `raycastFocus` from the stub result; `startKickoff(120, 'auto', 15)` resolves the task through `getLastSessionWithTask(today)` then `lastTaskId`; `onIdleCommand` kickoff → `startKickoff(seconds, source, escalateMinutes)`; `onTimerExtended` at `remainingSeconds ≤ 1` flips to `rolled`, a `+5 min` mid-warmup does not; `stopKickoff` saves a `pomodoro` row with comment `Kickoff` and clears `raycastFocus`; `reset` during the warmup saves nothing and clears `kickoff` / `kickoffSource` / `raycastFocus`; `partialize` excludes the three new fields.

**`src/components/Kickoff/KickoffTakeover.test.tsx`** (new, ~12): hidden when idle, when `kickoff: 'rolled'`, when `status: 'break'`; visible with `KICKOFF` label, `role=dialog`; digits `1:37` for `remainingSeconds: 97`; progress `aria-valuenow` 19 for 97/120; id pill without `#` + title from `useTaskName` (mocked); `No task attached` without a task; copy `… rolls into a 25m focus session.` from `durationMinutes: 25`, `50m` for 50; Raycast pill on / off text; source lines for `auto` (15) / `nudge` / `deeplink` / `now`; `Stop` → `reset` (`stopMainTimer` called, no `saveSession`); Escape → same; Escape with an `<input>` focused → nothing; `esc` kbd rendered only when `document.hasFocus()` (spied); paused → digits dim + paused copy.

**`src/components/Kickoff/kickoffCopy.test.ts`** (new, ~6).

**`src/App.test.tsx`** (+2): takeover over the stubbed views for `warmup`; absent for `rolled`.

Existing tests untouched except the three idle selectors in `SessionEndOverlay.test` (step 3). Expected total after step 5: ≈ 320 + 10 + 12 + 8 + 5 + 3 + 8 + 12 + 6 + 2 ≈ 386.

### 6.2 E2E — see §7.

---

## 7. E2E smoke and guard

### 7.1 `e2e/smoke.mjs` changes (both sizes)

Read-only by construction; every step lists the writes it can cause. **Never:** `stopKickoff` (saves a row), the roll-over prompt (120 s), any real overlay action (no preload in the fixture windows), `raycast://` (disabled by `DRIP_TEST_MODE`, additionally asserted by the log grep).

1. **Kickoff step (replaces `:314-320`).** `Kickoff 2m` → wait for `role=dialog name=Kickoff` → assert `kickoff-raycast` reads `Raycast Focus off` (proof the test mode gate holds) and `kickoff-source` reads `Started from Now` → `now-kickoff` (the takeover fills the window) → press `Escape` → wait for the Now `Ready` pill. Budget unchanged (45 s). (Writes: `settings.timer_state`, as today.)
2. **Deeplink kickoff (new).** `app.evaluate(({ app }) => app.emit('open-url', { preventDefault() {} }, 'drip://kickoff'))` → dialog → assert `Started from Raycast` → `now-kickoff-deeplink` → `Escape` → `Ready`. Exercises `main.ts` → `idleNudge.startKickoff('deeplink')` → `IdleCommand` → `timerStore.startKickoff` (task from today's last session; if none, no task — `No task attached` is accepted). (Writes: `settings.timer_state`.)
3. **Overlay fixture windows (new, after Settings).** For each `state` in `['idle', 'kickoff', 'card', 'break-complete', 'break']`: `app.evaluate` creates a plain `BrowserWindow({ width: 560, height: 400, show: true, frame: false, transparent: false, backgroundColor: '#1a1a2e', webPreferences: { contextIsolation: true, nodeIntegration: false } })` — **no preload**, so `window.overlayAPI` is undefined and no IPC can leave the page — and loads `http://localhost:5173/overlay.html?state=<state>` (the same URL `loadOverlayHtml` uses in dev). Playwright `app.waitForEvent('window')` → wait for `[data-testid="idle-nudge"]` / `kickoff-prompt` / the card / pill → screenshot `overlay-<state>` → for `idle` also click `Start focus` and assert the console got `[Overlay] fixture action: idle-start-focus` and nothing else happened (renderer console is piped to `main.log`) → `win.destroy()` via `app.evaluate`. The real overlay module (`overlayWindow.ts`) is never involved: `ensureOverlay` is not called, `getVisibleOverlayKind()` stays null, the idle watcher is off. (Writes: none. `overlay:save-note` is unreachable without the preload.)
4. Everything else in the walk unchanged; the `now-kickoff` assertion on the Now pill is replaced by the dialog wait (the pill is underneath the takeover and still `Kickoff` — the walk asserts both: `pill().filter({ hasText: 'Kickoff' })` remains as a K3 proof that Now's state is intact under the layer).

Assertions added: the takeover's id pill (if any) has no `#`; `main.log` contains `[IdleNudge]` no `→ counting` / `→ nudged` transitions and no `[RaycastFocus] Started` line (test-mode gates hold); the fixture windows' console contains exactly one `fixture action` line.

### 7.2 Guard changes (`e2e/db-guard.mjs`)

- Log greps added next to the POST greps (`:317-320`): `[RaycastFocus] Started` → violation (`a Raycast Focus session was started during a test run`); `[IdleNudge] off → counting` → violation (`the idle watcher ran during a test run`); `Kickoff rolled over` → violation (`a kickoff reached its roll-over; stopKickoff or the prompt may have run`). No table-list changes: the walk creates nothing new; `pomodoro_sessions` stays in `MUST_BE_EMPTY`, which is what catches an accidental `stopKickoff`.
- Precondition print gains: "the kickoff steps stop the timer with Escape (reset, no row) well before the 120-s roll-over; overlay states are screenshotted from preload-less fixture windows that cannot reach IPC".

### 7.3 Unavoidable writes in the new steps

`settings.timer_state` on the two kickoff starts / stops (restored, as today); `settings.lastSessionDate` / `sessionCount` unchanged by a reset (no `handleFocusComplete`). Nothing in `pomodoro_sessions`, no `calendar_proposals` beyond the existing walk, no `task_cache` (the takeover's `useTaskName` may GET an uncached id, tolerated by P17), no time entries, no `raycast://`.

---

## 8. Risks

- **The overlay window is one 706-line file with hand-rolled escalation, hover and note logic** (inventory §5.1). Mitigation: step 1 pins the untouched branches with tests *before* anything moves; step 3 extracts only the idle / prompt block, and the reviewer diffs the `focus-complete` hunk for zero changes.
- **`stopKickoff` writes a session.** The takeover's Esc / Stop is bound to `reset` (K2), the e2e never reaches 120 s, and `MUST_BE_EMPTY` + the new `Kickoff rolled over` grep catch any slip. If the owner chooses K2(a) instead, the e2e must switch to a non-saving exit (it would have to stay on Now's `Cancel`, which the takeover covers — so K2(a) also needs a Cancel key on the takeover).
- **Keyboard focus.** Both windows are raised with `showInactive` by design; a `↵` / `esc` hint that only works after a click would be an inert affordance. N3 renders the hints only while the window has focus (`document.hasFocus()`), the bindings exist regardless. `useWindowFocus` must be tested with a spied `hasFocus`.
- **The nudge copy predicts a task main cannot fully know**: the renderer's `resolveLastTaskId` falls back to the persisted `lastTaskId` (localStorage) after today's last session with a task; main only sees the DB. When no session today has a task the copy says `on your last task` (or drops the clause) instead of naming an id. Flagged (N4), not hidden.
- **`startMainTimer` return type** changes from `void` to `{ raycastFocus }` — every caller is in `timerStore.ts` (`startFocus`, `startBreak`, `continueFromModal` path) and the `setup.ts` stub; `tsc` flags any miss. The IPC handler keeps `{ success }` so an old renderer bundle against a new main still starts timers.
- **The takeover covers modals.** `CancelConfirmModal`, `SetIntentionModal`, `BoundaryConfirmDialog` render inside `Timer`; none can be open during a kickoff warmup (a kickoff starts from idle and skips the boundary check, Q2). `CreateListModal` at App level renders after the takeover in the tree, so a list modal opened before a deeplink kickoff would paint above it — acceptable and noted; the modal's own close returns to the takeover.
- **Window brought to front on auto kickoff while the user is in another app**: unchanged behaviour (`showInactive` + `moveTop`), but the takeover now fills the window instead of the small Now header change — that is the intent ("ridiculous"). K1 keeps it inside Drip's window; OS-level fullscreen is listed as an option and not recommended.
- **`.now-digits` at 240px** on an 800×600 window: 160px below `wide:` (K4); the 800×600 screenshot confirms the `m:ss` fits (`9:59` at 160px condensed ≈ 300px wide).
- **Overlay card width**: the mockup is 480 wide; `CARD_W` is 440 and the window inset is 44 (`44 + 480 = 524 < 560` would fit). N5 keeps 440 so the four overlay cards share one width; the copy wraps to two lines at 13px, as the mockup's already does.
- **tsc gate**: `SessionEndOverlay.tsx` carries none of the 34 errors today; `timerStore.ts` may — adding fields cannot raise the count. New files strict.
- **Fixture windows in the e2e** are created through Playwright's `app.evaluate` on the real `BrowserWindow` class; `transparent: false` + a background colour makes the PNGs legible. If `waitForEvent('window')` races the creation, fall back to polling `app.windows()` by URL.

---

## 9. Owner decisions needed

Each item: what the mockup shows vs what exists, the options, and my recommendation. **Owner decisions recorded 2026-09-26** — every item below carries a `Decided:` line; the build follows those lines, and K3 overrides the recommendation.

**N1. Nudge card shell — glass vs the mockup's solid card; radius.** Mockup: `#141418` solid, 16px radius, red hairline + red halo. Existing: the overlay's `GLASS` shell (near-solid dark HUD, 24px radius, `drip-arrive`) with a red 1px border — the owner's stated pattern ("red, same pattern as the session/break overlay"). Owner rule: square 2px radii on main-window surfaces. Options: (a) keep the `GLASS` shell (fill, blur, 24px, arrive) and add the mockup's red halo + red border — the nudge looks like the session-end card's red sibling; (b) the mockup literally (solid, 16px), leaving the session-end card at 24px — two shells in one window; (c) 2px radius on the nudge only; (d) 2px on every overlay card (touches the session-end look, which is out of scope). **Recommend (a).** It is what the owner asked for and keeps the overlay family coherent; the mockup's content and hierarchy are taken in full.

**Decided: (a).** Overlay `GLASS` shell (fill, blur, `radiusCard`, `drip-arrive`) + the mockup's red border and red halo.

**N2. `×` dismiss.** Not drawn. Existing: `×` + Esc → `dismiss` (hides the card; escalation continues). Options: (a) keep the `×` after the countdown, as on the session-end card; (b) Esc only. **Recommend (a).** A mouse user has no other way to hide the card, and the session-end card keeps its `×`.

**Decided: (a).** `×` kept after the countdown; Esc → `dismiss` unchanged.

**N3. `↵` on `Start focus` (and `esc` on the takeover's `Stop`).** Both windows are raised without keyboard focus by design (`showInactive`), so the key does nothing until the user clicks into the window — a printed hint would be an inert affordance (Q4). Options: (a) render the kbd hint only while `document.hasFocus()`; bind Enter / Escape regardless; (b) always render the hint; (c) focus the window when raising it (steals focus from what the user is typing — the exact thing the overlay was built not to do); (d) drop the hints. **Recommend (a).** Honest hint, no focus theft, the binding is there the moment the window is clicked.

**Decided: (a).** Hints render only while `document.hasFocus()`; the Enter / Escape bindings exist regardless.

**N4. The target task in the nudge copy.** Mockup names `689742`. The kickoff's task is resolved in the renderer (`current → today's last session task → persisted lastTaskId`); main has the DB half. Options: (a) main predicts from `getLastSessionWithTask(today)` + `getCachedTask` and the copy degrades to `on your last task` / no clause when it finds nothing; (b) round-trip to the renderer (`ipcRenderer.invoke` from main is not a thing; it needs a request/response pair) for the exact answer; (c) no task in the copy. **Recommend (a).** Matches the real answer whenever a session ran today, which is the case the nudge is for.

**Decided: (a).** Main predicts the task from today's last session + the task cache; the copy degrades to `on your last task` / no clause. The flag stays in this plan.

**N5. Nudge card width.** Mockup 480, `CARD_W` 440. Options: (a) 440, shared with the other cards; (b) 480 for the nudge only; (c) 480 for all (changes the session-end look). **Recommend (a).**

**Decided: (a).** 440px, shared with the other cards.

**K1. Where the takeover lives.** Mockup: a 1200×800 frame with no rail. Options: (a) a `fixed inset-0 z-50` layer in the main renderer over every view, window raised as today (`showInactive` + `moveTop` for auto, `show()` for the nudge button / deeplink); (b) additionally `setFullScreen(true)` / `maximize()` for the warmup and restore after ("over the whole screen" literally) — window-state churn, restore edge cases on multi-display, and two minutes of a fullscreen Drip on top of whatever the user was reading; (c) a new transparent full-display overlay window (a fifth window kind; no keyboard, no focus). **Recommend (a).** The mockup is the window; the takeover is the whole window.

**Decided: (a).** `fixed inset-0 z-50` layer in the main renderer; window raised exactly as today.

**K2. `esc Stop` semantics during the warmup.** Mockup: one `Stop`. Existing: Now's `Cancel` → `reset` (no row, no confirm under 300 s) and `Finish` → `finishEarly` (rejects < 1 min); the roll-over prompt's `Stop` → `stopKickoff` (saves what ran as a `Kickoff` session, ≥ 1 min). Options: (a) `stopKickoff` — consistent with the prompt's `Stop`, but records 1-minute `Kickoff` rows whenever the user bails at 0:40, and the e2e could no longer exit a kickoff safely without a second key; (b) `reset` — "not now" leaves nothing behind, the idle clock restarts, the prompt's `Stop` keeps its save semantics after the roll-over; (c) both keys (`Stop` saves, `Cancel` doesn't). **Recommend (b).** A warmup abandoned in its first two minutes is not work worth a row; after the roll-over the prompt already offers the saving `Stop`.

**Decided: (b).** `esc Stop` during the warmup = `reset()` — no row, no confirm, same as Now's Cancel under 300 s. *Revised by owner (parity audit):* exactly Now's Cancel, i.e. `reset()` + `setIntention('')` + `clearSelection()` (a non-persisted `selectionResetToken` in `timerStore` that the Now screen watches to drop its local `selectedTask`); the takeover's `Finish` is likewise `finishEarly()` + `clearSelection()`.

**K3. Now's controls during the warmup (Pause / Finish / `+5 min` / Cancel).** The takeover covers the Now screen, so for ≤ 2 minutes they are reachable only through `drip://pause` etc. Options: (a) takeover shows only `Stop` (mockup); Now's warmup rendering and tests stay as the layer underneath, nothing deleted; (b) add a second small row (Pause / `+5 min`) to the takeover; (c) render the takeover inside `Timer` instead of over the app (rail and other views stay reachable — not a takeover). **Recommend (a).** The kickoff is two minutes of "just start"; the deeplinks cover the rare pause, and every control returns the moment it rolls over.

**Decided: OVERRIDE — none of (a)/(b)/(c) as written.** The takeover must not hide working controls. `esc Stop` stays the primary action as drawn, and a quiet secondary row (small mono, low contrast, `KeyButton` ghost keys) carries Pause / Resume, Finish and `+5 min`, wired to exactly the handlers Now uses during the warmup (`pause` / `resume` / `finishEarly` / `extendSession(5)`). The paused state renders sensibly on the takeover (digits dimmed, Resume shown, `+5 min` hidden as on Now). Each key has its own test. Now's warmup rendering stays as the layer underneath; nothing deleted.

**K4. Digits typeface and format.** Mockup: JetBrains Mono 200 at 240px, `1:37`. Now: Barlow Condensed 700 (`.now-digits`), `01:37`. Options: (a) `.now-digits` condensed at 240px (160px below `wide:`), `m:ss` as drawn, amber, blinking colon; (b) the mockup's thin mono (adds a 200-weight font load); (c) condensed with `mm:ss`. **Recommend (a).** One display face across Now and the takeover; the mockup's `m:ss` reads better for a two-minute clock.

**Decided: (a).** `.now-digits` condensed at 240px (160px below `wide:`), `m:ss`, amber, blinking colon.

**K5. Raycast Focus indicator signal.** Nothing tells the renderer whether Raycast is on (`raycastFocus.active` is private). Options: (a) `start-main-timer` returns `{ raycastFocus }` (enabled + Raycast present at start time), stored in `timerStore.raycastFocus`, cleared with `kickoff`; (b) a new main → renderer event on every `raycastFocusStart` / `End` (more channels, tracks pause / resume exactly); (c) no indicator (`Raycast Focus` line dropped). **Recommend (a).** One return value, no new channel; pause shows `off` because main ends the Raycast session on pause anyway. Note: the indicator says what Drip *asked* Raycast to do — Raycast has no status API (`raycastFocus.ts:9-10`), so "on" cannot be verified.

**Decided: (a).** `start-main-timer` returns `{ raycastFocus }`, mirrored into `timerStore.raycastFocus`.

**K6. Source line.** Mockup: `Started automatically after 15m idle`. The command has no source today. Options: (a) `IdleCommand.kickoff.source` (`auto` / `nudge` / `deeplink`) + `escalateMinutes` from `cfg`, `now` when started on the Now screen; lines `Started automatically after 15m idle` / `Started from the nudge` / `Started from Raycast` / `Started from Now`; (b) always the mockup sentence (wrong three times out of four); (c) no line. **Recommend (a).**

**Decided: (a).** `IdleCommand.kickoff.source` + `escalateMinutes`; four source lines.

**K7. "A huge 2-min button over the whole screen to just start" vs the mockup.** The mockup is the *running* takeover; the "start" affordance stays as Now's `Kickoff 2m` key, the nudge's `Kickoff 2m` key, `drip://kickoff`, and — the actual takeover — the automatic start 15 minutes after the nudge, which needs no button at all. Options: (a) mockup as drawn: the ridiculous part is that it starts *itself* and fills the window; (b) instead of auto-starting at escalation, take over with one huge `KICKOFF 2M` key and wait for the click — changes the escalation semantics (an ignored nudge would no longer start anything), so it breaks the parity rule; (c) (a) plus a huge `KICKOFF 2M` `KeyButton` as the nudge card's primary action (demotes `Start focus`). **Recommend (a).** Flagged because it is a real difference from the original words; the mockup is the later, more specific instruction.

**Decided: (a).** Mockup as drawn — the running takeover that starts itself; the start affordances stay where they are.

**K8. Roll-over prompt (`Kickoff done`, Keep going / Stop, 10-s timeout).** Not in the mockups. Options: (a) extract verbatim into `KickoffPromptCard.tsx`, no restyle; (b) restyle to match the new nudge (red → amber twin). **Recommend (a).** Out of the mockups' coverage; extraction only so the two idle-family cards stop sharing one `if`.

**Decided: (a).** Verbatim extraction into `KickoffPromptCard.tsx`, no restyle.

**E1. How the e2e screenshots the overlays.** `DRIP_TEST_MODE` keeps the idle watcher off and no session completes in the walk. Options: (a) preload-less fixture `BrowserWindow`s loading `overlay.html?state=…` — by construction no IPC, no DB, no `raycast://`; the real overlay module is never touched; (b) a `DRIP_E2E`-gated IPC that calls `showOverlay(fixture, { force })` on the real window — screenshots the real geometry but any click would fire real actions and the window is transparent on the desktop; (c) unit tests only. **Recommend (a).**

**Decided: (a).** Preload-less fixture `BrowserWindow`s loading `overlay.html?state=…`, created only under `DRIP_TEST_MODE` / `DRIP_E2E`; no IPC, no DB, no `raycast://` by construction.

**E2. Deeplink kickoff in the e2e.** Options: (a) add the `drip://kickoff` step (Esc within 45 s), proving main → renderer → takeover; (b) Now's `Kickoff 2m` only. **Recommend (a).** It is the only exercise of `idleNudge.startKickoff` the suite can have.

**Decided: (a).** The `drip://kickoff` step is added.

**E3. Exiting the kickoff in the e2e.** The takeover covers Now's `Cancel`. Options: (a) `Escape` (K2 → `reset`); (b) click the takeover's `Stop`. **Recommend (a)** (and assert the `Stop` key exists, never `stopKickoff`).

**Decided: (a).** Exit with `Escape` (→ `reset`), never `stopKickoff`; the `Stop` key is asserted, not clicked.

**D1. Docs.** Options: (a) a short "Overlay & Kickoff tokens" section in `UI_DESIGN_SYSTEM.md`, `CLAUDE.md` unchanged (no operational facts change); (b) also update the stale `FEATURE_INVENTORY.md` §1.11 row. **Recommend (a)**; the inventory is a dated snapshot by its own header.

**Decided: (a).** "Overlay & Kickoff tokens" section in `UI_DESIGN_SYSTEM.md`; `CLAUDE.md` and `FEATURE_INVENTORY.md` unchanged.

### Critical files for implementation
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/overlay/SessionEndOverlay.tsx` (idle branch extracted; session-end branches byte-identical)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/electron/idleNudge.ts` (payload builder, kickoff source; state machine untouched)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/stores/timerStore.ts` (`raycastFocus`, `kickoffSource`, `startKickoff` signature)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/src/App.tsx` (`KickoffTakeover` mount) and `src/components/Kickoff/KickoffTakeover.tsx` (new)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/electron/timer.ts`, `electron/raycastFocus.ts`, `electron/main.ts:1346-1354`, `electron/preload.ts:109` (the Raycast flag return)
- `/Users/marekmikesz/Documents/Claude workplace/Drip/productivity-agent-drip/e2e/smoke.mjs`, `e2e/db-guard.mjs`
