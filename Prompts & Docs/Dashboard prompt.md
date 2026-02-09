IMPORTANT — TOKEN EFFICIENCY RULES
----------------------------------
• Only apply minimal diffs; NO full-file rewrites.
• Reuse existing components, stores, patterns, and styling.
• Create new modules only when necessary (e.g. new stores/features).
• Follow the existing project structure for React components and Zustand stores.
• Prefer small isolated updates over broad refactors.
• Never duplicate existing logic (e.g., time calculations, session aggregation).
• All code output MUST reference real existing paths and naming conventions (analyze project before coding).

GOAL
----
Implement a “Consistency Dashboard MVP” with:
1. Identity + Goal header
2. Today’s Intentions (add, remove, persist)
3. Tracked Task Progress (grouped by taskId, user-selectable)
4. Task Details View with Milestones (collapsible)
5. Weekly Focus Chart (bar)
6. Consistency Heatmap (90 days)
7. Supporting stores + minimal DB extensions

This MVP must be implemented with maximum reuse of existing logic such as:
- daily logs
- session storage
- time aggregation
- sidebar navigation
- component styling conventions
- Zustand usage
- date models

====================================================================
SECTION 1 — DATA LAYER (STORES + MODELS)
====================================================================

Create **new Zustand stores** with minimal, modular shape:

---------------------------------------------------------
1. useTaskPreferencesStore.ts
---------------------------------------------------------
Stores which tasks the user tracks:

{
  taskPreferences: {
    [taskId: string]: {
      tracked: boolean,
      pinned: boolean,
      milestoneIds: string[]
    }
  },

  setTracked(taskId: string, tracked: boolean),
  togglePinned(taskId: string),
  attachMilestone(taskId: string, milestoneId: string),
  detachMilestone(taskId: string, milestoneId: string)
}

Rules:
- Only show tasks in Dashboard if tracked === true.
- Pinned tasks appear at the top.

---------------------------------------------------------
2. useMilestonesStore.ts
---------------------------------------------------------
{
  milestones: {
    [milestoneId: string]: {
      parentType: 'task' | 'goal',
      parentId: string,
      title: string,
      description?: string,
      completed: boolean,
      order: number,
      weight?: number
    }
  },

  createMilestone(parentType, parentId, title),
  updateMilestone(id, patch),
  deleteMilestone(id),
  toggleMilestoneCompleted(id)
}

DO NOT link milestones to logs. They are purely structural.

---------------------------------------------------------
3. useGoalsStore.ts
---------------------------------------------------------
{
  goals: {
    [goalId: string]: {
      title: string,
      description: string,
      identityReinforcement?: string,
      milestoneIds: string[]
    }
  }

  createGoal(title),
  updateGoal(goalId, patch)
}

NOTE: Only minimal goal fields for MVP.

---------------------------------------------------------
4. useIntentionsStore.ts
---------------------------------------------------------
Store today's intentions indexed by date:

{
  dailyIntentions: {
    [date: YYYY-MM-DD]: string[]
  },

  addIntention(date, text),
  removeIntention(date, index)
}

Rules:
- Intention list max 3 (soft limit).
- Shown in Dashboard + Timer screen.

---------------------------------------------------------
5. Extend existing log/session store
---------------------------------------------------------
Add derived selectors:

getDailyFocusMinutes(date)
getWeeklyFocusSummary(startDate)
getTaskTotalMinutes(taskId)

Implementation must reuse existing logs and time calculations.

====================================================================
SECTION 2 — DASHBOARD UI COMPONENTS (MVP)
====================================================================

Create a new page:

src/components/Dashboard/DashboardPage.tsx

with subcomponents:
- IdentityHeader
- TodayIntentionsPanel
- TrackedTasksPanel
- WeeklyChart
- Heatmap90Days
- HighlightsPanel

Keep each component in its own small file to avoid huge diffs.

---------------------------------------------------------
IdentityHeader
---------------------------------------------------------
Data:
- useGoalsStore → main selected goal
- goal.identityReinforcement

UI:
--------------------------------------------------------
[I am becoming...]
"Identity reinforcement text"
[Current Goal]
"Goal title here"
--------------------------------------------------------

Use same styling conventions as top panels in Today.

---------------------------------------------------------
TodayIntentionsPanel
---------------------------------------------------------
Data:
- useIntentionsStore
- today formatted as YYYY-MM-DD

UI mockup:
--------------------------------------------------------
Today's Intentions
• Deep work             [x]
• Avoid distractions    [x]
[ + Add intention ]
--------------------------------------------------------

Limit: 3 items (soft check in UI).

---------------------------------------------------------
TrackedTasksPanel
---------------------------------------------------------
Data sources:
- useTaskPreferencesStore
- useMilestonesStore
- existing log store for time/session data

Logic:
- Filter tasks where tracked === true
- Sort pinned tasks first
- Compute progress from milestones OR time

Progress formula:
If milestones exist:
  progress = completed / total
Else:
  progress = clamp(totalMinutes / estimatedGoalHours, 0–1)

UI mockup:
--------------------------------------------------------
Your Key Tasks
--------------------------------------------------------
TASK-212 Dashboard MVP
Progress: ███░░ 30%
Milestones: 2/5
Time Spent: 2h 10m
[View Details]

TASK-123 Client API Redesign
Progress: ████░ 45%
Milestones: 3/7
Time Spent: 4h 45m
[View Details]

[Manage Tracked Tasks]
--------------------------------------------------------

---------------------------------------------------------
TaskDetailsPage
---------------------------------------------------------
Route: /task/:taskId

Contains:
- Title
- Time spent
- Progress
- MilestonesList (collapsible)
- BreakTaskWidget (add milestones)

UI mockup:
--------------------------------------------------------
TASK-212 Dashboard MVP
Time spent: 2h 10m
Progress: 30%

Milestones ▼
  [✓] Build Intention Panel
  [✓] Setup Task Preferences
  [ ] Weekly Chart
  [ ] Heatmap
  [ + Add Milestone ]
--------------------------------------------------------

---------------------------------------------------------
WeeklyChart
---------------------------------------------------------
Pull session data for last 7 days.

UI:
Simple vertical bars using existing chart library or div-based bars.

---------------------------------------------------------
Heatmap90Days
---------------------------------------------------------
Use 12–15 weeks of daily squares.  
Map focus minutes → intensity.

UI:
GitHub squares, small padding, grid layout.

====================================================================
SECTION 3 — SIDEBAR + ROUTING
====================================================================

Add a new sidebar item:
Dashboard

Route:
 /dashboard → DashboardPage

Add another route:
 /task/:taskId → TaskDetailsPage

Use existing routing system. Minimal diff.

====================================================================
SECTION 4 — DB / LOCAL STORAGE
====================================================================

Add new persistent tables or maps via existing DB pattern:

Tables needed:
- task_preferences
- milestones
- goals
- daily_intentions

Token-efficient requirement:
- Each table defined with minimal fields.
- Use existing schema migration pattern.
- Only patch DB to add required tables — do not restructure any existing tables.

====================================================================
SECTION 5 — HIGHLIGHTS PANEL
====================================================================

Derived stats:
- Most focus minutes this week
- Longest weekly streak
- Milestones completed this week

Minimal logic, no heavy calculations.

UI:
--------------------------------------------------------
Highlights
✔ Best day: Wednesday (80 min)
✔ Completed 2 milestones
✔ New streak: 3 days
--------------------------------------------------------

====================================================================
OUTPUT EXPECTATIONS
====================================================================

Your output must include ONLY:
- Minimal diff patches for new stores
- Minimal diff patches for DashboardPage + components
- Minimal DB schema additions
- Updated routing + sidebar entries
- Updated selectors in log store

NO full rewrites.  
NO unnecessary refactors.  
All naming MUST match existing conventions.

====================================================================
END OF PROMPT
====================================================================