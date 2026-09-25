npm r# Drip Raycast Extension — Quick Start

## Installation (one time)

```bash
cd drip-raycast
npm install
npm run dev
```

This registers the extension in Raycast. After the first `npm run dev`, all 7 commands appear in Raycast (Cmd+Space) with a `[Dev]` badge. They persist between Raycast restarts — you don't need to keep a terminal open.

> If you ever need to re-register (e.g. after moving folders), just run `npm run dev` again.

## Preferences

On first use, Raycast will prompt for preferences. You can also set them later:

1. Open Raycast → search "Drip" → hit Cmd+, on any Drip command
2. Set:
   - **Easy Project URL**: `https://es.easyproject.com` (default)
   - **API Key**: Your `X-Redmine-API-Key` (optional — falls back to the key stored in the Drip app settings)

---

## Commands

All commands are accessible via **Cmd+Space** → type the command name.

### 1. Start Focus Session

**How**: Cmd+Space → "Start Focus"

**Form fields**:
- **Task** — dropdown of your 20 most recent tasks (from Drip's cache)
- **Intention** — optional text describing what you'll focus on

**What happens**: Opens the Drip app and starts a 25-minute Pomodoro timer.

---

### 2. Add Time Entry

**How**: Cmd+Space → "Add Time Entry"

**Form fields**:
- **Duration** — flexible input: `30m`, `1h`, `1h30m`, `1.5h`, or just `90` (minutes)
- **Task** — dropdown from recent tasks
- **Comment** — what you worked on
- **Date** — defaults to today

**What happens**: Inserts directly into the Drip database. The entry appears instantly in Drip's Daily Log view, marked for logging.

---

### 3. Today's Log

**How**: Cmd+Space → "Today's Log"

**Shows**: All of today's entries from all sources:
- Pomodoro sessions (blue hourglass)
- Manual/adhoc entries (orange document)
- Calendar events (purple calendar)
- Logged entries (green checkmark)

**Header**: `Today: 4h 25m total | 2h 30m logged`

**Actions** (select an entry, then):
- Enter → Open in Drip
- Cmd+C → Copy task ID

---

### 4. Search Tasks

**How**: Cmd+Space → "Search Tasks"

**How it works**:
- Type to search by task ID or title across Drip's cached tasks
- If you type a number that's not in the cache, an option appears: **"Fetch #12345 from Easy Project"** — hit Enter to fetch and cache it

**Actions** (select a task, then):
- Enter → Copy task ID
- Cmd+Enter → Start focus session with this task
- Cmd+Shift+Enter → Open in Easy Project browser

---

### 5. Today's Intentions

**How**: Cmd+Space → "Today's Intentions"

**What**: A simple intention list for the day, stored in Drip's database.

**Actions**:
- Enter → Toggle complete/incomplete
- Cmd+Backspace → Remove
- Cmd+N → Add new intention (text + optional task ID)

---

### 6. Log Unlogged Entries

**How**: Cmd+Space → "Log Unlogged"

**Shows**: Today's entries that have a task ID but haven't been logged to Easy Project yet.

**Actions**:
- Enter → **Log to Easy Project** (POST time entry, mark as logged)
- Cmd+Enter → **Log All** (batch log every visible entry, with confirmation)

**Requirements**: API key must be configured (Raycast preferences or Drip settings).

---

### 7. Weekly Stats

**How**: Cmd+Space → "Weekly Stats"

**Shows**: A markdown detail view with:
- Total hours and session count for the current week (Mon–Sun)
- Daily breakdown table with bar chart
- Top 5 tasks by time spent

---

## How It Works

The extension reads/writes the **same SQLite database** as the Drip Electron app:
```
~/Library/Application Support/drip/productivity.db
```

- **Reads** use Raycast's built-in SQLite (no native modules needed)
- **Writes** use the system `sqlite3` CLI
- **Timer control** uses the `drip://` URL scheme to send commands to the Electron app

Both apps can run simultaneously — SQLite WAL mode handles concurrent access safely.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Commands don't appear in Raycast | Run `npm run dev` in the `drip-raycast` folder |
| "Database does not exist" error | Make sure the Drip app has been launched at least once |
| Search Tasks empty | The task cache populates as you use tasks in Drip. Try fetching by ID. |
| "API key not configured" | Set it in Raycast preferences (Cmd+, on any Drip command) or in Drip's Settings |
| Start Focus doesn't start timer | Make sure the Drip app is running |
