### UI Refactor: Card-Based Entry Layout

Replace the table layout in DailyLog.tsx with card-based rows.

**Entry Card Structure:**
- Row 1: Checkbox | Title + Type badge + Sessions badge | Duration | Time
- Row 2: Comment (truncated, italic if empty)
- Row 3: Task ID (mono, blue) | Billable badge | Actions (Edit/Delete)

**Visual States:**
- Unlogged: White background, checkbox enabled
- Logged: Green-50 background, green checkmark instead of checkbox, no Delete button

**Tailwind Classes:**
- Container: `px-6 py-4 border-b border-gray-100 hover:bg-gray-50`
- Logged: add `bg-green-50/50`
- Title: `font-medium text-gray-900 truncate`
- Duration: `font-mono font-medium text-gray-900`
- Task ID: `font-mono text-xs text-blue-600`
- Billable (yes): `text-xs text-green-600` with checkmark icon
- Billable (no): `text-xs text-gray-400`
- Type badges: 
  - pomodoro: `bg-red-100 text-red-700`
  - calendar: `bg-purple-100 text-purple-700`
  - adhoc: `bg-gray-100 text-gray-600`