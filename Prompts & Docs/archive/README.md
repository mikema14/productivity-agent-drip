# Archive

Historical prompts, status snapshots and superseded specs moved here on 2026-09-26. Nothing in the repo references these files; they are kept for provenance, not for use. Current docs live one level up (`README.md`, `DEVELOPMENT_RULES.md`, `UI_DESIGN_SYSTEM.md`, `BILLABLE_FEATURE.md`, `OVERLAY_DRAGGABLE_NOTES.md`, `perf-rendering-ipc.md`) and in `Redesign/`.

| File | What it was | Why archived |
|------|-------------|--------------|
| `Bugs & improvements latest.md` | Empty bug/improvement template | Never filled in |
| `CALENDAR_SYNC_FIX.md` | Step-by-step fix prompt for ICS fetched 9+ times per load | Fix shipped (5-min TTL cache in `calendar.ts`) |
| `CALENDAR_SYNC_PERFORMANCE_FIX.md` | Post-fix technical write-up of the same problem | Historical |
| `Calendar sync fix.md` | Prompt for daily-once sync + manual refresh button | Shipped |
| `Calendar sync fix:update.md` | Prompt for "Synced at HH:mm" toast | Shipped |
| `Convert Project Into a Standalone macOS App.md` | Prompt to move to electron-builder packaging | Shipped (`build`/`dist` scripts) |
| `DEVELOPMENT_STATUS_SUMMARY.md` | Terminal-dump status snapshot of MVP phases | Superseded by `Redesign/FEATURE_INVENTORY.md` |
| `Dashboard prompt.md`, `Dashboard prompt v2.md` | Prompts for the consistency dashboard MVP and its overhaul | Shipped as the Progress view |
| `Drip — deep focus features.md` | Early spec: focus/consistency tracker, weekly and 90-day signals | Implemented; superseded by `Redesign/` |
| `IMPLEMENTATION_STATUS.md` | Phase 1-5 checklist as of 2025-12-31 | Superseded by `Redesign/FEATURE_INVENTORY.md` |
| `MASTER SUMMARY GENERATION PROMPT.md` | Prompt used to generate the status summary above | One-off |
| `Next implementation.md` | Ordered feature batch prompt (4-3-2-1-5) | Shipped |
| `PHASE4_PROGRESS.md` | Calendar integration progress notes | Phase complete |
| `PHASE5_PLAN.md`, `PHASE5_REMAINING_TASKS.md` | Polish-phase plan and leftovers | Phase complete |
| `PHASE_2_0_DEVELOPMENT.md` | Phase 2.0 spec (delete, billable, templates, task intelligence) | Phase complete |
| `PHASE_2_0_A_BUGFIXES.md`, `PHASE_2_0_A_MERGED_ENTRIES.md`, `PHASE_2_0_A_TEST_CHECKLIST.md` | Phase 2.0-A fix notes and manual test checklist | Phase complete |
| `PHASE_2_0_UI Refactor- Card-Based Entry Layout.md` | Prompt for the card-based daily log rows | Shipped |
| `Stopwatch feature prompt.md` | Prompt for a count-up stopwatch mode | Explicitly excluded from the roadmap ("Stopwatch intentionally excluded") |
| `UI daily log redesign.md` | Control-bar concept for the daily log header | Superseded by `Redesign/` |
| `app fix and impro.md` | Rename to "Drip" + timer grouping prompt | Shipped |
| `Timer redesign/` | April 2026 focus-panel handoff (HTML mockup, JSX panels, FIX_LIST v1-v4, DEV_NOTES) | Built; superseded by `Redesign/` mockups and phase plans |
| `Quick log templates/` | Code-snippet prompts for a QuickLogBar/AddTemplateModal (was at repo root) | Feature not built under that name; stale snippets |
| `Tailwind Structure .md` | `TaskIdInput` component snippet (was at repo root) | Stale; component since rewritten |
| `llms-full.txt` | OpenRouter API reference dump | Unrelated to Drip |
| `Gemini_Generated_Image_*.png`, `block.png`, `timeline.png` | Loose mockup images | Unreferenced |
