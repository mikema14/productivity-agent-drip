1. GLOBAL RENAMING → “Drip”

Requirements:
	•	Replace all visible UI labels referring to the app name with “Drip”.
	•	Update:
	•	App title in Electron wrapper
	•	Header title (if present)
	•	Any constants or metadata used in “About” or splash screens
	•	Do not change folder names or internal namespaces unless required by code.

⸻

2. TIMER — Grouping by Task ID (UI-only grouping)

Requirements:
	•	Add UI-only grouping of timer entries by taskId in the Timer history view.
	•	Logged entries must remain separate in the backend.
Grouping is only presentation, not data merging.

Implementation hints:
	•	Add grouping function:

groupByTaskId(entries)

returning { taskId → [entries] }.

	•	UI:

Task ID (title row)
  - Entry row 1
  - Entry row 2
  - …


	•	If taskId = null, group under “Adhoc / No Task”.

⸻

3. NOTIFICATIONS — “No logging for 6 days” rule

Requirements:
	•	If user has not logged any minutes for 6 consecutive days, then:
	•	On day 7, show a notification:
"It’s been 6 days since your last logged work. Want to log today?"
	•	If the user does not interact within a reasonable timeout (configurable), automatically log a:

{ 
  source: 'auto',
  durationMinutes: 0,
  comment: 'Auto-log after inactivity',
  date: today
}



Implementation hints:
	•	Add selector:

getDaysSinceLastLog()


	•	Trigger the check on app start and once per day.
	•	Use existing notification system.

⸻

4. DAILY LOG — Grouping by Task ID (UI-only grouping)

Requirements:
	•	Same grouping logic as Timer:
	•	Group entries visually by taskId
	•	Logging behavior unchanged
	•	No data merging, grouping is display-only

UI example:

▶ TASK-123 — Marketing Plan  
   25m — "research"
   40m — "writing"
▶ TASK-555 — Internal
   10m — "sync"

Add expand/collapse per task group.

⸻

5. DAILY LOG — Add “Select All / Unselect All” Button

Requirements:
	•	Add a checkmark button at the top of the list:
	•	Single click toggles all entries:
	•	If any unchecked → mark all
	•	If all marked → unmark all

Implementation:
	•	Add:

toggleSelectAll()


	•	Ensure UI state updates immediately.
	•	Keep compatibility with “Mark to Log” logic.

⸻

6. TEMPLATES — Add Comment to Manage Templates

Requirements:
	•	In Manage Templates, add an input for comment when creating/editing a template.
	•	When a template is used via Quick Log:
	•	Prepopulate the comment field into the new log entry.

Adjustments:
	•	Update template data model:

{ name, durationMinutes, taskId, comment? }


	•	Update storage, UI form, and Quick Log handler.

⸻

7. QUICK LOG / ADHOC ENTRIES — Not Being Marked When Selected

Problem:

Selecting an entry created from Quick Log or Adhoc does not mark it for logging.

Fix:
	•	Ensure selection state uses unified logic:

toggleMarkForLogging(entryId)


	•	Verify quick-log and adhoc entries register properly in:
	•	markedToLog
	•	selection UI states

Acceptance:
	•	All entry types (regular, template, adhoc, quick log) must respond the same to selection.

⸻

8. OUTPUT FORMAT

Return only the necessary diffs for:
	•	Timer history view
	•	Daily log view
	•	Template manager
	•	Selection logic
	•	Notification logic
	•	Renaming locations
	•	Helper selectors in stores

Avoid full-file output unless required.

End of prompt.

