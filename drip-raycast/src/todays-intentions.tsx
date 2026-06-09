import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  Form,
  useNavigation,
} from "@raycast/api";
import { useState, useEffect } from "react";
import {
  getDailyIntentions,
  saveDailyIntentionsSync,
} from "./lib/db";
import type { DailyIntention } from "./lib/types";

function AddIntentionForm(props: {
  onAdd: (text: string, taskId?: string) => void;
}) {
  const { pop } = useNavigation();

  function handleSubmit(values: { text: string; taskId: string }) {
    if (!values.text.trim()) return;
    props.onAdd(values.text.trim(), values.taskId || undefined);
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Intention" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="text" title="Intention" placeholder="What do you intend to accomplish?" />
      <Form.TextField id="taskId" title="Task ID" placeholder="Optional task ID" />
    </Form>
  );
}

export default function TodaysIntentions() {
  const today = new Date().toISOString().slice(0, 10);
  const [intentions, setIntentions] = useState<DailyIntention[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getDailyIntentions(today)
      .then((result) => setIntentions(result || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  function save(updated: DailyIntention[]) {
    setIntentions(updated);
    saveDailyIntentionsSync(today, updated);
  }

  function addIntention(text: string, taskId?: string) {
    save([...intentions, { text, completed: false, taskId }]);
  }

  function toggleIntention(index: number) {
    const updated = [...intentions];
    updated[index] = { ...updated[index], completed: !updated[index].completed };
    save(updated);
  }

  function removeIntention(index: number) {
    save(intentions.filter((_, i) => i !== index));
  }

  return (
    <List searchBarPlaceholder="Filter intentions..." isLoading={isLoading}>
      <List.Section title={`Intentions for ${today}`}>
        {intentions.map((intention, index) => (
          <List.Item
            key={index}
            title={intention.text}
            subtitle={intention.taskId ? `#${intention.taskId}` : ""}
            icon={
              intention.completed
                ? { source: Icon.CheckCircle, tintColor: Color.Green }
                : { source: Icon.Circle, tintColor: Color.SecondaryText }
            }
            actions={
              <ActionPanel>
                <Action
                  title={intention.completed ? "Mark Incomplete" : "Mark Complete"}
                  icon={intention.completed ? Icon.Circle : Icon.CheckCircle}
                  onAction={() => toggleIntention(index)}
                />
                <Action
                  title="Remove"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={() => removeIntention(index)}
                />
                <Action.Push
                  title="Add Intention"
                  icon={Icon.Plus}
                  target={<AddIntentionForm onAdd={addIntention} />}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {!isLoading && intentions.length === 0 && (
        <List.EmptyView
          title="No intentions set"
          description="Press Enter to add one"
          icon={Icon.LightBulb}
          actions={
            <ActionPanel>
              <Action.Push
                title="Add Intention"
                icon={Icon.Plus}
                target={<AddIntentionForm onAdd={addIntention} />}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}
