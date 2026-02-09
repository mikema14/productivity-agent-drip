📘 Claude Code Prompt — Dashboard Overhaul & Long-Term Logic Fixes

Use this prompt to implement the complete, corrected, meaningful dashboard, including all logic, bug fixes, and UI improvements.

⸻

📌 Goal

Refactor and enhance the Dashboard so that it displays meaningful long-term data, supports daily intentions, provides task progress & milestones, and offers valuable visual summaries (weekly, 90-day, highlights).

The dashboard must become a daily “control center” for the user.

⸻

📌 Problems to Fix
	1.	Dashboard components incorrectly depend on selectedDate, resulting in weekly and 90-day widgets showing no long-term data.
	2.	Weekly Focus bars do not render visually.
	3.	90-Day Consistency heatmap appears as a single vertical column.
	4.	Tracked Task Cards do not show chevron toggle or inline milestones.
	5.	Highlights panel does not reflect true long-term data.
	6.	Dashboard lacks meaningful structure and actionable insights.

⸻

📌 Desired Outcome

A fully functional, visually clean dashboard with the following stable long-term components:
	•	Today’s Intentions
	•	Tracked Tasks (with inline milestones)
	•	Weekly Focus (7-day rolling summary)
	•	90-Day Consistency Heatmap
	•	Highlights (best day, streaks, trends)

All calculations must use global long-term logs, not session or day selection.

⸻

📌 Do NOT Change
	•	Timer logic
	•	Calendar sync
	•	Daily Log behavior
	•	Milestone CRUD
	•	API integration
	•	Routing structure

Focus only on:
DashboardPage, WeeklyFocus, Heatmap90Days, TaskCard, HighlightsPanel, and selectors in the stores.

⸻

—————————————————–

1. GLOBAL DATA LOGIC — REQUIRED SELECTORS

Create or fix selectors in logStore / taskStore as needed:

1.1 Long-term log access
	•	getAllLogs(): returns all sessions (existing)

1.2 Weekly summary (7 days)

getLast7DaysTrackedMinutes(trackedTaskIds)

	•	Rolling 7 days (today minus 6)
	•	Sum minutes where taskId ∈ trackedTaskIds

1.3 90-Day summary (heatmap)

getLast90DaysTrackedMinutes(trackedTaskIds)

Return array of 90 entries:

{ date: YYYY-MM-DD, minutes: number }

1.4 Task progress

getTaskMilestoneProgress(taskId)
→ { completed: n, total: m, percentage: p }

Fallback: if no milestones, return 0%.

1.5 Highlights

getBestDayStats(trackedTaskIds)
getCurrentStreak(trackedTaskIds)
getWeeklyTrend(trackedTaskIds)

Important

These selectors must never depend on selectedDate.

⸻

—————————————————–

2. DASHBOARD COMPONENT FIXES

2.1 Weekly Focus (WeeklyChart / WeeklyFocus.tsx)

Fix rendering:
	•	Bars must be visible and scaled
	•	Use fixed container height (e.g., h-24)
	•	Use pixel-based bar scaling:

height = (minutes / maxMinutes) * 60px


	•	Ensure 0-minute days show minimal bar (4px)
	•	Display day labels + minutes

Replace any getWeeklyFocusSummary with the new long-term selector.

⸻

2.2 90-Day Consistency Heatmap

Fix layout:
	•	Render a proper 15×7 grid (or similar) using display: grid
	•	Each cell: w-3 h-3 rounded
	•	Apply color intensity logic:
	•	0 min → gray
	•	1–20 → light blue
	•	20–40 → medium blue
	•	40–60 → strong blue
	•	60+ → saturated blue

Ensure the heatmap uses global 90-day selector, not daily data.

⸻

2.3 Tracked Tasks Panel

Fix:
	•	Add chevron toggle (▶ / ▼)
	•	Inline milestone expansion under each task card:

{expanded && <MilestonesList parentId={task.id} />}


	•	Expandable list must persist independently of date
	•	Show:
	•	progress
	•	milestone count
	•	time spent (last 7 days)
	•	next milestone highlighted (optional)

⸻

2.4 Today’s Intentions
	•	Keep as-is
	•	Ensure intentions are stored per day (intentions[YYYY-MM-DD] = [])
	•	Add quick-access list from most-used tasks (optional enhancement)

⸻

2.5 Highlights Panel

Use selectors to show:
	•	Best day in last 90 days
	•	Current streak
	•	Weekly trend (+/- percentage vs last week)
	•	Total minutes this week (tracked tasks only)

Do not depend on selectedDate.

⸻

—————————————————–

3. NEW UI STRUCTURE FOR THE WHOLE DASHBOARD

Header / Identity
	•	identity phrase
	•	main goal
	•	current streak
	•	subtle motivational line

Today’s Intentions
	•	list of 1–3 daily intentions
	•	“Add intention” field
	•	optional suggested intention (based on tracked tasks)

Your Tracked Tasks
	•	each task card shows:
	•	task name
	•	progress bar
	•	last 7 days minutes
	•	chevron to expand milestones
	•	inline milestones (checkbox list)

Weekly Focus
	•	7 bars aligned horizontally
	•	visible progress
	•	summary text: “+12% vs last week”, best day, etc.

90-Day Consistency
	•	Heatmap 90 squares in grid
	•	color intensity shows daily work
	•	highlight streaks visually

Highlights
	•	Best day
	•	Longest streak
	•	Current streak
	•	Weekly XP (or weekly minutes)

⸻

—————————————————–

4. Acceptance Criteria

The Dashboard must:
	•	✔ display correct long-term data (7 days, 90 days)
	•	✔ ignore selectedDate entirely
	•	✔ show visible bars in Weekly Focus
	•	✔ show proper grid in Heatmap
	•	✔ show chevron + inline milestone expansion
	•	✔ show meaningful highlights
	•	✔ use tracked tasks only
	•	✔ never reset long-term data because of UI state

⸻

—————————————————–

5. Output format

Return minimal diffs only for affected files:
	•	DashboardPage
	•	WeeklyFocus / WeeklyChart
	•	Heatmap90Days
	•	TaskCard
	•	HighlightsPanel
	•	Store selectors (only necessary sections)

Do NOT return full files unless absolutely needed.

End of prompt.
