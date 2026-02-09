import { useEffect, useState } from 'react';
import { useTimerStore, cleanupTimerIntervals } from '../../stores/timerStore';
import { formatTime } from '../../utils/time';
import TimerControls from './TimerControls';
import SessionHistory from './SessionHistory';
import TaskIdInput from '../shared/TaskIdInput';
import CompletionPromptModal from './CompletionPromptModal';
import DailyIntentionBanner from '../shared/DailyIntentionBanner';
import BoundaryConfirmDialog from './BoundaryConfirmDialog';
import type { PomodoroSession } from '../../types';

export default function Timer() {
  const {
    status,
    remainingSeconds,
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
  const [sessions, setSessions] = useState([]);
  const [lastSession, setLastSession] = useState<PomodoroSession | null>(null);
  const [showBoundaryDialog, setShowBoundaryDialog] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | undefined>(undefined);
  const [workdayEndTime, setWorkdayEndTime] = useState('18:00');
  const [enableBoundaryCheck, setEnableBoundaryCheck] = useState(false);

  // Load today's sessions on mount
  useEffect(() => {
    loadSessions();
    loadLastSession();
  }, [sessionCount]); // Reload when session count changes

  // Cleanup timer intervals when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      console.log('Timer component unmounting - keeping intervals running');
      // NOTE: We intentionally DON'T cleanup here because:
      // - Timer should continue running when user navigates to other views
      // - Cleanup only happens on app close (in App.tsx)
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

    // Check workday boundary if enabled
    if (enableBoundaryCheck) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (currentTime > workdayEndTime) {
        // Show confirmation dialog
        setPendingTaskId(taskId);
        setShowBoundaryDialog(true);
        return;
      }
    }

    // Start focus directly if no boundary check needed
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
    // Navigate to settings - we'll use the app's navigation
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

    // Pre-fill fields
    if (lastSession.task_id) {
      setTaskInput(lastSession.task_id);
    }
    if (lastSession.comment) {
      setIntention(lastSession.comment);
    }

    // Immediately start focus
    startFocus(lastSession.task_id || undefined);
  };

  // Determine status display
  const statusDisplay =
    status === 'focus'
      ? 'Focus Session'
      : status === 'break'
      ? 'Break Time'
      : 'Ready to Focus';

  const statusColor =
    status === 'focus'
      ? 'text-focus'
      : status === 'break'
      ? 'text-break'
      : 'text-gray-600';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Pomodoro Timer</h1>
        <p className="text-gray-600 mt-2">
          Stay focused with 25-minute work sessions
        </p>
      </div>

      {/* Daily Intention Banner */}
      <DailyIntentionBanner />

      {/* Continue Previous Session Button */}
      {status === 'idle' && lastSession && (
        <div className="mb-4">
          <button
            onClick={handleContinuePrevious}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600
                     text-white rounded-lg font-medium shadow-sm hover:shadow-md
                     hover:from-blue-600 hover:to-blue-700 transition-all
                     flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Continue Previous Session</span>
            {lastSession.task_id && (
              <span className="font-mono text-sm opacity-90">#{lastSession.task_id}</span>
            )}
            {lastSession.comment && (
              <span className="text-sm opacity-90 italic truncate max-w-xs">
                "{lastSession.comment}"
              </span>
            )}
          </button>
        </div>
      )}

      {/* Timer Display */}
      <div className="bg-white rounded-2xl shadow-lg p-12">
        <div className="text-center space-y-6">
          {/* Status */}
          <div className={`text-lg font-medium ${statusColor}`}>
            {statusDisplay}
            {isPaused && status !== 'idle' && ' (Paused)'}
          </div>

          {/* Time Display */}
          <div className="text-8xl font-bold text-gray-900 font-mono">
            {formatTime(remainingSeconds)}
          </div>

          {/* Session Counter */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>Sessions completed today:</span>
            <span className="font-bold text-lg text-gray-900">
              {sessionCount}
            </span>
          </div>

          {/* Task ID Input (only when idle) */}
          {status === 'idle' && (
            <div className="max-w-md mx-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                Task ID (optional)
              </label>
              <TaskIdInput
                value={taskInput}
                onChange={setTaskInput}
                onTaskSelect={handleTaskSelect}
                placeholder="e.g., 643749"
              />
              {taskTitle && (
                <p className="text-sm text-gray-600 mt-1 text-left">
                  Selected: {taskTitle}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2 text-left">
                Link this session to an Easy Project task
              </p>

              {/* Intention Input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                  Intention (optional)
                </label>
                <input
                  value={intention}
                  onChange={e => setIntention(e.target.value)}
                  placeholder="What will you accomplish?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1 text-left">
                  Describe what you'll work on during this session
                </p>
              </div>
            </div>
          )}

          {/* Current Task Display (when running) */}
          {status !== 'idle' && currentTaskId && (
            <div className="text-sm text-gray-600">
              Task: <span className="font-mono font-bold">{currentTaskId}</span>
            </div>
          )}

          {/* Intention Display (when running) */}
          {status !== 'idle' && intention && (
            <div className="text-sm text-gray-600 mt-2">
              Working on: <span className="font-medium">{intention}</span>
            </div>
          )}

          {/* Extend Session Button (when in focus) */}
          {status === 'focus' && !isPaused && (
            <div className="pt-2">
              <button
                onClick={() => extendSession(5)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
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

      {/* Session History */}
      <SessionHistory sessions={sessions} />

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
