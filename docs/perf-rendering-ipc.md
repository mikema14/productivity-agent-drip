# React Rendering & IPC Performance Patterns

Commit: `0d9023f` — 2026-03-19

---

## 1. EntryRow — `React.memo` with field comparator

**File**: `src/components/DailyLog/EntryRow.tsx`

**Problem**: Every toggle/edit triggered `loadDay()` → all entries got new object references → all 20+ `EntryRow`s re-rendered.

**Fix**: Named function + `memo` export with a custom comparator that checks only the fields the component reads. New object reference with identical values = no re-render.

```tsx
export default memo(EntryRow, (prev, next) =>
  prev.entry.id              === next.entry.id &&
  prev.entry.title           === next.entry.title &&
  prev.entry.taskId          === next.entry.taskId &&
  prev.entry.durationMinutes === next.entry.durationMinutes &&
  prev.entry.comment         === next.entry.comment &&
  prev.entry.billable        === next.entry.billable &&
  prev.entry.markedToLog     === next.entry.markedToLog &&
  prev.entry.logged          === next.entry.logged &&
  prev.entry.isProposal      === next.entry.isProposal
  // callbacks excluded — stabilised via refs in DailyLog
);
```

---

## 2. DailyLog — stable callbacks via `useRef`

**File**: `src/components/DailyLog/DailyLog.tsx`

**Problem**: Handlers close over `mergedEntries`, so `useCallback([mergedEntries])` produces a new function reference on every change — defeating memo.

**Pattern**: Ref that always holds the latest closure; stable wrapper created once.

```tsx
const handleUpdateMergedRef = useRef(handleUpdateMerged);
handleUpdateMergedRef.current = handleUpdateMerged; // sync every render

const stableUpdate = useCallback(
  (id: string, changes: any) => handleUpdateMergedRef.current(id, changes),
  [] // empty deps — ref provides staleness safety
);
```

Pass `stableUpdate` (not `handleUpdateMerged`) to `EntryRow`.

**Result**: Toggling one entry re-renders only that single row.

---

## 3. SessionHistory — parallel `Promise.all` title loading

**File**: `src/components/Timer/SessionHistory.tsx`

**Problem**: Serial `for...of await` — N sessions × ~2ms IPC = O(N) wall time.

**Fix**:

```ts
const sessionsWithTitlesTemp = await Promise.all(
  sessions.map(async (session) => {
    let taskTitle: string | undefined;
    if (session.task_id && window.logAPI) {
      try {
        const cachedTask = await window.logAPI.getCachedTask(session.task_id);
        taskTitle = cachedTask?.title;
      } catch (e) { /* non-fatal */ }
    }
    return { ...session, taskTitle };
  })
);
```

**Result**: All IPC calls fly concurrently — O(1) wall time regardless of session count.

---

## General rules derived from this work

| Situation | Pattern |
|-----------|---------|
| Child receives frequently-recreated object props | `memo` + field comparator |
| Callback closes over state that changes often | `useRef` sync + stable `useCallback([], [])` wrapper |
| Multiple independent async IPC/API calls | `Promise.all` instead of serial `await` |
| Pure function with no state closure | Move to module level (avoids recreation per render) |
