# Development Rules & Guidelines

## Core Principles

### 1. **Full User Control - No Restrictions**
This is a **single-user personal productivity app**. The user is the admin and should have COMPLETE control over their data.

#### Rule: ALL Entries Must Be Editable and Deletable
- ✅ **Pomodoro sessions** - fully editable and deletable
- ✅ **Adhoc entries** - fully editable and deletable
- ✅ **Calendar entries** - fully editable and deletable
- ✅ **Merged entries** - fully editable and deletable
- ⚠️ **Logged entries** - can be deleted with confirmation warning

**Rationale**:
- User may make mistakes and need to correct them
- User may want to clean up test data
- User may need to adjust historical entries
- Merged entries are just a display convenience - underlying data can be modified
- The app should never prevent the user from managing their own data

**Current Implementation Status**:
- ✅ Pomodoro sessions: Editable and deletable
- ✅ Adhoc entries: Editable and deletable
- ✅ Calendar entries: Can be dismissed/accepted
- ⚠️ Merged entries: Editable (edits apply to all sources) but **NOT deletable** - **NEEDS FIX**
- ⚠️ Logged entries: Protected from deletion - **SHOULD ADD CONFIRMATION DIALOG**

### 2. **No Artificial Restrictions**
- Never block user actions "for their own good"
- Provide warnings, not blocks
- Confirmations for destructive actions, not prevention
- Trust the user to manage their own data

### 3. **Edit/Delete Behavior**

#### Merged Entries
When editing a merged entry:
- ✅ Changes apply to ALL source sessions (current behavior)
- ✅ User should see clear indication: "Edits apply to X sessions"

**TODO**: When deleting a merged entry:
- Should prompt: "Delete all X sessions in this merge? This cannot be undone."
- If confirmed: Delete all source sessions
- If canceled: Keep all sessions

#### Logged Entries
When deleting a logged entry:
- Should prompt: "This entry has been logged to Easy Project (ID: 12345). Delete anyway?"
- Show warning about data integrity
- If confirmed: Delete from local database (keep in Easy Project)
- Mark that it was user-deleted for audit purposes (optional)

### 4. **Data Integrity vs User Control**
**Priority**: User control > Data integrity

- User can delete logged entries (they're already in Easy Project)
- User can edit logged entries (local database only)
- Provide warnings, but don't block
- Trust the user

---

## Future Development Tasks

### High Priority: Remove All Delete Restrictions

1. **Enable Merged Entry Deletion**
   - File: `src/components/DailyLog/EntryRow.tsx`
   - Remove condition: `{!entry.isMerged && (...)}`
   - Show delete button for merged entries
   - Add confirmation dialog with bulk delete logic

2. **Add Logged Entry Delete Confirmation**
   - File: `src/stores/logStore.ts`
   - Remove hard block on logged entry deletion
   - Add confirmation dialog warning
   - Allow deletion after confirmation

3. **Implement Bulk Delete for Merged Entries**
   - File: `src/stores/logStore.ts`
   - Add `deleteMergedEntry(id: string)` function
   - Find all source entries
   - Delete all source entries
   - Refresh view

### Example Implementation:

```typescript
// In logStore.ts
deleteEntry: async (id: string) => {
  const { entries, selectedDate } = get();
  const entry = entries.find(e => e.id === id);

  if (!entry) return;

  // Warn if logged
  if (entry.logged) {
    const confirmed = window.confirm(
      'This entry has been logged to Easy Project. Delete anyway?'
    );
    if (!confirmed) return;
  }

  // Handle merged entries
  if (entry.isMerged) {
    const confirmed = window.confirm(
      `Delete all ${entry.sourceCount} sessions in this merge? This cannot be undone.`
    );
    if (!confirmed) return;

    // Delete all source entries
    for (const sourceEntry of entry.sourceEntries) {
      if (sourceEntry.type === 'pomodoro') {
        await window.logAPI.deleteSession?.(sourceEntry.id);
      } else if (sourceEntry.type === 'adhoc') {
        await window.logAPI.deleteAdhocEntry(sourceEntry.id);
      }
    }
  } else {
    // Delete single entry
    if (entry.type === 'pomodoro') {
      await window.logAPI.deleteSession?.(entry.id);
    } else if (entry.type === 'adhoc') {
      await window.logAPI.deleteAdhocEntry(entry.id);
    } else if (entry.type === 'calendar') {
      await window.logAPI.dismissCalendarProposal?.(entry.id);
    }
  }

  await get().loadDay(selectedDate, true);
}
```

---

## UI/UX Principles

### Buttons and Actions
- **Always visible**: Edit and Delete buttons should never be hidden
- **Clear labels**: "Edit", "Delete", "Save", "Cancel" - no icons without text
- **Confirmation for destructive actions**: Use native `confirm()` or modal
- **Feedback**: Show success/error notifications

### Card-Based Layout
- ✅ Current implementation uses card-based layout (more responsive than tables)
- Cards should be scannable and not cramped
- All information visible without scrolling horizontally
- Actions clearly visible on the right side

---

## Testing Checklist

Before any release, verify:
- [ ] Can edit ANY entry (pomodoro, adhoc, calendar, merged, logged)
- [ ] Can delete ANY unlogged entry
- [ ] Can delete logged entries with confirmation
- [ ] Can delete merged entries (deletes all sources) with confirmation
- [ ] Edit on merged entry applies to all sources
- [ ] No hidden buttons or UI elements
- [ ] Responsive layout works on different screen sizes

---

## Commit Guidelines

When implementing features:
- ✅ **DO**: Give users full control
- ✅ **DO**: Show warnings for risky actions
- ✅ **DO**: Make all data accessible and editable
- ❌ **DON'T**: Block user actions "for safety"
- ❌ **DON'T**: Hide delete buttons
- ❌ **DON'T**: Make artificial restrictions

---

## Philosophy

**This app is a tool for a single user, not a multi-user system.**

- No role-based access control needed
- No "permissions" system needed
- User is always the admin
- Trust > Protection

The user knows their workflow best. Our job is to make the tool flexible and get out of their way.
