import { MenuBarExtra, open, Icon, launchCommand, LaunchType } from "@raycast/api";
import { getTimerState, getTodaySessions } from "./lib/db";
import { useEffect, useState } from "react";
import type { TimerStatePayload } from "./lib/types";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function computeRemainingSeconds(state: TimerStatePayload): number {
  if (state.paused || !state.startTime) {
    return state.remainingSeconds;
  }
  const elapsed = Math.floor(
    (Date.now() - new Date(state.startTime).getTime()) / 1000
  );
  return Math.max(0, state.totalDuration - elapsed);
}

export default function TimerStatus() {
  const [state, setState] = useState<TimerStatePayload | null>(null);
  const [todayTotal, setTodayTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const timerState = await getTimerState();
        setState(timerState);

        const today = new Date().toISOString().slice(0, 10);
        const sessions = await getTodaySessions(today);
        const total = sessions
          .filter((s) => s.source !== "break")
          .reduce((sum, s) => sum + s.duration_minutes, 0);
        setTodayTotal(total);
      } catch {
        // DB not available yet
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  let title: string | undefined;
  let icon: Icon = Icon.Clock;

  if (state && state.status === "focus") {
    const remaining = computeRemainingSeconds(state);
    title = state.paused ? `⏸ ${formatTime(remaining)}` : formatTime(remaining);
    icon = Icon.Hourglass;
  } else if (state && state.status === "break") {
    const remaining = computeRemainingSeconds(state);
    title = `Break ${formatTime(remaining)}`;
    icon = Icon.Mug;
  } else if (state && state.status === "idle" && state.pendingBreak) {
    title = "Session Complete";
    icon = Icon.CheckCircle;
  }

  const todayHours = Math.floor(todayTotal / 60);
  const todayMins = todayTotal % 60;

  return (
    <MenuBarExtra icon={icon} title={title} isLoading={isLoading}>
      <MenuBarExtra.Item
        title={`Today: ${todayHours}h ${todayMins}m`}
        icon={Icon.Calendar}
      />
      <MenuBarExtra.Separator />
      {state && state.status === "idle" && state.pendingBreak ? (
        <>
          <MenuBarExtra.Item
            title="Continue Focus"
            icon={Icon.Play}
            onAction={() => {
              const taskParam = state.pendingBreak?.taskId ? `?taskId=${state.pendingBreak.taskId}` : "";
              open(`drip://start-focus${taskParam}`);
            }}
          />
          <MenuBarExtra.Item
            title={`Start ${state.pendingBreak.isLong ? "Long" : "Short"} Break (${state.pendingBreak.durationMinutes}m)`}
            icon={Icon.Mug}
            onAction={() => open(`drip://start-break?duration=${state.pendingBreak!.durationMinutes}`)}
          />
          <MenuBarExtra.Item
            title="Skip Break"
            icon={Icon.Forward}
            onAction={() => open("drip://skip-break")}
          />
        </>
      ) : (!state || state.status === "idle") ? (
        <MenuBarExtra.Item
          title="Start Focus Session"
          icon={Icon.Play}
          onAction={() => launchCommand({ name: "start-focus", type: LaunchType.UserInitiated })}
        />
      ) : state.paused ? (
        <MenuBarExtra.Item
          title="Resume Timer"
          icon={Icon.Play}
          onAction={() => open("drip://resume")}
        />
      ) : (
        <MenuBarExtra.Item
          title="Pause Timer"
          icon={Icon.Pause}
          onAction={() => open("drip://pause")}
        />
      )}
      {state && state.status === "focus" && (
        <MenuBarExtra.Item
          title="Finish Early"
          icon={Icon.CheckCircle}
          onAction={() => open("drip://finish-early")}
        />
      )}
      {state && state.status !== "idle" && (
        <MenuBarExtra.Item
          title="Stop Timer"
          icon={Icon.Stop}
          onAction={() => open("drip://stop")}
        />
      )}
      <MenuBarExtra.Separator />
      <MenuBarExtra.Item
        title="Open Drip"
        icon={Icon.AppWindow}
        onAction={() => open("drip://")}
      />
    </MenuBarExtra>
  );
}
