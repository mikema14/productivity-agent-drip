# Drip

A personal macOS app for one working day: plan tasks, run focus sessions, then review the day and log
time entries to Easy8. Electron + React + TypeScript + Tailwind + Zustand + better-sqlite3.

- How to use it: [`Prompts & Docs/Redesign/USER_GUIDE.md`](Prompts%20&%20Docs/Redesign/USER_GUIDE.md)
- Design system: [`Prompts & Docs/UI_DESIGN_SYSTEM.md`](Prompts%20&%20Docs/UI_DESIGN_SYSTEM.md)
- Technical notes: [`docs/`](docs/)

```bash
npm install
npm run dev          # Vite + Electron (uses the real database in ~/Library/Application Support/drip)
npm test             # vitest (renderer + electron)
npm run typecheck
npm run e2e:smoke    # Playwright walk under a backup/restore guard; quit Drip.app first
npm run dist         # DMG into release/
```

Dev builds never post time entries to Easy8; only the packaged app does.
