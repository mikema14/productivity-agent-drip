# Productivity Agent - Phase 1

A single-user macOS desktop app for productivity tracking with Pomodoro timer, time logging, and Easy Project integration.

## Phase 1 Features ✓

- ✅ Pomodoro timer (25/5 min cycles)
- ✅ Session storage to SQLite database
- ✅ Menu bar tray icon with time display
- ✅ Desktop notifications
- ✅ Session history tracking

## Tech Stack

- **Desktop**: Electron 28+
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS 3.x
- **State**: Zustand
- **Database**: better-sqlite3
- **Build**: Vite + electron-builder

## Prerequisites

Before you can run this project, you need to install:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)

To verify installation:
```bash
node --version
npm --version
```

## Setup Instructions

1. **Install dependencies**:
   ```bash
   cd productivity-agent
   npm install
   ```

2. **Run in development mode**:
   ```bash
   npm run dev
   ```

   This will:
   - Start the Vite dev server on http://localhost:5173
   - Launch the Electron app
   - Open DevTools for debugging

3. **Build for production**:
   ```bash
   npm run build
   ```

   This creates a DMG installer in the `release/` directory.

## Project Structure

```
productivity-agent/
├── electron/              # Electron main process
│   ├── main.ts           # App initialization & IPC
│   ├── preload.ts        # Context bridge
│   └── tray.ts           # Menu bar icon
├── src/
│   ├── components/       # React components
│   │   ├── Layout/       # Sidebar, MainContent
│   │   └── Timer/        # Timer, Controls, History
│   ├── stores/           # Zustand state management
│   ├── services/         # Database operations
│   ├── types/            # TypeScript definitions
│   └── utils/            # Helper functions
├── database/
│   └── schema.sql        # SQLite schema
└── public/               # Static assets
```

## Usage

### Starting a Focus Session

1. Open the app
2. (Optional) Enter a task ID from Easy Project
3. Click "Start Focus Session"
4. Work for 25 minutes
5. Take a 5-minute break when notified

### Session Tracking

- All sessions are automatically saved to SQLite
- View today's sessions in the "Today's Sessions" panel
- Session count resets daily
- After 3 sessions, you'll get a 10-minute long break

### Menu Bar Integration

- Timer displays in menu bar while running
- Click tray icon to show/hide app
- Right-click tray icon for context menu

## Database Location

SQLite database is stored at:
```
~/Library/Application Support/productivity-agent/productivity.db
```

You can inspect it using any SQLite client.

## Troubleshooting

### App won't start
- Make sure all dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be 18+)
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

### Database errors
- The database is created automatically on first launch
- Check app logs for specific error messages
- Delete database to reset: `rm ~/Library/Application\ Support/productivity-agent/productivity.db`

### Build errors
- Clear build cache: `rm -rf dist dist-electron release`
- Rebuild: `npm run build`

## Development Tips

- Hot reload is enabled in dev mode - changes to React components update automatically
- Electron main process requires app restart for changes
- Use DevTools (Cmd+Option+I) for debugging renderer process
- Check terminal for main process logs

## Next Steps (Upcoming Phases)

- **Phase 2**: Daily log view with entry management
- **Phase 3**: Easy Project API integration
- **Phase 4**: Calendar sync from Outlook
- **Phase 5**: Reporting and export features

## License

MIT
