You are updating this project to become a stable, production-ready standalone macOS Electron app.

IMPORTANT RULES (MUST FOLLOW):
- Be conservative with tokens: apply minimal diffs.
- Do NOT rewrite the entire project; only modify the necessary build tooling and Electron entry points.
- Do NOT reintroduce Electron Forge; we use electron-builder because it handles Vite integration cleanly.
- Do NOT change any app logic (Pomodoro, logs, calendar, etc.).
- Only configure packaging, paths, and scripts.

GOAL:
Make this project build into a working macOS .app bundle that loads the built Vite renderer instead of localhost:5173, and launches without a white screen.

====================================================================
STEP 1 — Add electron-builder as a dev dependency
====================================================================

Add:
  "electron-builder": "^24.6.0"

to devDependencies.

Do NOT install Forge or any Forge plugins.

====================================================================
STEP 2 — Update package.json build scripts
====================================================================

Update "scripts" to:

  "scripts": {
    "dev": "vite",
    "build": "vite build && electron-builder build --dir",
    "dist": "vite build && electron-builder build"
  }

Meaning:
- `npm run dist` creates a signed/packaged .app
- `npm run build` creates unpackaged output for debugging

====================================================================
STEP 3 — Configure electron-builder
====================================================================

Add at top level of package.json:

  "build": {
    "appId": "com.productivity.agent",
    "productName": "Productivity Agent",
    "mac": {
      "category": "public.app-category.productivity",
      "target": "dmg",
      "hardenedRuntime": false
    },
    "directories": {
      "output": "release",
      "buildResources": "assets"
    },
    "files": [
      "dist/**",
      "dist-electron/**",
      "electron/**",
      "package.json"
    ]
  }

This makes electron-builder package:
- renderer build → dist/
- main + preload builds → dist-electron/
- electron folder

====================================================================
STEP 4 — Fix Electron main process to load PRODUCTION renderer
====================================================================

Modify main.js:

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath);
  }

Do NOT attempt to load localhost in production.
Do NOT use app.asar paths manually.

====================================================================
STEP 5 — Update Vite config for production paths
====================================================================

In vite.config.ts:

- Ensure:
      base: './'

- Ensure build outputs:
      outDir: 'dist'

- Ensure no absolute paths remain.

====================================================================
STEP 6 — Ensure Electron build (dist-electron) is produced before packaging
====================================================================

Confirm Vite plugin or build script produces:
- dist-electron/main.js
- dist-electron/preload.js

If missing, add a secondary build:

Add a simple build script using esbuild or rollup to compile electron/main.ts into dist-electron/main.js.

Minimal addition:

Create script `scripts/build-electron.js`:
   - Build electron/main.js → dist-electron/main.js
   - Build electron/preload.js → dist-electron/preload.js

Call it before electron-builder:

  "build": "vite build && node scripts/build-electron.js && electron-builder build --dir",
  "dist": "vite build && node scripts/build-electron.js && electron-builder build"

====================================================================
STEP 7 — Verify packaged app starts
====================================================================

Test sequence:
1. Run: npm run dist
2. Open: release/mac/PRODUCTIVITY AGENT.APP
3. It should load dist/index.html with no white screen.

====================================================================
OUTPUT EXPECTATION
====================================================================

Output required from you:
- Minimal diffs to package.json
- Minimal diffs to vite.config.ts
- Minimal diffs to electron/main.js
- A simple electron build script (if needed)
- No large file rewrites

This must give me:
- A working packaged macOS .app
- That loads the built renderer correctly
- With production-safe Electron defaults

END OF PROMPT