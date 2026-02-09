IMPORTANT — TOKEN EFFICIENCY RULES
----------------------------------
Be conservative with token usage.
Do NOT rewrite files unless absolutely required.
Use minimal diffs.
Reuse existing components, stores, patterns, and utilities.
Do NOT duplicate Pomodoro logic.
Add only what is necessary to support stopwatch mode.

Implement Stopwatch as a lightweight feature layered on top of existing timer infrastructure.

====================================================================
FEATURE — Stopwatch Timer for Adhoc Tasks
====================================================================

Goal:
Add a simple stopwatch mode that counts UP from 00:00:00 for adhoc tasks.  
User can optionally add a comment and then save the entry.  
Entry will later be edited in Daily Log (taskId assignment happens later).

This feature must be implemented with minimal changes.

--------------------------------------------------------------------
1. Add timerMode toggle
--------------------------------------------------------------------

Extend existing Timer screen with a segmented control:

   [Pomodoro] [Stopwatch]

Implementation notes:
- Add state: timerMode: 'pomodoro' | 'stopwatch'
- Store may already have fields for timer state; DO NOT modify Pomodoro state.
- Stopwatch state must be separate.

--------------------------------------------------------------------
2. Stopwatch state (minimal addition)
--------------------------------------------------------------------

Add the following fields either to timerStore or a new small store ONLY if needed:

   swStatus: 'idle' | 'running'
   swStartedAt: Date | null
   swElapsedSeconds: number
   swComment: string

Token-efficiency rules:
- Do NOT refactor Pomodoro state.
- Do NOT merge stopwatch and pomodoro state machines.
- Add the smallest necessary state to support counting UP.

--------------------------------------------------------------------
3. Stopwatch UI (reusing existing styles)
--------------------------------------------------------------------

In the Timer screen:
- Large centered time display (same styling as Pomodoro timer).
- Show HH:MM:SS format (count UP).
- Under timer: Comment input (optional).
- Start button (▶ Start)
- Stop button (■ Stop & Save, red when running)

Use existing button components and spacing utilities.

Design hints:
- Follow the Apple-like minimal style already in use.
- Match Pomodoro layout for visual consistency.

--------------------------------------------------------------------
4. Stopwatch logic (must NOT duplicate Pomodoro logic)
--------------------------------------------------------------------

When user clicks Start:
   - swStatus = 'running'
   - swStartedAt = now
   - Start a 1-second interval (reuse existing interval logic if possible)
   - Increment swElapsedSeconds every second

When user clicks Stop & Save:
   - Calculate:
        durationMinutes = ceil(swElapsedSeconds / 60)
   - Create adhoc entry:
        {
          source: 'adhoc',
          durationMinutes,
          comment: swComment || 'Stopwatch session',
          taskId: null,
          startAt: swStartedAt,
          logged: false,
          markedToLog: false
        }
   - Push this entry into the existing log store using current addEntry method.
   - Reset stopwatch state to idle.

Token-efficiency notes:
- Reuse the existing timer interval handler if possible.
- If adding a new interval, ensure cleanup is consistent with existing logic.
- Do NOT modify Pomodoro code paths.

--------------------------------------------------------------------
5. Toast notification on save
--------------------------------------------------------------------

After saving stopwatch entry, show:
   "Saved {duration}m — Edit in Daily Log to add Task ID"

Use the existing toast component (do NOT create a new one).

--------------------------------------------------------------------
6. Running-time footer (optional but lightweight)
--------------------------------------------------------------------

Display small gray footer:

   "Started at HH:mm · Running..."

Use same typography as Today list subtitled items.

--------------------------------------------------------------------
7. Absolutely avoid unnecessary changes
--------------------------------------------------------------------

Do NOT:
- Rewrite Pomodoro implementation
- Touch Today logs logic except where adding stopwatch entries
- Modify calendar sync logic
- Change app-wide state structure
- Replace components unless strictly required

Only add:
- The stopwatch toggle
- Stopwatch state
- Stopwatch timer UI
- Minimal logic to save adhoc entries

--------------------------------------------------------------------
END OF PROMPT
--------------------------------------------------------------------