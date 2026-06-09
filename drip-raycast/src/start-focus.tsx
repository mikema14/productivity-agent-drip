import {
  Form,
  ActionPanel,
  Action,
  showHUD,
  open,
  popToRoot,
} from "@raycast/api";
import { getRecentTasks, getActiveListItems } from "./lib/db";
import { useEffect, useState, useMemo } from "react";
import type { TaskCache, DripListItem } from "./lib/types";
import {
  deduplicateListItems,
  collectSubtasksForTaskId,
  effectiveTaskId,
} from "./lib/dedup";

export default function StartFocus() {
  const [tasks, setTasks] = useState<TaskCache[]>([]);
  const [allListItems, setAllListItems] = useState<DripListItem[]>([]);
  const [selectedTaskValue, setSelectedTaskValue] = useState("");

  useEffect(() => {
    getRecentTasks(20).then(setTasks).catch(() => {});
    getActiveListItems().then(setAllListItems).catch(() => {});
  }, []);

  const dedupedListItems = useMemo(
    () => deduplicateListItems(tasks, allListItems),
    [tasks, allListItems]
  );

  const subtasksForSelected = useMemo(() => {
    if (!selectedTaskValue) return [];

    let taskId: string | null = null;
    if (selectedTaskValue.startsWith("li:")) {
      const parts = selectedTaskValue.split(":");
      taskId = parts[2] || null;
    } else {
      taskId = selectedTaskValue;
    }

    if (!taskId) return [];
    return collectSubtasksForTaskId(taskId, allListItems).filter(
      (s) => !s.subtask.completed
    );
  }, [selectedTaskValue, allListItems]);

  async function handleSubmit(values: {
    taskId: string;
    subtaskId?: string;
    intention: string;
  }) {
    const params = new URLSearchParams();

    if (values.taskId.startsWith("li:")) {
      const parts = values.taskId.split(":");
      const liTaskId = parts[2] || "";
      if (liTaskId) params.set("taskId", liTaskId);
      if (values.intention) {
        params.set("intention", values.intention);
      } else if (values.subtaskId) {
        const match = subtasksForSelected.find(
          (s) => s.subtask.id === values.subtaskId
        );
        if (match) params.set("intention", match.subtask.title);
      } else {
        const item = allListItems.find((li) => li.id === parts[1]);
        if (item) params.set("intention", item.title);
      }
    } else {
      if (values.taskId) params.set("taskId", values.taskId);
      if (values.intention) {
        params.set("intention", values.intention);
      } else if (values.subtaskId) {
        const match = subtasksForSelected.find(
          (s) => s.subtask.id === values.subtaskId
        );
        if (match) params.set("intention", match.subtask.title);
      }
    }

    const url = `drip://start-focus${params.toString() ? "?" + params.toString() : ""}`;
    await open(url);
    await showHUD("Focus session started");
    popToRoot();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Start Focus" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="taskId"
        title="Task"
        defaultValue=""
        onChange={setSelectedTaskValue}
      >
        <Form.Dropdown.Item value="" title="No task" />
        {tasks.map((t) => (
          <Form.Dropdown.Item
            key={t.task_id}
            value={t.task_id}
            title={`#${t.task_id} — ${t.title}`}
          />
        ))}
        {dedupedListItems.length > 0 && (
          <Form.Dropdown.Section title="List Items">
            {dedupedListItems.map((li) => {
              const eid = effectiveTaskId(li);
              const taskSuffix = eid ? ` (#${eid})` : "";
              const value = `li:${li.id}:${eid || ""}`;
              return (
                <Form.Dropdown.Item
                  key={li.id}
                  value={value}
                  title={`[${li.list_name}] ${li.title}${taskSuffix}`}
                />
              );
            })}
          </Form.Dropdown.Section>
        )}
      </Form.Dropdown>
      <Form.Dropdown id="subtaskId" title="Subtask" defaultValue="">
        <Form.Dropdown.Item value="" title={subtasksForSelected.length > 0 ? "No subtask" : "No subtasks available"} />
        {subtasksForSelected.map((s) => (
          <Form.Dropdown.Item
            key={s.subtask.id}
            value={s.subtask.id}
            title={s.subtask.title}
          />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="intention"
        title="Intention"
        placeholder="What will you focus on?"
      />
    </Form>
  );
}
