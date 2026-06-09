import {
  Form,
  ActionPanel,
  Action,
  showHUD,
  popToRoot,
} from "@raycast/api";
import { getRecentTasks, addAdhocEntrySync } from "./lib/db";
import { useEffect, useState } from "react";
import { randomUUID } from "crypto";
import type { TaskCache } from "./lib/types";

function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();

  const hm = trimmed.match(/^(\d+)h\s*(\d+)m?$/);
  if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2]);

  const hOnly = trimmed.match(/^(\d+(?:\.\d+)?)h$/);
  if (hOnly) return Math.round(parseFloat(hOnly[1]) * 60);

  const mOnly = trimmed.match(/^(\d+)m?$/);
  if (mOnly) return parseInt(mOnly[1]);

  return null;
}

export default function AddEntry() {
  const [tasks, setTasks] = useState<TaskCache[]>([]);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    getRecentTasks(20).then(setTasks).catch(() => {});
  }, []);

  async function handleSubmit(values: {
    duration: string;
    taskId: string;
    comment: string;
    date: Date | null;
  }) {
    const minutes = parseDuration(values.duration);
    if (!minutes || minutes <= 0) {
      await showHUD("Invalid duration. Use format: 30m, 1h, 1h30m");
      return;
    }

    const date = values.date
      ? values.date.toISOString().slice(0, 10)
      : today;

    const task = tasks.find((t) => t.task_id === values.taskId);

    addAdhocEntrySync({
      id: randomUUID(),
      date,
      duration_minutes: minutes,
      title: values.comment || (task ? task.title : "Manual entry"),
      task_id: values.taskId || null,
      comment: values.comment || null,
      marked_to_log: 1,
    });

    await showHUD(`Added ${minutes}m entry`);
    popToRoot();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Entry" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="duration"
        title="Duration"
        placeholder="30m, 1h, 1h30m"
      />
      <Form.Dropdown id="taskId" title="Task" defaultValue="">
        <Form.Dropdown.Item value="" title="No task" />
        {tasks.map((t) => (
          <Form.Dropdown.Item
            key={t.task_id}
            value={t.task_id}
            title={`#${t.task_id} — ${t.title}`}
          />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="comment"
        title="Comment"
        placeholder="What did you work on?"
      />
      <Form.DatePicker
        id="date"
        title="Date"
        defaultValue={new Date()}
      />
    </Form>
  );
}
