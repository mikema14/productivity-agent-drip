# Phase 2.0-A: Merged Entry Interactions

## Issue: Merged Entries Not Interactive

**Problem**: After implementing auto-merge by task ID, merged entries displayed correctly but couldn't be interacted with:
- Checkbox for "Log?" couldn't be clicked
- Edit/Delete buttons were non-functional
- Clicking any action did nothing

**Root Cause**: Merged entries have virtual IDs like `merged-643749` that don't exist in the database. When handlers tried to find these IDs, they failed silently.

---

## Solution Implemented

### 1. Smart Toggle Handler (`handleToggleLogMerged`)

When user clicks the "Log?" checkbox on a merged entry:
- Detects if entry is merged by checking `entry.isMerged`
- If merged: toggles **all source entries** (the individual sessions that were merged)
- If not merged: toggles the single entry normally

**Code** (DailyLog.tsx:59-71):
```typescript
const handleToggleLogMerged = (entryId: string) => {
  const mergedEntry = mergedEntries.find(e => e.id === entryId);

  if (mergedEntry?.isMerged) {
    // Toggle all source entries
    mergedEntry.sourceEntries.forEach(sourceEntry => {
      toggleLogMark(sourceEntry.id);
    });
  } else {
    // Regular entry
    toggleLogMark(entryId);
  }
};
```

### 2. Edit Protection (`handleUpdateMerged`)

When user tries to edit a merged entry:
- Shows notification: "Cannot Edit Merged Entry - Please edit individual sessions separately"
- Prevents accidental edits to virtual merged entries
- Regular entries work normally

**Code** (DailyLog.tsx:73-87):
```typescript
const handleUpdateMerged = (entryId: string, changes: any) => {
  const mergedEntry = mergedEntries.find(e => e.id === entryId);

  if (mergedEntry?.isMerged) {
    window.timerAPI.showNotification(
      'Cannot Edit Merged Entry',
      'Please edit individual sessions separately. Merged entries are read-only.'
    );
    return;
  }

  updateEntry(entryId, changes);
};
```

### 3. Delete Protection (`handleDeleteMerged`)

When user tries to delete a merged entry:
- Shows notification: "Cannot Delete Merged Entry - Please delete individual sessions separately"
- Prevents accidental bulk deletion
- Regular entries can still be deleted

**Code** (DailyLog.tsx:89-103):
```typescript
const handleDeleteMerged = (entryId: string) => {
  const mergedEntry = mergedEntries.find(e => e.id === entryId);

  if (mergedEntry?.isMerged) {
    window.timerAPI.showNotification(
      'Cannot Delete Merged Entry',
      'Please delete individual sessions separately.'
    );
    return;
  }

  deleteEntry(entryId);
};
```

### 4. UI Indication

Updated EntryRow to show merged entries are read-only:
- Edit/Delete buttons hidden for merged entries
- Shows "Read-only merged view" text in Actions column
- Checkbox still works (toggles all sources)

**Code** (EntryRow.tsx:219-241):
```typescript
{!entry.isProposal && !entry.isMerged && (
  <>
    <button onClick={() => setIsEditing(true)}>Edit</button>
    {entry.type === 'adhoc' && (
      <button onClick={() => onDelete(entry.id)}>Delete</button>
    )}
  </>
)}
{entry.isMerged && (
  <span className="text-xs text-gray-500 italic">
    Read-only merged view
  </span>
)}
```

---

## Behavior Summary

| Action | Regular Entry | Merged Entry |
|--------|--------------|--------------|
| Check "Log?" | ✅ Marks entry for logging | ✅ Marks ALL source entries |
| Uncheck "Log?" | ✅ Unmarks entry | ✅ Unmarks ALL source entries |
| Click Edit | ✅ Opens edit mode | 🚫 Shows "read-only" message |
| Click Delete | ✅ Deletes entry | 🚫 Shows "read-only" message |
| Actions Column | Shows Edit/Delete | Shows "Read-only merged view" |

---

## Logging Behavior

When merged entries are logged:
1. User checks "Log?" on merged entry → all source entries marked
2. User clicks "Log Selected"
3. System logs each source entry individually to Easy Project
4. Purple badge remains (sessions stay separate in database)
5. All source entries marked as "✓ Logged"

**This preserves audit trail** - individual sessions remain in database for reporting/history.

---

## Files Modified

- `src/components/DailyLog/DailyLog.tsx` - Added merged entry handlers
- `src/components/DailyLog/EntryRow.tsx` - Added type support and UI indication
- `src/utils/mergeEntries.ts` - Already had `sourceEntries` array in MergedEntry interface

---

## Test Results

### ✅ Merged Entry Logging
- [x] Create 2 entries with same Task ID
- [x] Mark merged entry for logging (checkbox works)
- [x] Both source entries get marked
- [x] Click "Log Selected" → both entries logged to API
- [x] Merged row shows "✓ Logged" after success

### ✅ Edit Protection
- [x] Try to click Edit on merged entry → no edit button shown
- [x] Shows "Read-only merged view" text

### ✅ Delete Protection
- [x] No delete button on merged entries
- [x] Individual sessions can still be edited/deleted separately
