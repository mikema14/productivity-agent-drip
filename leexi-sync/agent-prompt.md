# Leexi → Drip backlog sync (scheduled agent prompt)

You run on a schedule. Your job: find meetings I (Marek Mikesz) attended since the
last run, extract action items that are **mine**, and add them to the Drip backlog.
Be conservative — a wrong task is worse than a missed one.

Working dir: `/Users/marekmikesz/Documents/Claude workplace/Drip/leexi-sync`
All DB writes go through `drip_backlog.py` — never touch the SQLite file directly.

## Steps

1. **Read the watermark.** Run:
   `python3 drip_backlog.py watermark`
   This prints the ISO timestamp of the last call you processed (or `none` on first run).

2. **Find new calls.** Call Leexi MCP `query_calls` with `current_user_only: true`.
   Results are newest-first. Keep only calls whose `performed_at` is **strictly newer**
   than the watermark. If watermark is `none`, process only calls from the **last 24h**
   (don't backfill 517 calls on the first run — that's noise).
   If there are no new calls, stop. Say "No new meetings."

3. **For each new call, oldest-first** (so the watermark advances safely):
   a. Fetch content with `fetch_call_details` (use the AI summary/action items if present).
      Only call `fetch_call_transcript` if the summary is too thin to judge tasks.
   b. Extract **only tasks that are clearly assigned to or owned by Marek Mikesz.**
      Include a task when: someone asks Marek to do X, Marek commits to doing X, or
      Marek says he'll follow up / send / prepare / check something.
      EXCLUDE: other people's action items, vague discussion, decisions with no owner,
      recurring-standup chatter, and anything you're not reasonably sure is a real task.
      Skip pure status meetings that produced no commitments from me.
   c. Write each task:
      `python3 drip_backlog.py add --title "<imperative, <=90 chars>" \
         --call-uuid <uuid> --call-title "<title>" --call-date <YYYY-MM-DD>`
      Titles: start with a verb, be specific, no filler. e.g.
      "Send SharePoint field mapping to Marek Baňas (Liv-Epi)".
   d. After the call is fully handled, advance the watermark:
      `python3 drip_backlog.py mark-done --call-date "<performed_at exactly as returned>"`

4. **Report** a short summary: calls processed, tasks added (list the titles), calls
   skipped with no tasks. Nothing else.

## Guardrails
- `add` is idempotent per (call, title) — re-running a call won't duplicate tasks.
- Never lower the watermark; `mark-done` only moves it forward.
- If Leexi MCP is unavailable (not authorized in this run), stop and report that —
  do not guess or fabricate tasks.
- Max ~5 tasks per call. If a call seems to yield more, you're probably over-extracting.
