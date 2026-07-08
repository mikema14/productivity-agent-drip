# Leexi → Drip backlog sync

Automatically pulls action items assigned to **Marek Mikesz** from Leexi meeting
transcripts and drops them into a **Meeting Inbox** list in Drip's backlog.

## How it works

```
cron (every 2h)  →  Claude Code agent  →  Leexi MCP (query_calls / fetch_call_details)
                                       →  extract MY action items
                                       →  drip_backlog.py add  →  Drip SQLite (list_items)
```

No new API keys, no Drip rebuild. Task extraction is done by the agent (Claude)
reading the transcript — not a separate LLM call.

## Files
- `drip_backlog.py` — the only writer into Drip's DB. Creates the "Meeting Inbox"
  list if missing, inserts backlog items, and tracks a watermark in `state.json`.
- `agent-prompt.md` — the instructions the scheduled agent runs each time.
- `state.json` — created on first run: `{watermark, processed}`. Delete to reset.

## Why a schedule, not a true "meeting-ended" hook
Neither Claude Code hooks (they fire on Claude events, not your calendar) nor the
Leexi MCP (pull-only, no webhook) can detect that you attended a meeting. The Leexi
bot only produces a call *after* the meeting ends, so polling "any call newer than my
watermark?" is functionally equivalent — with a few minutes of latency.

## ⚠️ Known risk: MCP auth in headless runs
The Leexi connector is an interactively-authorized claude.ai connector. Scheduled /
cron runs are headless and **may not carry that authorization**. If a run reports
"Leexi MCP unavailable", the schedule can't work unattended — fall back to running the
agent manually (see below) in an interactive session, or re-authorize the connector for
scheduled runs. Verify the first scheduled run actually reached Leexi before trusting it.

## Run manually (always works, in an interactive Claude Code session)
Point Claude at `agent-prompt.md` and let it execute the steps. Good as a daily
end-of-day habit if unattended scheduling proves unreliable.

## Reset
```
rm state.json          # forget everything processed; next run backfills last 24h only
```

## Manual DB commands (rarely needed)
```
python3 drip_backlog.py watermark
python3 drip_backlog.py add --title "..." --call-uuid ... --call-title "..." --call-date YYYY-MM-DD
python3 drip_backlog.py mark-done --call-date "<ISO performed_at>"
```
The Drip DB path can be overridden with the `DRIP_DB` env var.
```
