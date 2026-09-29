import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useTimerStore, KICKOFF_SECONDS } from '../../stores/timerStore';
import { useIntentionsStore } from '../../stores/intentionsStore';
import { useListsStore } from '../../stores/listsStore';
import { plannedRows } from '../Plan/boardLogic';
import type { PickerTask } from '../../hooks/useTaskPickerNav';
import { useTaskName } from '../../hooks/useTaskName';
import BoundaryConfirmDialog from './BoundaryConfirmDialog';
import NowAside from './NowAside';
import DurationSegments from './DurationSegments';
import TaskPicker from './TaskPicker';
import TaskCardWithPicker from './TaskCardWithPicker';
import ActiveFocus from './ActiveFocus';
import { focusReadouts } from './nowLogic';
import IntentionRow from './IntentionRow';
import NowHeader, { type NowPillState } from './NowHeader';
import { useNudgePause } from '../../hooks/useNudgePause';
import FocusBlock, { SectionHeader } from './FocusBlock';
import CountdownDisplay from './CountdownDisplay';
import KeyButton from './KeyButton';
import ContinuePreviousCTA from './ContinuePreviousCTA';
import CancelConfirmModal from './CancelConfirmModal';
import SetIntentionModal from '../shared/SetIntentionModal';
import BillableToggle from '../shared/BillableToggle';
import type { PomodoroSession, CalendarProposal, AdhocEntry, TaskCache, RankedTask } from '../../types';
import type { ViewId } from '../Layout/views';
import { getCurrentDate } from '../../utils/time';

type FocusState = 'ready-empty' | 'ready-selected' | 'running' | 'paused';

/** How many ranked recent tasks the picker lists (it scrolls past ~5). */
const RECENT_TASKS_LIMIT = 20;

const formatTimeRange = (date: Date) =>
  `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

interface TimerProps {
  onNavigate: (view: ViewId) => void;
}

export default function Timer({ onNavigate }: TimerProps) {
  const {
    status,
    remainingSeconds,
    totalDuration,
    currentTaskId,
    sessionCount,
    intention,
    setIntention,
    startFocus,
    pause,
    resume,
    skip,
    reset,
    finishEarly,
    isPaused,
    extendSession,
    durationMinutes,
    setDurationMinutes,
    sessionStartTime,
    currentBillable,
    setCurrentBillable,
    kickoff,
    startKickoff,
    startFocusFromBreak,
    startBreakFromModal,
    pendingBreakMinutes,
    selectionResetToken,
  } = useTimerStore();

  const today = getCurrentDate(); // local calendar day, like Review
  const { getIntentions, loadDay, addIntention, removeIntention } = useIntentionsStore();
  const intentions = getIntentions(today);

  // Plan's Today / This week, for the picker's Planned switch (the store is shared with Plan).
  const planLists = useListsStore(s => s.lists);
  const planItems = useListsStore(s => s.items);
  const plannedTasks: PickerTask[] = useMemo(
    () => plannedRows(planItems, planLists).map(r => ({
      task_id: r.taskId ?? '',
      title: r.title,
      project_id: 0,
      project_name: null,
      last_seen_at: '',
      planned: { itemId: r.itemId, column: r.column, listName: r.listName, listColor: r.listColor },
    })),
    [planItems, planLists]
  );

  // Local state
  const [selectedTask, setSelectedTask] = useState<TaskCache | null>(null);
  const nudgePause = useNudgePause();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recentTasks, setRecentTasks] = useState<RankedTask[]>([]);
  const [previousSession, setPreviousSession] = useState<PomodoroSession | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showIntentionModal, setShowIntentionModal] = useState(false);

  // Right panel state
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [calendarProposals, setCalendarProposals] = useState<CalendarProposal[]>([]);
  const [adhocEntries, setAdhocEntries] = useState<AdhocEntry[]>([]);
  const [showBoundaryDialog, setShowBoundaryDialog] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | undefined>(undefined);
  const [workdayEndTime, setWorkdayEndTime] = useState('18:00');
  const [enableBoundaryCheck, setEnableBoundaryCheck] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);

  // Resolve task title for running state
  const resolvedTaskName = useTaskName(status !== 'idle' ? currentTaskId : null);

  // FocusState derived from store
  const focusState: FocusState =
    status === 'focus' && !isPaused ? 'running' :
    status === 'focus' && isPaused ? 'paused' :
    selectedTask ? 'ready-selected' : 'ready-empty';

  const elapsedSeconds = totalDuration - remainingSeconds;
  const isActive = focusState === 'running' || focusState === 'paused';

  const estimatedEnd = sessionStartTime
    ? new Date(sessionStartTime.getTime() + totalDuration * 1000)
    : null;

  useEffect(() => {
    loadSessions();
    loadPreviousSession();
    loadRecentTasks();
  }, [sessionCount, status]);

  useEffect(() => {
    loadDay(today);
    loadBoundarySettings();
    const lists = useListsStore.getState();
    if (lists.lists.length === 0) void lists.loadLists();
    if (lists.items.length === 0) void lists.loadItems();
  }, []);

  /**
   * A planned task (Plan hand-off, the Day aside, the Planned picker): select its
   * task (cached, else a stub) and take the item title as the session note.
   */
  const selectPlanned = useCallback((taskId: string | null, title: string) => {
    if (taskId) {
      window.logAPI.getCachedTask(taskId).then(task => {
        setSelectedTask(task ?? { task_id: taskId, title, project_id: 0, project_name: null, last_seen_at: new Date().toISOString() });
      });
    }
    setIntention(title);
  }, [setIntention]);

  // Hand-off from Plan's "Start on": consume the pending selection once, exactly
  // as picking the task in the Now aside does. Left untouched while a session runs.
  useEffect(() => {
    const { pendingSelection, status: current, setPendingSelection } = useTimerStore.getState();
    if (!pendingSelection || current !== 'idle') return;
    selectPlanned(pendingSelection.taskId, pendingSelection.title);
    setPendingSelection(null);
  }, []);

  // Another surface asked for the selection to go (the kickoff takeover's Stop / Finish,
  // which mirror Now's Cancel / Finish). Skip the mount run so a pendingSelection survives.
  const seenResetToken = useRef(selectionResetToken);
  useEffect(() => {
    if (seenResetToken.current === selectionResetToken) return;
    seenResetToken.current = selectionResetToken;
    setSelectedTask(null);
    setPickerOpen(false);
  }, [selectionResetToken]);

  // `/` — focus the task search from ready states, break included (guard against input fields).
  // Only the selected-task card has a collapsed picker to open; the idle picker is always open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!focusState.startsWith('ready')) return;
      e.preventDefault();
      if (focusState === 'ready-selected') setPickerOpen(true);
      setTimeout(() => searchRef.current?.focus(), 0);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusState]);

  // Enter = Begin Focus (ready or break), only with a task selected, nothing open and no field focused.
  const anyModalOpen = showBoundaryDialog || showIntentionModal || showCancelConfirm;
  const handleStartRef = useRef<() => void>(() => {});
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (focusState !== 'ready-selected' || status === 'focus' || pickerOpen || anyModalOpen) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      e.preventDefault();
      handleStartRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusState, status, pickerOpen, anyModalOpen]);

  // RAF-driven progress arc — writes --progress onto clockRef
  useEffect(() => {
    if (!isActive || isPaused || !sessionStartTime) return;
    let raf = 0;
    const step = () => {
      const elapsedSec = (Date.now() - sessionStartTime.getTime()) / 1000;
      const frac = Math.min(1, Math.max(0, elapsedSec / totalDuration));
      clockRef.current?.style.setProperty('--progress', String(frac));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isActive, isPaused, sessionStartTime, totalDuration]);

  // Reset arc to 0 when idle
  useEffect(() => {
    if (!isActive) clockRef.current?.style.setProperty('--progress', '0');
  }, [isActive]);

  async function loadBoundarySettings() {
    if (window.timerAPI) {
      try {
        const endTime = await window.timerAPI.getSettings('workdayEndTime');
        const boundaryCheck = await window.timerAPI.getSettings('enableBoundaryCheck');
        if (endTime) setWorkdayEndTime(endTime);
        if (boundaryCheck) setEnableBoundaryCheck(boundaryCheck === 'true');
      } catch (error) {
        console.error('Failed to load boundary settings:', error);
      }
    }
  }

  async function loadSessions() {
    if (window.timerAPI) {
      try {
        const todaySessions = await window.timerAPI.getSessions(today);
        setSessions(todaySessions);
        if (window.logAPI) {
          const proposals = await window.logAPI.getCalendarProposals(today);
          setCalendarProposals(proposals);
          const adhoc = await window.logAPI.getAdhocEntries(today);
          setAdhocEntries(adhoc);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    }
  }

  async function loadPreviousSession() {
    if (window.timerAPI?.getLastSessionWithTask) {
      try {
        const session = await window.timerAPI.getLastSessionWithTask(today);
        setPreviousSession(session);
      } catch (error) {
        console.error('Failed to load previous session:', error);
      }
    }
  }

  // Re-run on sessionCount/status changes (see the effect above), so a completed
  // session refreshes both the ranking and today's per-task minutes.
  async function loadRecentTasks() {
    if (!window.logAPI?.getRankedRecentTasks) return;
    try {
      setRecentTasks(await window.logAPI.getRankedRecentTasks(RECENT_TASKS_LIMIT, today));
    } catch (error) {
      console.error('Failed to load recent tasks:', error);
    }
  }

  const handleTaskSelect = useCallback((task: PickerTask) => {
    if (task.planned) {
      selectPlanned(task.task_id || null, task.title);
      // No task to log to: keep the picker open so one can be chosen.
      if (task.task_id) setPickerOpen(false);
      return;
    }
    setSelectedTask(task);
    setPickerOpen(false);
  }, [selectPlanned]);

  // Pre-fill the billable toggle from the selected task's default (list item > list > global).
  useEffect(() => {
    if (status === 'focus') return;
    let cancelled = false;
    window.listsAPI?.getBillableForTask?.(selectedTask?.task_id || null)
      .then((b) => { if (!cancelled) setCurrentBillable(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedTask?.task_id, status, setCurrentBillable]);

  const handleStart = () => {
    const taskId = selectedTask?.task_id;

    if (enableBoundaryCheck) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime > workdayEndTime) {
        setPendingTaskId(taskId);
        setShowBoundaryDialog(true);
        return;
      }
    }

    beginFocus(taskId);
  };
  handleStartRef.current = handleStart;

  // During a break the break so far is saved first; Continue previous keeps Q6 (no row).
  const beginFocus = (taskId: string | undefined) =>
    status === 'break' ? startFocusFromBreak(taskId, currentBillable) : startFocus(taskId, currentBillable);

  // Q2: the selected task wins; otherwise the store resolves one. No boundary check.
  const handleKickoff = () => {
    if (selectedTask) {
      startFocus(selectedTask.task_id, currentBillable, false, KICKOFF_SECONDS);
    } else {
      startKickoff(KICKOFF_SECONDS);
    }
  };

  const handleContinuePrevious = async () => {
    if (!previousSession) return;
    if (previousSession.comment) setIntention(previousSession.comment);

    if (enableBoundaryCheck) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (currentTime > workdayEndTime) {
        setPendingTaskId(previousSession.task_id || undefined);
        setShowBoundaryDialog(true);
        return;
      }
    }

    await startFocus(previousSession.task_id || undefined);
  };

  const handleBoundaryContinue = () => {
    setShowBoundaryDialog(false);
    beginFocus(pendingTaskId);
    setPendingTaskId(undefined);
  };

  const handleCancelClick = () => {
    if (elapsedSeconds > 300) {
      setShowCancelConfirm(true);
    } else {
      doCancel();
    }
  };

  const doCancel = () => {
    setShowCancelConfirm(false);
    reset();
    setIntention('');
    setSelectedTask(null);
  };

  const handleFinish = () => {
    finishEarly();
    setSelectedTask(null);
  };

  const handleDurationChange = (minutes: number) => {
    setDurationMinutes(minutes);
  };

  const isBreak = status === 'break';
  const isKickoff = isActive && kickoff === 'warmup';
  const readyState = focusState.startsWith('ready') && !isBreak;

  const pillState: NowPillState =
    isKickoff ? 'kickoff'
    : focusState === 'running' ? 'focusing'
    : focusState === 'paused' ? 'paused'
    : isBreak ? 'break'
    : pendingBreakMinutes !== null ? 'break-due'
    : 'ready';

  // Split-layout label (ready / break). Running, paused and kickoff render the calm
  // single-column ActiveFocus, whose header carries the state word and ENDS hh:mm.
  const sessionWindow = sessionStartTime && estimatedEnd
    ? `${formatTimeRange(sessionStartTime)} → ${formatTimeRange(estimatedEnd)}`
    : '';
  // A focus just finished and no break has started: Now prompts for it (the card may be on another screen).
  const breakDue = !isBreak && pendingBreakMinutes !== null;
  const countdownLabel = isBreak ? (isPaused ? 'BREAK · PAUSED' : `BREAK · ${sessionWindow}`) : breakDue ? 'SESSION DONE' : 'READY';
  const endsAt = estimatedEnd ? formatTimeRange(estimatedEnd) : null;

  const tone = isBreak ? 'emerald' : 'amber';
  const topRule = isBreak ? 'emerald' : focusState === 'paused' ? 'dim' : 'amber';
  const rulerMinutes = readyState ? durationMinutes : Math.max(1, Math.round(totalDuration / 60));
  // Display only: idle shows the selected duration so the digits agree with the strip and the ruler.
  // The store's remainingSeconds (and what startFocus uses) is untouched.
  const displaySeconds = readyState ? durationMinutes * 60 : remainingSeconds;

  // The picker is open whenever nothing is selected, break included: the old app let the
  // next task be picked (and its note / billable set) while the break ran.
  const showIdlePicker = focusState === 'ready-empty';

  // Next to Begin Focus: Kickoff when ready, Skip Break during a break.
  // Next to Begin Focus. Break: Skip / Pause. Ready: Kickoff, plus the break a finished focus
  // earned (mirrors the overlay card's Start break, for when that card is on another screen).
  // Break: Skip / Pause next to Begin Focus. Break due: Start break is the primary key.
  const breakKey = breakDue && (
    <KeyButton variant="amber" onClick={() => startBreakFromModal()}>Start break {pendingBreakMinutes}m</KeyButton>
  );
  const secondaryKey = isBreak ? (
    <>
      <KeyButton variant="outline" onClick={() => skip()}>Skip Break</KeyButton>
      <KeyButton variant="ghost" onClick={() => (isPaused ? resume() : pause())}>{isPaused ? 'Resume' : 'Pause'}</KeyButton>
    </>
  ) : (
    <KeyButton variant="outline" onClick={handleKickoff}>Kickoff 2m</KeyButton>
  );
  const beginVariant = breakDue ? 'outline' : 'amber';

  const readouts = useMemo(
    () => focusReadouts(sessions, currentTaskId, elapsedSeconds),
    [sessions, currentTaskId, elapsedSeconds]
  );

  const activeTask: { task_id: string; title: string } | null =
    isActive && currentTaskId
      ? { task_id: currentTaskId, title: resolvedTaskName || '' }
      : null;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <NowHeader state={pillState} nudgePausedUntil={nudgePause.pausedUntil} onResumeNudges={nudgePause.resume} />

      <div className="flex-1 min-h-0 flex">
        {/* MAIN COLUMN */}
        <div className={`flex-1 min-w-0 flex flex-col overflow-y-auto ${isActive ? 'gap-6 px-7 pt-6 pb-7' : 'gap-4 px-7 py-5'}`}>

          {/* Intention row — ready and break, editable (parity with the old app's Edit + sidebar button).
              The running card has no room for it (Q16); its INTENT line is the session note. */}
          {!isActive && <IntentionRow intentions={intentions} onEdit={() => setShowIntentionModal(true)} />}

          {/* Continue previous — the 44px slot is reserved in idle ready states so it never pops in.
              During a break the CTA still shows when a previous session exists (Q6), but no empty
              slot is reserved, so the focus block does not drop ~60px when a break starts. */}
          {(readyState || (isBreak && previousSession)) && (
            <div className="h-[44px] shrink-0" data-testid="continue-slot">
              {previousSession && (
                <ContinuePreviousCTA previous={previousSession} onContinue={handleContinuePrevious} />
              )}
            </div>
          )}

          {!isActive && <SectionHeader>01 Focus</SectionHeader>}

          {/* running / paused / kickoff — the calm single-column block */}
          {isActive && (
            <FocusBlock topRule={topRule}>
              <ActiveFocus
                state={isKickoff ? 'kickoff' : focusState === 'paused' ? 'paused' : 'running'}
                task={activeTask}
                note={intention}
                onNoteChange={setIntention}
                endsAt={endsAt}
                rollsIntoMinutes={isKickoff ? durationMinutes : undefined}
                remainingSeconds={displaySeconds}
                rulerMinutes={rulerMinutes}
                elapsedSeconds={elapsedSeconds}
                rulerRef={clockRef}
                readouts={readouts}
                onPause={() => pause()}
                onResume={() => resume()}
                onFinish={handleFinish}
                onCancel={handleCancelClick}
                onExtend={() => extendSession(5)}
              />
            </FocusBlock>
          )}

          {/* ready / break — countdown column + context column */}
          {!isActive && (
            <FocusBlock
              topRule={topRule}
              countdown={
                <CountdownDisplay
                  label={countdownLabel}
                  sessionCount={sessionCount}
                  sessionLabel={isBreak ? 'done' : 'next'}
                  remainingSeconds={displaySeconds}
                  tone={tone}
                  rulerMinutes={rulerMinutes}
                  elapsedSeconds={isBreak ? elapsedSeconds : 0}
                  rulerRef={clockRef}
                />
              }
            >
              {/* ready-empty (break too: the next task can be picked and started mid-break) */}
              {focusState === 'ready-empty' && (
                <>
                  <p className="font-display text-[15px] text-txt-muted">
                    {isBreak ? 'Take a breather, or pick the next task below'
                      : breakDue ? `Session done. Take a ${pendingBreakMinutes}-minute break, or pick the next task below`
                      : 'Pick a task below'}
                  </p>
                  <DurationSegments value={durationMinutes} onChange={handleDurationChange} />
                  <div className="flex flex-wrap gap-2">
                    {breakKey}
                    <KeyButton variant={beginVariant} kbd="↵" disabled title="Pick a task first" onClick={handleStart}>Begin Focus</KeyButton>
                    {secondaryKey}
                  </div>
                </>
              )}

              {/* ready-selected */}
              {focusState === 'ready-selected' && selectedTask && (
                <>
                  <TaskCardWithPicker
                    task={selectedTask}
                    note={intention}
                    recentTasks={recentTasks}
                    pickerOpen={pickerOpen}
                    onToggle={() => setPickerOpen(p => !p)}
                    plannedTasks={plannedTasks}
                    onSelectTask={handleTaskSelect}
                    onNoteChange={setIntention}
                    searchRef={searchRef}
                    beforeNote={<DurationSegments value={durationMinutes} onChange={handleDurationChange} />}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {breakKey}
                    <KeyButton variant={beginVariant} kbd="↵" onClick={handleStart}>Begin Focus</KeyButton>
                    {secondaryKey}
                    <BillableToggle checked={currentBillable} onChange={setCurrentBillable} size="sm" className="ml-auto" />
                  </div>
                </>
              )}

            </FocusBlock>
          )}

          {/* 02 TASKS — idle picker only; once a task is selected re-selection goes through the card (Q3) */}
          {showIdlePicker && (
            <div className="flex-1 min-h-[176px] max-h-[420px] flex flex-col gap-3">
              <SectionHeader>02 Tasks</SectionHeader>
              <TaskPicker
                recentTasks={recentTasks}
                plannedTasks={plannedTasks}
                onSelect={handleTaskSelect}
                searchRef={searchRef}
              />
            </div>
          )}

        </div>

        <NowAside
          sessions={sessions}
          calendarProposals={calendarProposals}
          adhocEntries={adhocEntries}
          onRefresh={loadSessions}
          onNavigate={onNavigate}
          onSelectTask={selectPlanned}
        />
      </div>

      {/* Modals */}
      {showBoundaryDialog && (
        <BoundaryConfirmDialog
          workdayEndTime={workdayEndTime}
          onContinue={handleBoundaryContinue}
          onCancel={() => { setShowBoundaryDialog(false); setPendingTaskId(undefined); }}
          onOpenSettings={() => { setShowBoundaryDialog(false); setPendingTaskId(undefined); onNavigate('settings'); }}
        />
      )}

      {showCancelConfirm && (
        <CancelConfirmModal
          elapsedSeconds={elapsedSeconds}
          onKeep={() => setShowCancelConfirm(false)}
          onCancel={doCancel}
        />
      )}

      {showIntentionModal && (
        <SetIntentionModal
          intentions={intentions}
          onAdd={(text) => addIntention(today, text)}
          onRemove={(i) => removeIntention(today, i)}
          onClose={() => setShowIntentionModal(false)}
        />
      )}
    </div>
  );
}
