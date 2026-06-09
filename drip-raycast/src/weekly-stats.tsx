import { Detail } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  getSessionsInRange,
  getWeeklySummary,
  getCachedTask,
} from "./lib/db";

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function WeeklyStats() {
  const [markdown, setMarkdown] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const monday = getMonday(new Date());
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        const weekStart = formatDate(monday);
        const weekEnd = formatDate(sunday);

        const [summary, allSessions] = await Promise.all([
          getWeeklySummary(weekStart),
          getSessionsInRange(weekStart, weekEnd),
        ]);

        const sessions = allSessions.filter((s) => s.source !== "break");

        const totalMinutes = sessions.reduce(
          (sum, s) => sum + s.duration_minutes,
          0
        );
        const totalHours = (totalMinutes / 60).toFixed(1);
        const sessionCount = sessions.length;

        // Daily breakdown
        const dailyMap = new Map<string, number>();
        const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(d.getDate() + i);
          dailyMap.set(formatDate(d), 0);
        }
        for (const s of sessions) {
          const date = s.start_at.slice(0, 10);
          dailyMap.set(date, (dailyMap.get(date) || 0) + s.duration_minutes);
        }

        // Top tasks
        const taskMinutes = new Map<string, number>();
        for (const s of sessions) {
          if (s.task_id) {
            taskMinutes.set(
              s.task_id,
              (taskMinutes.get(s.task_id) || 0) + s.duration_minutes
            );
          }
        }
        const topTasks = [...taskMinutes.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        // Build markdown
        let md = `# Weekly Stats: ${weekStart} → ${weekEnd}\n\n`;
        md += `**Total**: ${totalHours}h | **Sessions**: ${sessionCount}`;

        if (summary) {
          md += ` | **Deep Work**: ${(summary.deep_work_minutes / 60).toFixed(1)}h`;
          md += ` | **Avg Session**: ${summary.avg_session_minutes}m`;
        }
        md += "\n\n";

        md += "## Daily Breakdown\n\n";
        md += "| Day | Date | Hours | Sessions |\n";
        md += "|-----|------|-------|----------|\n";
        let dayIndex = 0;
        for (const [date, mins] of dailyMap) {
          const daySessions = sessions.filter(
            (s) => s.start_at.slice(0, 10) === date
          ).length;
          const bar = "█".repeat(Math.round(mins / 30));
          md += `| ${dayNames[dayIndex]} | ${date} | ${(mins / 60).toFixed(1)}h ${bar} | ${daySessions} |\n`;
          dayIndex++;
        }

        if (topTasks.length > 0) {
          md += "\n## Top Tasks\n\n";
          md += "| Task | Title | Hours |\n";
          md += "|------|-------|-------|\n";
          for (const [taskId, mins] of topTasks) {
            const task = await getCachedTask(taskId);
            md += `| #${taskId} | ${task?.title || "Unknown"} | ${(mins / 60).toFixed(1)}h |\n`;
          }
        }

        setMarkdown(md);
      } catch (error) {
        setMarkdown(`# Error\n\n${String(error)}`);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return <Detail markdown={markdown} isLoading={isLoading} />;
}
