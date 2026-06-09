import {
  List,
  Icon,
  Color,
  ActionPanel,
  Action,
  open,
} from "@raycast/api";
import { getUnifiedEntries, getCachedTask } from "./lib/db";
import { useEffect, useState } from "react";
import type { UnifiedEntry } from "./lib/types";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function entryIcon(entry: UnifiedEntry): { source: Icon; tintColor?: Color } {
  if (entry.logged) return { source: Icon.CheckCircle, tintColor: Color.Green };
  if (entry.type === "session") return { source: Icon.Hourglass, tintColor: Color.Blue };
  if (entry.type === "calendar") return { source: Icon.Calendar, tintColor: Color.Purple };
  return { source: Icon.Document, tintColor: Color.Orange };
}

export default function TodaysLog() {
  const today = new Date().toISOString().slice(0, 10);
  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getUnifiedEntries(today)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const loggedMinutes = entries
    .filter((e) => e.logged)
    .reduce((sum, e) => sum + e.duration_minutes, 0);

  return (
    <List
      searchBarPlaceholder="Filter entries..."
      isLoading={isLoading}
      navigationTitle={`Today: ${formatDuration(totalMinutes)} total | ${formatDuration(loggedMinutes)} logged`}
    >
      <List.Section
        title={`Today: ${formatDuration(totalMinutes)} total | ${formatDuration(loggedMinutes)} logged`}
      >
        {entries.map((entry) => {
          const subtitle = [
            entry.time,
            formatDuration(entry.duration_minutes),
            entry.task_id ? `#${entry.task_id}` : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <List.Item
              key={entry.id}
              title={entry.title}
              subtitle={subtitle}
              icon={entryIcon(entry)}
              accessories={[
                entry.logged
                  ? { tag: { value: "Logged", color: Color.Green } }
                  : { tag: { value: entry.type, color: Color.SecondaryText } },
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title="Open in Drip"
                    onAction={() => open("drip://")}
                    icon={Icon.AppWindow}
                  />
                  {entry.task_id && (
                    <Action.CopyToClipboard
                      title="Copy Task ID"
                      content={entry.task_id}
                    />
                  )}
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
      {!isLoading && entries.length === 0 && (
        <List.EmptyView
          title="No entries today"
          description="Start a focus session or add a manual entry"
          icon={Icon.Clock}
        />
      )}
    </List>
  );
}
