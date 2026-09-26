import { useEffect, useState, useRef, useCallback } from 'react';
import { useTimerStore, KICKOFF_SECONDS } from '../../stores/timerStore';
import { useIntentionsStore } from '../../stores/intentionsStore';
import { useTaskName } from '../../hooks/useTaskName';
import BoundaryConfirmDialog from './BoundaryConfirmDialog';
import NowAside from './NowAside';
import DurationSegments from './DurationSegments';
import TaskPicker from './TaskPicker';
import TaskCard from './TaskCard';
import TaskCardWithPicker from './TaskCardWithPicker';
import IntentionRow from './IntentionRow';
import NowHeader, { type NowPillState } from './NowHeader';
import FocusBlock, { SectionHeader } from './FocusBlock';
import CountdownDisplay from './CountdownDisplay';
import KeyButton from './KeyButton';
import ContinuePreviousCTA from './ContinuePreviousCTA';
import CancelConfirmModal from './CancelConfirmModal';
import SetIntentionModal from '../shared/SetIntentionModal';
import BillableToggle from '../shared/BillableToggle';
import type { PomodoroSession, CalendarProposal, AdhocEntry, TaskCache, RankedTask } from '../../types';
import type { ViewId } from '../Layout/views';

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
    selectionResetToken,
  } = useTimerStore();

  const today = new Date().toISOString().split('T')[0];
  const { getIntentions, loadDay, addIntention, removeIntention } = useIntentionsStore();
  const intentions = getIntentions(today);

  // Local state
  const [selectedTask, setSelectedTask] = useState<TaskCache | null>(null);
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
  }, []);

  // Hand-off from Plan's "Start on": consume the pending selection once, exactly
  // as picking the task in the Now aside does. Left untouched while a session runs.
  useEffect(() => {
    const { pendingSelection, status: current, setPendingSelection } = useTimerStore.getState();
    if (!pendingSelection || current !== 'idle') return;
    const { taskId, title } = pendingSelection;
    window.logAPI.getCachedTask(taskId).then(task => {
      if (task) {
        setSelectedTask(task);
      } else {
        setSelectedTask({ task_id: taskId, title, project_id: 0, project_name: null, last_seen_at: new Date().toISOString() });
      }
    });
    setIntention(title);
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

  // Enter = Begin Focus, only with a task selected, nothing open and no field focused.
  const anyModalOpen = showBoundaryDialog || showIntentionModal || showCancelConfirm;
  const handleStartRef = useRef<() => void>(() => {});
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (focusState !== 'ready-selected' || status !== 'idle' || pickerOpen || anyModalOpen) return;
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

  const handleTaskSelect = useCallback((task: TaskCache) => {
    setSelectedTask(task);
    setPickerOpen(false);
  }, []);

  // Pre-fill the billable toggle from the selected task's default (list item > list > global).
  useEffect(() => {
    if (status !== 'idle') return;
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

    startFocus(taskId, currentBillable);
  };
  handleStartRef.current = handleStart;

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
    startFocus(pendingTaskId, currentBillable);
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
    : 'ready';

  const sessionWindow = sessionStartTime && estimatedEnd
    ? `${formatTimeRange(sessionStartTime)} → ${formatTimeRange(estimatedEnd)}`
    : '';
  const countdownLabel =
    isKickoff ? `KICKOFF · ROLLS INTO ${durationMinutes}M`
    : focusState === 'running' ? `FOCUS · ${sessionWindow}`
    : focusState === 'paused' ? `PAUSED · ${sessionWindow}`
    : isBreak ? `BREAK · ${sessionWindow}`
    : 'READY';

  const tone = isBreak ? 'emerald' : 'amber';
  const topRule = isBreak ? 'emerald' : focusState === 'paused' ? 'dim' : 'amber';
  const rulerMinutes = readyState ? durationMinutes : Math.max(1, Math.round(totalDuration / 60));
  // Display only: idle shows the selected duration so the digits agree with the strip and the ruler.
  // The store's remainingSeconds (and what startFocus uses) is untouched.
  const displaySeconds = readyState ? durationMinutes * 60 : remainingSeconds;

  // The picker is open whenever nothing is selected, break included: the old app let the
  // next task be picked (and its note / billable set) while the break ran.
  const showIdlePicker = focusState === 'ready-empty';
  const showBreakSelected = isBreak && focusState === 'ready-selected' && !!selectedTask;

  const activeTask: { task_id: string; title: string; project_name: string | null } | null =
    isActive && currentTaskId
      ? { task_id: currentTaskId, title: resolvedTaskName || '', project_name: null }
      : null;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <NowHeader state={pillState} />

      <div className="flex-1 min-h-0 flex">
        {/* MAIN COLUMN */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 px-7 py-5 overflow-y-auto">

          {/* Intention row — every state, editable (parity with the old app's Edit + sidebar button) */}
          <IntentionRow intentions={intentions} onEdit={() => setShowIntentionModal(true)} />

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

          <SectionHeader>01 Focus</SectionHeader>

          <FocusBlock
            topRule={topRule}
            countdown={
              <CountdownDisplay
                label={countdownLabel}
                sessionCount={sessionCount}
                sessionLabel={isBreak ? 'done' : 'next'}
                currentGlows={focusState === 'running'}
                compactCounter={isKickoff}
                remainingSeconds={displaySeconds}
                running={focusState === 'running'}
                paused={focusState === 'paused'}
                tone={tone}
                rulerMinutes={rulerMinutes}
                elapsedSeconds={isActive || isBreak ? elapsedSeconds : 0}
                active={isActive}
                rulerRef={clockRef}
              />
            }
          >
            {/* ready-empty */}
            {focusState === 'ready-empty' && !isBreak && (
              <>
                <p className="font-display text-[15px] text-txt-muted">Pick a task below</p>
                <DurationSegments value={durationMinutes} onChange={handleDurationChange} />
                <div className="flex flex-wrap gap-2">
                  <KeyButton variant="amber" kbd="↵" disabled onClick={handleStart}>Begin Focus</KeyButton>
                  <KeyButton variant="outline" onClick={handleKickoff}>Kickoff 2m</KeyButton>
                </div>
              </>
            )}

            {/* ready-selected */}
            {focusState === 'ready-selected' && selectedTask && !isBreak && (
              <>
                <TaskCardWithPicker
                  task={selectedTask}
                  note={intention}
                  recentTasks={recentTasks}
                  pickerOpen={pickerOpen}
                  onToggle={() => setPickerOpen(p => !p)}
                  onSelectTask={(t) => { setSelectedTask(t); setPickerOpen(false); }}
                  onNoteChange={setIntention}
                  searchRef={searchRef}
                  beforeNote={<DurationSegments value={durationMinutes} onChange={handleDurationChange} />}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <KeyButton variant="amber" kbd="↵" onClick={handleStart}>Begin Focus</KeyButton>
                  <KeyButton variant="outline" onClick={handleKickoff}>Kickoff 2m</KeyButton>
                  <BillableToggle checked={currentBillable} onChange={setCurrentBillable} size="sm" className="ml-auto" />
                </div>
              </>
            )}

            {/* running / paused / kickoff */}
            {isActive && (
              <>
                {activeTask ? (
                  <TaskCard task={activeTask} note={intention} isReadonly={true} />
                ) : intention ? (
                  <p className="text-[13px] text-txt-secondary border-l-2 border-drip-border pl-3">{intention}</p>
                ) : (
                  <p className="font-display text-[15px] text-txt-muted">No task attached</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {focusState === 'paused' ? (
                    <KeyButton variant="amber" onClick={() => resume()}>Resume</KeyButton>
                  ) : (
                    <KeyButton variant="outline" onClick={() => pause()}>Pause</KeyButton>
                  )}
                  <KeyButton variant="outline" onClick={handleFinish}>Finish</KeyButton>
                  <KeyButton variant="danger" onClick={handleCancelClick}>Cancel</KeyButton>
                  {focusState === 'running' && (
                    <KeyButton variant="ghost" size="sm" className="ml-auto" onClick={() => extendSession(5)}>+5 min</KeyButton>
                  )}
                </div>
              </>
            )}

            {/* break */}
            {isBreak && (
              <>
                <p className="font-display text-[15px] text-txt-muted">Take a breather</p>
                <div className="flex gap-2">
                  <KeyButton variant="outline" onClick={() => skip()}>Skip Break</KeyButton>
                </div>
              </>
            )}
          </FocusBlock>

          {/* 02 TASKS — idle picker only; once a task is selected re-selection goes through the card (Q3) */}
          {showIdlePicker && (
            <div className="flex-1 min-h-[176px] max-h-[420px] flex flex-col gap-3">
              <SectionHeader>02 Tasks</SectionHeader>
              <TaskPicker
                recentTasks={recentTasks}
                onSelect={handleTaskSelect}
                searchRef={searchRef}
              />
            </div>
          )}

          {/* 02 TASKS during a break with a task selected — the card, note and billable stay
              editable; Begin Focus / Kickoff and the duration strip wait for the break to end. */}
          {showBreakSelected && selectedTask && (
            <div className="flex flex-col gap-3" data-testid="break-selected-task">
              <SectionHeader>02 Tasks</SectionHeader>
              <TaskCardWithPicker
                task={selectedTask}
                note={intention}
                recentTasks={recentTasks}
                pickerOpen={pickerOpen}
                onToggle={() => setPickerOpen(p => !p)}
                onSelectTask={(t) => { setSelectedTask(t); setPickerOpen(false); }}
                onNoteChange={setIntention}
                searchRef={searchRef}
              />
              <div className="flex justify-end">
                <BillableToggle checked={currentBillable} onChange={setCurrentBillable} size="sm" />
              </div>
            </div>
          )}
        </div>

        <NowAside
          sessions={sessions}
          calendarProposals={calendarProposals}
          adhocEntries={adhocEntries}
          onRefresh={loadSessions}
          onNavigate={onNavigate}
          onSelectTask={(taskId, itemTitle) => {
            if (taskId) {
              window.logAPI.getCachedTask(taskId).then(task => {
                if (task) {
                  setSelectedTask(task);
                } else {
                  setSelectedTask({ task_id: taskId, title: itemTitle, project_id: 0, project_name: null, last_seen_at: new Date().toISOString() });
                }
              });
            }
            setIntention(itemTitle);
          }}
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
