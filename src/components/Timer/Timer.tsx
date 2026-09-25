import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useTimerStore } from '../../stores/timerStore';
import { useIntentionsStore } from '../../stores/intentionsStore';
import { formatTime } from '../../utils/time';
import { useTaskName } from '../../hooks/useTaskName';
import TimerDayTimeline from './TimerDayTimeline';
import BoundaryConfirmDialog from './BoundaryConfirmDialog';
import TimerTaskList from '../Lists/TimerTaskList';
import DurationSegments from './DurationSegments';
import TaskPicker from './TaskPicker';
import TaskCard from './TaskCard';
import TaskCardWithPicker from './TaskCardWithPicker';
import IntentionRow from './IntentionRow';
import ContinuePreviousCTA from './ContinuePreviousCTA';
import CancelConfirmModal from './CancelConfirmModal';
import SetIntentionModal from '../shared/SetIntentionModal';
import BillableToggle from '../shared/BillableToggle';
import type { PomodoroSession, CalendarProposal, AdhocEntry, TaskCache } from '../../types';

type FocusState = 'ready-empty' | 'ready-selected' | 'running' | 'paused';

const formatTimeRange = (date: Date) =>
  `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

export default function Timer() {
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
  } = useTimerStore();

  const today = new Date().toISOString().split('T')[0];
  const { getIntentions, loadDay, addIntention, removeIntention } = useIntentionsStore();
  const intentions = getIntentions(today);

  // Local state
  const [selectedTask, setSelectedTask] = useState<TaskCache | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [recentTasks, setRecentTasks] = useState<TaskCache[]>([]);
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
  const [rightPanel, setRightPanel] = useState<'timeline' | 'tasks'>('timeline');

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

  // `/` — open picker from ready states (guard against input fields)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!focusState.startsWith('ready')) return;
      e.preventDefault();
      setPickerOpen(true);
      setTimeout(() => searchRef.current?.focus(), 0);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusState]);

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

  async function loadRecentTasks() {
    if (window.logAPI?.getCachedTasks) {
      try {
        const all = await window.logAPI.getCachedTasks();
        const sorted = [...all]
          .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
          .slice(0, 5);
        setRecentTasks(sorted);
      } catch (error) {
        console.error('Failed to load recent tasks:', error);
      }
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

  // Clock constants
  const ringSize = 320;
  const ringRadius = 146;
  const cx = ringSize / 2;
  const cy = ringSize / 2;

  // Tick marks — inward-facing, majors clearly stronger than minors
  const tickMarks = useMemo(() => {
    const outerR = ringRadius - 2;
    return Array.from({ length: 60 }).map((_, i) => {
      const angle = (i * 6 - 90) * (Math.PI / 180);
      const isHour = i % 5 === 0;
      const innerR = outerR - (isHour ? 11 : 6);
      return (
        <line
          key={i}
          x1={cx + innerR * Math.cos(angle)}
          y1={cy + innerR * Math.sin(angle)}
          x2={cx + outerR * Math.cos(angle)}
          y2={cy + outerR * Math.sin(angle)}
          stroke={isHour ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.22)'}
          strokeWidth={isHour ? 1.5 : 1}
          strokeLinecap="round"
        />
      );
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ringColor = status === 'break' ? '#34d399' : '#f59e0b';
  const glowColor = status === 'break' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(245, 158, 11, 0.15)';

  const pillLabel = focusState === 'running' ? 'Focusing' : focusState === 'paused' ? 'Paused' : 'Ready';

  const timeStr = formatTime(remainingSeconds);
  const [timeMins, timeSecs] = timeStr.split(':');

  const activeTask: { task_id: string; title: string; project_name: string | null } | null =
    isActive && currentTaskId
      ? { task_id: currentTaskId, title: resolvedTaskName || '', project_name: null }
      : null;

  return (
    <div className="flex h-full animate-fade-in">
      {/* LEFT PANEL: Focus Panel */}
      <div className="w-1/2 flex flex-col overflow-y-auto">
        <div className="max-w-[640px] min-w-0 mx-auto w-full px-10 pt-9 pb-8 flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="font-display font-semibold text-txt-primary truncate max-w-[320px]"
                style={{ fontSize: 22, letterSpacing: '-0.02em' }}
              >
                {isActive ? (kickoff === 'warmup' ? 'Kickoff' : 'Deep work') : status === 'break' ? 'Break' : 'Focus'}
              </h1>
              <p className="text-txt-muted mt-0.5 font-display" style={{ fontSize: 13 }}>
                {isActive
                  ? kickoff === 'warmup'
                    ? `Rolls into ${durationMinutes}m`
                    : `Session ${sessionCount + 1} of 8`
                  : status === 'break' ? 'Take a breather'
                  : 'Start your session'}
              </p>
            </div>
            {/* State pill */}
            <div className={`inline-flex items-center h-7 gap-2 px-3 rounded-full text-[12px] font-medium tracking-[0.02em] ${
              focusState === 'running' || focusState === 'paused'
                ? 'bg-focus/[0.18] text-focus'
                : 'bg-white/[0.06] border border-white/[0.12] text-txt-secondary'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                focusState === 'running' ? 'bg-focus led-running' :
                focusState === 'paused' ? 'bg-focus' :
                'bg-txt-muted'
              }`} />
              {pillLabel}
            </div>
          </div>

          {/* Intention row */}
          {intentions.length > 0 && status !== 'break' && (
            <IntentionRow intentions={intentions} onEdit={() => setShowIntentionModal(true)} />
          )}

          {/* Continue previous CTA */}
          {focusState.startsWith('ready') && previousSession && (
            <ContinuePreviousCTA previous={previousSession} onContinue={handleContinuePrevious} />
          )}

          {/* Clock — 320×320 layered container */}
          <div className="flex flex-col items-center">
            <div
              ref={clockRef}
              className="relative mx-auto"
              style={{
                width: ringSize,
                height: ringSize,
                '--arc-color': ringColor,
              } as React.CSSProperties}
            >
              {/* Layer 1: Ambient glow */}
              <div
                className="absolute rounded-full blur-3xl pointer-events-none animate-glow-breathe"
                style={{ inset: 20, backgroundColor: glowColor }}
              />

              {/* Layer 2: Solid primary ring — always-visible boundary */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: 0,
                  border: isActive
                    ? `1px solid ${status === 'break' ? 'oklch(0.72 0.18 160 / 0.35)' : 'oklch(0.78 0.14 70 / 0.35)'}`
                    : '1px solid oklch(1 0 0 / 0.14)',
                  boxShadow: isActive
                    ? (status === 'break'
                        ? '0 0 48px oklch(0.72 0.18 160 / 0.12)'
                        : '0 0 48px oklch(0.78 0.14 70 / 0.12)')
                    : undefined,
                }}
              />

              {/* Layer 3: Progress arc — RAF-driven via --progress CSS var */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: 0,
                  background: 'conic-gradient(from -90deg, var(--arc-color) calc(var(--progress, 0) * 360deg), transparent 0)',
                  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px) calc(100% - 0.5px), transparent calc(100% - 0.25px))',
                  mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px) calc(100% - 0.5px), transparent calc(100% - 0.25px))',
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 200ms',
                }}
              />

              {/* Layer 4: SVG tick marks */}
              <svg
                width={ringSize}
                height={ringSize}
                className="absolute inset-0 pointer-events-none"
              >
                {tickMarks}
              </svg>

              {/* Layer 5: Content — digits + session window + dots inside ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {/* +5 min capsule — running only */}
                {focusState === 'running' && (
                  <button
                    onClick={() => extendSession(5)}
                    className="text-[11px] font-medium text-txt-secondary transition-all duration-150 hover:text-txt-primary"
                    style={{
                      height: 24,
                      padding: '0 10px',
                      borderRadius: 999,
                      background: 'oklch(1 0 0 / 0.06)',
                      border: '0.5px solid oklch(1 0 0 / 0.1)',
                      marginBottom: 6,
                    }}
                  >
                    +5 min
                  </button>
                )}

                {/* Session window */}
                {isActive && sessionStartTime && estimatedEnd && (
                  <span
                    className="font-mono text-txt-muted"
                    style={{ fontSize: '11.5px', letterSpacing: '0.04em', marginBottom: 4 }}
                  >
                    {formatTimeRange(sessionStartTime)}
                    {' '}
                    <span style={{ opacity: 0.55 }}>→</span>
                    {' '}
                    {formatTimeRange(estimatedEnd)}
                  </span>
                )}

                {/* Timer digits */}
                <div
                  role="timer"
                  aria-label="Time remaining"
                  className="flex items-baseline leading-none"
                >
                  <span className="focus-timer-display">{timeMins}</span>
                  <span className={`focus-timer-display ${focusState === 'running' ? 'colon-blink' : ''}`}>:</span>
                  <span className="focus-timer-display">{timeSecs}</span>
                </div>

                {/* Session dots — inside ring, below digits */}
                <div className="flex items-center gap-1.5" style={{ marginTop: 12 }}>
                  {Array.from({ length: 8 }).map((_, i) => {
                    const isCompleted = i < sessionCount;
                    const isCurrent = i === sessionCount && focusState === 'running';
                    return (
                      <div
                        key={i}
                        className="rounded-full transition-all duration-300"
                        style={{
                          width: 4,
                          height: 4,
                          background: isCompleted || isCurrent ? '#f59e0b' : 'rgba(255,255,255,0.24)',
                          boxShadow: isCurrent ? '0 0 0 2.5px rgba(245,158,11,0.2)' : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Duration segments — ready states only */}
          {focusState.startsWith('ready') && status !== 'break' && (
            <DurationSegments value={durationMinutes} onChange={handleDurationChange} />
          )}

          {/* Task area */}
          <div>
            {focusState === 'ready-empty' && (
              <TaskPicker
                recentTasks={recentTasks}
                onSelect={handleTaskSelect}
                searchRef={searchRef}
              />
            )}
            {focusState === 'ready-selected' && selectedTask && (
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
                />
                <div className="mt-2 flex items-center justify-end">
                  <BillableToggle checked={currentBillable} onChange={setCurrentBillable} size="sm" />
                </div>
              </>
            )}
            {isActive && (
              activeTask ? (
                <TaskCard
                  task={activeTask}
                  note={intention}
                  isReadonly={true}
                />
              ) : intention ? (
                <div className="px-4 py-3 bg-focus/5 border border-focus/20 rounded-2xl">
                  <p className="text-sm text-txt-secondary">{intention}</p>
                </div>
              ) : null
            )}
          </div>

          {/* Action bar */}
          <div className="flex flex-col items-center gap-3">
            {focusState.startsWith('ready') && status !== 'break' && (
              <button
                onClick={handleStart}
                disabled={focusState === 'ready-empty'}
                className="font-display flex items-center gap-1.5 transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed"
                style={{
                  height: 40,
                  padding: '0 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 10,
                  background: '#f59e0b',
                  opacity: focusState === 'ready-empty' ? 0.4 : 1,
                  color: 'oklch(0.18 0.01 60)',
                  boxShadow: focusState === 'ready-empty'
                    ? 'none'
                    : 'inset 0 1px 0 oklch(1 0 0 / 0.25), 0 8px 20px -8px rgba(245,158,11,0.55)',
                  cursor: focusState === 'ready-empty' ? 'not-allowed' : 'pointer',
                }}
              >
                <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor">
                  <path d="M0 1.5v8l8-4-8-4z" />
                </svg>
                Begin Focus
              </button>
            )}

            {status === 'break' && (
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => skip()}
                  className="flex items-center gap-2 px-5 h-11 bg-transparent border border-focus/20
                             text-txt-muted text-sm font-display rounded-xl
                             hover:bg-focus/5 hover:text-txt-secondary transition-all duration-150"
                >
                  Skip Break
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {isActive && (
              <div className="flex justify-center gap-3">
                {focusState === 'paused' ? (
                  <button
                    onClick={() => resume()}
                    className="flex items-center justify-center gap-2 bg-focus/15 border border-focus/25
                               text-focus text-sm font-display rounded-xl
                               hover:bg-focus/20 transition-all duration-150 active:scale-[0.98]"
                    style={{ height: 44, padding: '0 18px' }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={() => pause()}
                    className="flex items-center justify-center gap-2 bg-white/[0.04] border border-white/[0.08]
                               text-txt-muted text-sm font-display rounded-xl
                               hover:bg-white/[0.08] hover:text-txt-secondary transition-all duration-150"
                    style={{ height: 44, padding: '0 18px' }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                    </svg>
                    Pause
                  </button>
                )}

                <button
                  onClick={handleFinish}
                  className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.08]
                             text-txt-muted text-sm font-display rounded-xl
                             hover:bg-white/[0.08] hover:text-txt-secondary transition-all duration-150"
                  style={{ height: 44, padding: '0 18px' }}
                >
                  Finish
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3l4 4-4 4" />
                  </svg>
                </button>

                <button
                  onClick={handleCancelClick}
                  className="flex items-center justify-center gap-1.5 bg-white/[0.04] border border-white/[0.08]
                             text-txt-muted text-sm font-display rounded-xl
                             hover:bg-red-400/[0.12] hover:text-red-400 hover:border-red-400/30 transition-all duration-150"
                  style={{ height: 44, padding: '0 18px' }}
                >
                  <span className="text-xs">✕</span>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Day Timeline or Task List */}
      <div className="w-1/2 relative overflow-hidden flex flex-col">
        <div className="px-4 pt-3 pb-1 flex justify-end">
          <div className="inline-flex rounded-xl border border-focus/30 bg-transparent p-1">
            <button
              onClick={() => setRightPanel('timeline')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                rightPanel === 'timeline'
                  ? 'bg-focus/15 text-focus border border-focus/30'
                  : 'text-txt-secondary hover:text-txt-primary hover:bg-focus/5'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setRightPanel('tasks')}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                rightPanel === 'tasks'
                  ? 'bg-focus/15 text-focus border border-focus/30'
                  : 'text-txt-secondary hover:text-txt-primary hover:bg-focus/5'
              }`}
            >
              Tasks
            </button>
          </div>
        </div>

        {rightPanel === 'timeline' ? (
          <div className="flex-1 relative overflow-hidden">
            <TimerDayTimeline sessions={sessions} calendarProposals={calendarProposals} adhocEntries={adhocEntries} onRefresh={loadSessions} />
          </div>
        ) : (
          <TimerTaskList
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
        )}
      </div>

      {/* Modals */}
      {showBoundaryDialog && (
        <BoundaryConfirmDialog
          workdayEndTime={workdayEndTime}
          onContinue={handleBoundaryContinue}
          onCancel={() => { setShowBoundaryDialog(false); setPendingTaskId(undefined); }}
          onOpenSettings={() => { setShowBoundaryDialog(false); window.location.hash = '#/settings'; }}
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
