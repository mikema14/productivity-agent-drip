# Drip — how to use it (v1.1)

Before the redesign, Drip was a set of separate tools reached from a sidebar. It's now one daily loop: **plan** the work in Plan, **do** it on Now, **close** the day in Review. Between those steps the app sends you on (Start on, Review day, End day) and won't let you drift while idle.

## Monday morning: plan the week
1. **Open Plan.** Your lists (projects) are on the left. The board has three columns: **Today · This week · Backlog**. "All tasks" shows every list together; clicking a list shows only that project.
2. **Triage the Backlog.** It's grouped into *New this week*, *Everything else* and *Older than 14 days*, so stale items stand out. Tasks created from Leexi calls show "from call · date".
3. **Build the week.** Drag tasks, or use the hover arrows, from Backlog into This week, then pull today's handful into Today. There are no caps. Today's column tells you how realistic that is: "Xh / 6h focus".
4. **Start.** Press **Start on <task>** at the bottom of Today. It takes you to Now with that task already selected. It doesn't start the timer.

## Any morning: start the day
Go straight to **Now**, or to Plan first if Today needs adjusting.
- **Set an intention** (up to 3 lines), shown at the top. You can now edit it any time, even mid-session.
- **Pick a task.** Recent tasks are ranked by how often you work on them, with today's minutes and the full project name. `/` searches. Typing a task number and pressing Enter fetches it from Easy8.
- **Choose a length** (15/25/50/90) and press **Enter** to begin focus.
- **Not in the mood:** press **Kickoff 2m**. It's a 2-minute start that rolls straight into a full session when it ends.
- **Your day in one glance:** the right-hand panel shows a 6h focus bar and today's timeline, or switch it to your task lists.

## During the day
- **During a session:** Now shows one calm block: task and end time, the title, the countdown. Pause, Finish (saves what you did), Cancel (saves nothing; asks first after 5 minutes) and +5 min.
- **Session ends:** the same pop-up card as before. Write a note, then start a break or the next focus.
- **During a break (new):** pick the next task and write its note while you rest. When the break ends, one Enter starts it.
- **Drifting (new):** after **10 min** with nothing running, and you're not in a meeting and the screen isn't locked, a **red nudge** appears. You can Start focus, Kickoff, or Snooze for 15 min, 1 h or the rest of the day. In a call or on a coffee break, pause nudges ahead of time from the menu-bar icon (Pause nudges; turn the icon on in Settings) or resume them from the "Nudges paused until…" line on Now; starting a focus or break clears the pause. Ignore it for **15 more minutes** and Drip takes over: Raycast Focus turns on and a 2-minute kickoff fills the Drip window. **Esc** stops it without saving anything. At 2:00 it asks "keep going?"; if you don't answer, it continues into a full session. The same thing happens if you don't get going after a break ends.

## End of day: close it in Review
Press **Review day →** at the bottom of Now; it shows how many entries aren't logged yet. Review always opens on today. The main job here is logging, and closing the day is optional.
1. **Log time.** The bar at the top shows what is still **to log**, how many entries **need a task**, and what is already **logged**.
   - The list starts on **To log**. Logged entries are one **show** away, in the footer or the **All** / **Logged** filter.
   - Edit in place:
     - Click a duration and type `45m`, `1h10` or `1:10`.
     - The comment field is exactly what Easy8 receives.
     - **Yes / No** sets billable.
   - An entry without a task is highlighted, and its checkbox stays off until you **+ Assign task**. The picker searches your recent tasks; a task ID + Enter fetches it.
   - A calendar event with a task is accepted when you tick it.
   - Press **Log N to Easy8**, or just Enter. N counts only the ticked entries that have a task. Any failure shows on the row that failed. An invalid API key shows a banner that opens Settings.
   - **N** or **+ Add entry** adds a manual entry. Hover a row to move it to another day or delete it.
2. **Close the day (optional).** The right-hand panel works through Plan's Today items:
   - **Done** marks it complete.
   - **Carry** leaves it in Today; after two workdays it shows **Carried 2×**.
   - **Week** moves it back to This week.
   - **Drop** moves it to Backlog; nothing is deleted.
   One line shows what tomorrow starts with, its meetings and how much of your 6h is free. Write one line about today, then press **End day**. That saves the reflection and tomorrow's intentions, and the day is locked. Logging never needs End day.

## Friday
Same close, but **End day plans Monday**, not Saturday. Monday then starts with that plan in place.

## Changed compared with before
- Lists moved out of the sidebar into Plan. Plan's Today column drives both **Start on** (Plan → Now) and the review of today's tasks (Now → Review).
- Nothing carries over automatically. Tasks stay in Today until you move them, and "Carry" just confirms that.
- Idleness now has consequences: a nudge, then a takeover.
- The session-end and break pop-ups, posting to Easy8, Templates, Group by task, Move entries to another day, the calendar sync and Settings all work as before.
- Not built, although the design mockups showed them:
  - a weekly-review button
  - week arrows in Plan
  - ⌘K
  - triage keyboard shortcuts

  Those belong to the later task-hygiene work.