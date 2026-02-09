# Drip — Focus, Consistency & Long-Term Signal (Implementation Spec)

## Purpose

Drip is a **personal focus and consistency tracker**, not a generic productivity tool.

Its purpose is to:
- Track **billable work time (~8h/day)**
- Encourage **showing up daily**
- Provide **long-term signals** (weekly / 90-day / monthly)
- Avoid micromanagement, guilt, or over-classification

Pomodoro remains the **only active timer**.
All higher-level insights are **derived**, never manually controlled.

---

## Core Principles (Do Not Break)

1. **One timer only**  
   Pomodoro is the single source of time data.

2. **Derived insights, not manual tagging**  
   No extra buttons during work.

3. **Rolling windows, never per-day resets**  
   Dashboard components must not depend on selected date.

4. **Reuse existing stores, selectors, and logic**  
   Extend current implementations; do not duplicate logic.

5. **Minimal UI, maximum meaning**  
   Fewer components, clearer signals.

---

## Time Model (Existing – Reuse)

Each logged entry already contains:
- `taskId`
- `durationMinutes`
- `startAt`
- `date`
- `logged / markedToLog`

All new features MUST be computed from existing entries.

No schema breaking changes.

---

## Feature 1 — Daily Intention

### Goal
Provide a **lightweight north star** for the day.

### Behavior
- Optional
- Editable at any time
- Does not block timer usage

### Data
- `dailyIntention: string | null`
- Stored per day

### UI
- Inline block above Timer or Daily Log
- Simple textarea
- Placeholder: *“What do I want to focus on today?”*

---

## Feature 2 — Optional Deep-Work Task Attribution

### Goal
Allow *optional* separation between:
- general billable work
- deliberate deep work

### Behavior
- User may select **one or more tasks** as “Deep-eligible”
- If none selected → all work counts as deep work

### Data
- Store list of `deepWorkTaskIds[]`
- Persisted in preferences

### Calculation Rule

If deepWorkTaskIds.length > 0:
DeepMinutes = sum(entries where taskId ∈ deepWorkTaskIds)
Else:
DeepMinutes = sum(all logged work)

No per-entry tagging.
No UI during timer runs.

---

## Feature 3 — End Day (Shutdown Ritual)

### Goal
Create **closure**, stabilize data, and enable reflection.

### Trigger
Explicit button:
- Label: `End Day`

### Flow (Single Modal)
1. **Review**
   - Total hours logged today
   - Deep work minutes
   - Tasks worked on

2. **Reflection (optional)**
   - Textarea: *“What moved forward today?”*

3. **Tomorrow (optional)**
   - 1–3 bullet intentions

### Behavior
- Closing the day locks daily stats
- Reopen only via explicit action
- Does NOT affect past rolling dashboards

---

## Feature 4 — Weekly Focus Summary

### Goal
Answer: *“Did I show up this week?”*

### Logic
- Rolling last 7 days
- Sum of:
  - Total hours
  - Deep work hours

### UI
- Horizontal bar chart
- One bar per day
- Never resets when changing selected date

---

## Feature 5 — 90-Day Consistency View

### Goal
Provide long-term proof of consistency.

### Logic
- Rolling last 90 days
- Each day represented as a dot or square
- Intensity based on **total hours logged**:
  - 0h → gray
  - 1–4h → light
  - 4–8h → medium
  - 8h+ → strong

### Notes
- Independent of selected day
- Must persist across sessions
- Must not reset visually

---

## Feature 6 — Monthly Wrap-Up

### Goal
High-level reflection without action pressure.

### Contents
- Total hours
- Deep work hours
- Best streak
- Highlights from daily reflections

### UI
- Read-only
- Generated on demand
- No editing

---

## Feature 7 — Workday Boundary Awareness

### Goal
Encourage sustainability without enforcement.

### Behavior
- User sets preferred workday end time
- If timer starts after:
  - Show soft confirmation dialog

No blocking.
No penalties.

---

## Dashboard Rules (Critical)

All dashboard widgets must:
- Use **rolling time windows**
- Use **selectors**, not inline loops
- Be **independent of selected date**
- React to preference changes automatically

Forbidden:
- Recomputing per render
- Using “current day only” logic
- Resetting on date navigation

---

## Technical Guidance for AI

- Prefer extending existing selectors
- Avoid new stores unless necessary
- Keep UI logic dumb; compute in selectors
- Do not refactor unrelated components
- Favor clarity over abstraction
- Keep changes incremental and testable

---

## Out of Scope (Explicitly Excluded)

- Chess / 4h timer
- Session classification (shallow vs deep)
- Milestones
- Focus modes
- Enforcement mechanisms

---

## Success Criteria

- Dashboard finally shows **long-term value**
- User can ignore dashboard for days and return to meaningful insights
- No increase in cognitive load during work
- No regression in existing timer or logging flows


