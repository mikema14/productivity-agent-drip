import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  showToast,
  Toast,
  confirmAlert,
} from "@raycast/api";
import { useState, useEffect } from "react";
import {
  getUnloggedEntries,
  getCachedTask,
  updateSessionLoggedSync,
  updateAdhocEntryLoggedSync,
} from "./lib/db";
import { postTimeEntry } from "./lib/api";
import type { UnifiedEntry } from "./lib/types";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function LogEntries() {
  const today = new Date().toISOString().slice(0, 10);
  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getUnloggedEntries(today)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function logEntry(entry: UnifiedEntry) {
    if (!entry.task_id) return;

    const task = await getCachedTask(entry.task_id);
    if (!task) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Task not in cache",
        message: `Fetch task #${entry.task_id} first via Search Tasks`,
      });
      return;
    }

    setIsLoading(true);
    try {
      const hours = Math.round((entry.duration_minutes / 60) * 100) / 100;
      const serverEntryId = await postTimeEntry({
        projectId: task.project_id,
        issueId: parseInt(entry.task_id),
        hours,
        spentOn: entry.date,
        comments: entry.comment || entry.title,
        billable: entry.billable,
      });

      if (entry.type === "session") {
        updateSessionLoggedSync(entry.id, serverEntryId);
      } else if (entry.type === "adhoc") {
        updateAdhocEntryLoggedSync(entry.id);
      }

      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      await showToast({
        style: Toast.Style.Success,
        title: "Logged",
        message: `${formatDuration(entry.duration_minutes)} → #${entry.task_id}`,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to log",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function logAll() {
    if (entries.length === 0) return;

    const confirmed = await confirmAlert({
      title: `Log ${entries.length} entries?`,
      message: `This will post ${entries.length} time entries to Easy Project.`,
    });
    if (!confirmed) return;

    setIsLoading(true);
    let success = 0;
    let failed = 0;

    for (const entry of [...entries]) {
      try {
        await logEntry(entry);
        success++;
      } catch {
        failed++;
      }
    }

    await showToast({
      style: failed > 0 ? Toast.Style.Failure : Toast.Style.Success,
      title: `Logged ${success}/${success + failed} entries`,
    });
    setIsLoading(false);
  }

  const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);

  return (
    <List
      searchBarPlaceholder="Filter unlogged entries..."
      isLoading={isLoading}
    >
      <List.Section
        title={`${entries.length} unlogged entries (${formatDuration(totalMinutes)})`}
      >
        {entries.map((entry) => (
          <List.Item
            key={entry.id}
            title={entry.title}
            subtitle={`${entry.time} · ${formatDuration(entry.duration_minutes)} · #${entry.task_id}`}
            icon={{ source: Icon.Upload, tintColor: Color.Orange }}
            actions={
              <ActionPanel>
                <Action
                  title="Log to Easy Project"
                  icon={Icon.Upload}
                  onAction={() => logEntry(entry)}
                />
                <Action
                  title="Log All Entries"
                  icon={Icon.List}
                  onAction={logAll}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {!isLoading && entries.length === 0 && (
        <List.EmptyView
          title="All caught up!"
          description="No unlogged entries with task IDs for today"
          icon={Icon.CheckCircle}
        />
      )}
    </List>
  );
}
