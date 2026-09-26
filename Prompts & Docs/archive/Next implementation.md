IMPORTANT — READ BEFORE IMPLEMENTING
------------------------------------
Be conservative with token usage.  
Do NOT rewrite existing files unnecessarily.  
Do NOT generate full files unless absolutely required.  
Only apply minimal diffs to existing code.  
Reuse existing store logic, components, and patterns already in the project.  
Draw from prior implementations to avoid regressions.  
Preserve all working functionality.

Implement features in this exact order:
4 → 3 → 2 → 1 → 5  (Stopwatch intentionally excluded)

Keep PR-style reasoning:
- Identify required files before updating them
- Apply targeted patches
- Reuse existing functions when possible
- Avoid creating new components unless necessary
- Assume all standard functionality already works

====================================================================
FEATURE 4 — “Continue Previous Session” Quick Action
====================================================================

Goal:
Allow user to quickly continue the last session with the same taskId + intention
without filling the form again.

Implementation details:
1. Determine last session:
   - Use today's most recent session (prefer Pomodoro session)
   - Must contain taskId OR intention
   - Reuse existing session retrieval functions

2. Add UI:
   - Add a small blue button at top of Timer screen:
        [Continue Previous Session]
          TASK-123 · "Rewrite API payload"

   - Only show if a valid previous session exists.

3. On click:
   - Auto-fill:
       taskId = lastSession.taskId
       intention = lastSession.intention
   - Immediately start a new Pomodoro using the same logic as the regular Start button.
   - DO NOT duplicate Pomodoro logic — call existing startPomodoro().

Design hints (use existing styling helpers & components):
- Apple-like minimalist
- Blue primary button
- Use same spacing as other timer controls

====================================================================
FEATURE 3 — Pomodoro Completion Prompt (“Continue or Break”)
====================================================================

Goal:
When Pomodoro ends, prompt the user:
"Do you want to continue working or take a break?"

Implementation:
1. At end of a Pomodoro:
   - Keep existing notification
   - Add in-app modal OR small prompt with two actions:
        [▶ Continue Working]
        [☕ Start Break]

2. Continue Working:
   - Start a new Pomodoro immediately with:
       • same taskId
       • same intention
   - Reuse startPomodoro() with prefilled state.
   - DO NOT reimplement timer logic.

3. Start Break:
   - Use existing break logic.

Design hints (minimal patch):
- Use existing modal/toast component if available
- Avoid adding new UI libraries

====================================================================
FEATURE 2 — Today’s Session: Show “Intention”
====================================================================

Goal:
Show the intention text for each completed session in Today view.

Implementation:
1. Extend session model (if needed):
   session.intention: string

2. When saving Pomodoro session:
   - Ensure intention is saved along with duration and taskId.

3. Today UI:
   Show this clearly under session entry:
       25m · TASK-123
         Intention: Rewrite API payload

   Only show this line if intention is non-empty.

Design hints:
- Left-aligned
- Small gray text for intention line
- Match existing Today list styles

====================================================================
FEATURE 5 — Task Cache Sorting: Recent First (Limit 10)
====================================================================

Goal:
Improve task suggestion dropdown to show most recently used tasks first.

Implementation:
1. Task cache object already exists — extend it with:
   lastUsedAt: number (timestamp)

2. Update lastUsedAt whenever:
   - User starts a Pomodoro with a taskId
   - User selects a taskId from suggestions
   - Quick log uses a template containing a taskId

3. Sorting:
   - Sort by lastUsedAt DESC
   - Limit suggestions to top 10

Design hints:
- Keep the dropdown visually identical
- Only change the order of items

====================================================================
TOKEN EFFICIENCY REQUIREMENTS
====================================================================

FOLLOW THESE STRICT RULES:
1. Do NOT rewrite entire files unless absolutely required.
2. Prefer small patch/diff updates.
3. Reuse existing stores, selectors, actions, and UI components.
4. Do NOT reimplement Pomodoro logic — call startPomodoro() or existing actions.
5. Reuse the existing "Today" UI layout when adding intention.
6. For modals, reuse an existing modal or toast component if it exists.
7. For the Continue Previous Session button:
   - Only update the Timer screen component
   - Do NOT move state to new files
8. For task cache sorting:
   - Never rewrite the full store; update only the sorting code.

====================================================================
END OF PROMPT
====================================================================