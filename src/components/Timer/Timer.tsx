import { useEffect, useState } from 'react';
import { useTimerStore } from '../../stores/timerStore';
import { formatTime } from '../../utils/time';
import TimerControls from './TimerControls';
import TimerDayTimeline from './TimerDayTimeline';
import TaskIdInput from '../shared/TaskIdInput';
import CompletionPromptModal from './CompletionPromptModal';
import DailyIntentionBanner from '../shared/DailyIntentionBanner';
import BoundaryConfirmDialog from './BoundaryConfirmDialog';
import type { PomodoroSession, CalendarProposal } from '../../types';

export default function Timer() {
  const {
    status,
    remainingSeconds,
    totalDuration,
    currentTaskId,
    sessionCount,
    intention,
    showCompletionModal,
    setIntention,
    startFocus,
    pause,
    resume,
    skip,
    reset,
    finishEarly,
    isPaused,
    continueFromModal,
    startBreakFromModal,
    extendSession
  } = useTimerStore();

  const [taskInput, setTaskInput] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [calendarProposals, setCalendarProposals] = useState<CalendarProposal[]>([]);
  const [lastSession, setLastSession] = useState<PomodoroSession | null>(null);
  const [showBoundaryDialog, setShowBoundaryDialog] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | undefined>(undefined);
  const [workdayEndTime, setWorkdayEndTime] = useState('18:00');
  const [enableBoundaryCheck, setEnableBoundaryCheck] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Track session start time for time range display
  useEffect(() => {
    if (status === 'focus') setSessionStartTime(new Date());
    if (status === 'idle') setSessionStartTime(null);
  }, [status]);

  // Load today's sessions on mount and when status changes (e.g. break completes)
  useEffect(() => {
    loadSessions();
    loadLastSession();
  }, [sessionCount, status]);

  // Cleanup timer intervals when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      console.log('Timer component unmounting - keeping intervals running');
    };
  }, []);

  // Load workday boundary settings on mount
  useEffect(() => {
    loadBoundarySettings();
  }, []);

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
        const today = new Date().toISOString().split('T')[0];
        const todaySessions = await window.timerAPI.getSessions(today);
        setSessions(todaySessions);

        // Also fetch calendar proposals
        if (window.logAPI) {
          const proposals = await window.logAPI.getCalendarProposals(today);
          setCalendarProposals(proposals);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    }
  }

  async function loadLastSession() {
    if (window.timerAPI?.getLastSessionWithTask) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const session = await window.timerAPI.getLastSessionWithTask(today);
        setLastSession(session);
      } catch (error) {
        console.error('Failed to load last session:', error);
      }
    }
  }

  const handleStart = () => {
    const taskId = taskInput.trim() || undefined;

    if (enableBoundaryCheck) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (currentTime > workdayEndTime) {
        setPendingTaskId(taskId);
        setShowBoundaryDialog(true);
        return;
      }
    }

    startFocus(taskId);
  };

  const handleBoundaryContinue = () => {
    setShowBoundaryDialog(false);
    startFocus(pendingTaskId);
    setPendingTaskId(undefined);
  };

  const handleBoundaryCancel = () => {
    setShowBoundaryDialog(false);
    setPendingTaskId(undefined);
  };

  const handleBoundaryOpenSettings = () => {
    setShowBoundaryDialog(false);
    setPendingTaskId(undefined);
    window.location.hash = '#/settings';
  };

  const handlePause = () => {
    pause();
  };

  const handleResume = () => {
    resume();
  };

  const handleSkip = () => {
    skip();
  };

  const handleCancel = () => {
    reset();
    setTaskInput('');
    setTaskTitle('');
    setIntention('');
  };

  const handleTaskSelect = (taskId: string, title: string) => {
    setTaskInput(taskId);
    setTaskTitle(title);
  };

  const handleFinishEarly = () => {
    finishEarly();
  };

  const handleContinuePrevious = () => {
    if (!lastSession) return;

    if (lastSession.task_id) {
      setTaskInput(lastSession.task_id);
    }
    if (lastSession.comment) {
      setIntention(lastSession.comment);
    }

    startFocus(lastSession.task_id || undefined);
  };

  // Progress ring calculations
  const ringSize = 280;
  const ringRadius = 130;
  const cx = ringSize / 2;
  const cy = ringSize / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const progress = totalDuration > 0 ? remainingSeconds / totalDuration : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const ringStroke =
    status === 'focus' ? '#f59e0b'
    : status === 'break' ? '#34d399'
    : '#f59e0b';

  const glowColor =
    status === 'focus' ? 'rgba(245, 158, 11, 0.25)'
    : status === 'break' ? 'rgba(52, 211, 153, 0.25)'
    : 'rgba(100, 116, 139, 0.1)';

  const statusDisplay =
    status === 'focus'
      ? 'Focusing'
      : status === 'break'
      ? 'Break'
      : 'Ready';

  const statusColor =
    status === 'focus'
      ? 'text-focus bg-focus-muted'
      : status === 'break'
      ? 'text-break bg-break-muted'
      : 'text-idle bg-glass-bg';

  // Time range display
  const formatTimeRange = (date: Date) => {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const estimatedEnd = sessionStartTime
    ? new Date(sessionStartTime.getTime() + totalDuration * 1000)
    : null;

  return (
    <div className="flex h-full animate-fade-in">
      {/* LEFT PANEL: Timer */}
      <div className="w-1/2 flex flex-col overflow-y-auto">
        <div className="max-w-lg mx-auto w-full px-6 py-4 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-display font-semibold text-txt-primary">What's your focus?</h1>
          </div>

          {/* Daily Intention Banner */}
          <DailyIntentionBanner />

          {/* Continue Previous Session Button */}
          {status === 'idle' && lastSession && (
            <div>
              <button
                onClick={handleContinuePrevious}
                className="w-full px-4 py-3 glass-button
                         text-txt-secondary rounded-xl font-display
                         flex items-center justify-center gap-2
                         hover:border-focus/20"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Continue Previous Session</span>
                {lastSession.task_id && (
                  <span className="text-focus font-mono text-sm">#{lastSession.task_id}</span>
                )}
                {lastSession.comment && (
                  <span className="text-sm text-txt-muted italic truncate max-w-xs">
                    "{lastSession.comment}"
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Timer Display Card */}
          <div className="relative py-8">
            {/* Ambient glow */}
            <div
              className="ambient-glow w-64 h-64 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-glow-breathe"
              style={{ backgroundColor: glowColor }}
            />

            <div className="text-center space-y-6 relative z-10">
              {/* Status Badge */}
              <div className="flex items-center justify-center">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${statusColor}`}>
                  {status !== 'idle' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-subtle" />
                  )}
                  <span className="uppercase tracking-wider text-xs font-medium">
                    {statusDisplay}
                    {isPaused && status !== 'idle' && ' \u2014 Paused'}
                  </span>
                </div>
              </div>

              {/* Progress Ring + Time Display */}
              <div className="relative inline-flex items-center justify-center">
                <svg width={ringSize} height={ringSize} className="transform">
                  {/* Tick marks */}
                  {Array.from({ length: 60 }).map((_, i) => {
                    const angle = (i * 6 - 90) * (Math.PI / 180);
                    const isHour = i % 5 === 0;
                    const inner = ringRadius - (isHour ? 15 : 8);
                    const outer = ringRadius - 3;
                    return (
                      <line
                        key={i}
                        x1={cx + inner * Math.cos(angle)}
                        y1={cy + inner * Math.sin(angle)}
                        x2={cx + outer * Math.cos(angle)}
                        y2={cy + outer * Math.sin(angle)}
                        stroke={isHour ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}
                        strokeWidth={isHour ? 2 : 1}
                        strokeLinecap="round"
                      />
                    );
                  })}
                  {/* Background track */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.04)"
                    strokeWidth="4"
                  />
                  {/* Foreground arc */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={ringRadius}
                    fill="none"
                    stroke={ringStroke}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="progress-ring-circle"
                    style={{ opacity: status === 'idle' ? 0.2 : 0.8 }}
                  />
                </svg>
                {/* Time digits inside ring */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-7xl font-mono font-semibold text-txt-primary timer-digit">
                    {formatTime(remainingSeconds)}
                  </div>
                  {/* Session counter dots */}
                  {sessionCount > 0 && (
                    <div className="flex items-center gap-1.5 mt-3">
                      {Array.from({ length: Math.min(sessionCount, 8) }).map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-focus/60" />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Time Range Display */}
              {status !== 'idle' && sessionStartTime && estimatedEnd && (
                <div className="flex justify-center">
                  <div className="text-sm text-txt-muted font-mono bg-glass-bg border border-glass-border rounded-full px-4 py-1 inline-block">
                    {formatTimeRange(sessionStartTime)} &rarr; {formatTimeRange(estimatedEnd)}
                  </div>
                </div>
              )}

              {/* Task ID Input (only when idle) */}
              {status === 'idle' && (
                <div className="max-w-sm mx-auto space-y-4">
                  <div>
                    <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2 text-left">
                      Task ID
                    </label>
                    <TaskIdInput
                      value={taskInput}
                      onChange={setTaskInput}
                      onTaskSelect={handleTaskSelect}
                      placeholder="e.g., 643749"
                    />
                    {taskTitle && (
                      <p className="text-sm text-txt-secondary mt-1 text-left">
                        {taskTitle}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2 text-left">
                      Intention
                    </label>
                    <input
                      value={intention}
                      onChange={e => setIntention(e.target.value)}
                      placeholder="What will you accomplish?"
                      className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl
                               text-txt-primary placeholder-txt-dim
                               focus:ring-2 focus:ring-focus/30 focus:border-focus/30 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Current Task Display (when running) */}
              {status !== 'idle' && currentTaskId && (
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-focus bg-focus-muted px-3 py-1 rounded-full text-sm">
                    #{currentTaskId}
                  </span>
                </div>
              )}

              {/* Intention Display (when running) */}
              {status !== 'idle' && intention && (
                <div className="text-sm text-txt-secondary">
                  {intention}
                </div>
              )}

              {/* Extend Session Button (when in focus) */}
              {status === 'focus' && !isPaused && (
                <div className="pt-1">
                  <button
                    onClick={() => extendSession(5)}
                    className="glass-button rounded-full text-xs text-txt-muted"
                  >
                    +5 min
                  </button>
                </div>
              )}

              {/* Timer Controls */}
              <div className="pt-4">
                <TimerControls
                  status={status}
                  isPaused={isPaused}
                  onStart={handleStart}
                  onPause={handlePause}
                  onResume={handleResume}
                  onSkip={handleSkip}
                  onCancel={handleCancel}
                  onFinishEarly={handleFinishEarly}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Day Timeline */}
      <div className="w-1/2 relative overflow-hidden">
        <TimerDayTimeline sessions={sessions} calendarProposals={calendarProposals} onRefresh={loadSessions} />
      </div>

      {/* Completion Prompt Modal */}
      {showCompletionModal && (
        <CompletionPromptModal
          onContinue={continueFromModal}
          onBreak={startBreakFromModal}
          taskId={currentTaskId}
          intention={intention}
        />
      )}

      {/* Workday Boundary Confirm Dialog */}
      {showBoundaryDialog && (
        <BoundaryConfirmDialog
          workdayEndTime={workdayEndTime}
          onContinue={handleBoundaryContinue}
          onCancel={handleBoundaryCancel}
          onOpenSettings={handleBoundaryOpenSettings}
        />
      )}
    </div>
  );
}
