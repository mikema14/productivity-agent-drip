import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  open,
  Color,
} from "@raycast/api";
import { useState, useEffect, useCallback, useMemo } from "react";
import { searchTasks, cacheTaskSync, searchListItems, getActiveListItems, getLists, parseSubtasks } from "./lib/db";
import { fetchIssue } from "./lib/api";
import type { TaskCache, DripListItem, DripList } from "./lib/types";
import {
  deduplicateListItems,
  collectSubtasksForTaskId,
  effectiveTaskId,
} from "./lib/dedup";

const COLUMN_TAGS: Record<string, { value: string; color: Color }> = {
  today: { value: "Today", color: Color.Green },
  this_week: { value: "This Week", color: Color.Blue },
  backlog: { value: "Backlog", color: Color.SecondaryText },
};

export default function SearchTasks() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaskCache[]>([]);
  const [listItems, setListItems] = useState<DripListItem[]>([]);
  const [allListItems, setAllListItems] = useState<DripListItem[]>([]);
  const [lists, setLists] = useState<DripList[]>([]);
  const [listFilter, setListFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getLists().then(setLists).catch(() => {});
    getActiveListItems().then(setAllListItems).catch(() => {});
  }, []);

  const doSearch = useCallback(async (q: string) => {
    setIsLoading(true);
    try {
      const [tasks, items] = await Promise.all([
        searchTasks(q),
        searchListItems(q),
      ]);
      setResults(tasks);
      setListItems(items);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "DB Error",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

  async function fetchFromApi(issueId: string) {
    setIsLoading(true);
    try {
      const task = await fetchIssue(issueId);
      cacheTaskSync(task);
      setResults((prev) => [task, ...prev.filter((t) => t.task_id !== task.task_id)]);
      await showToast({
        style: Toast.Style.Success,
        title: `Fetched #${task.task_id}`,
        message: task.title,
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to fetch",
        message: String(error),
      });
    } finally {
      setIsLoading(false);
    }
  }

  const isNumeric = /^\d+$/.test(query);
  const notInResults =
    isNumeric && !results.some((t) => t.task_id === query);

  const filteredListItems =
    listFilter === "all"
      ? listItems
      : listItems.filter((li) => li.list_id === listFilter);

  const dedupedListItems = useMemo(
    () => deduplicateListItems(results, filteredListItems),
    [results, filteredListItems]
  );

  return (
    <List
      searchBarPlaceholder="Search by task ID or title..."
      onSearchTextChange={setQuery}
      isLoading={isLoading}
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by list" onChange={setListFilter}>
          <List.Dropdown.Item title="All Lists" value="all" />
          {lists.map((l) => (
            <List.Dropdown.Item key={l.id} title={l.name} value={l.id} />
          ))}
        </List.Dropdown>
      }
    >
      {notInResults && (
        <List.Item
          title={`Fetch #${query} from Easy Project`}
          icon={Icon.Download}
          actions={
            <ActionPanel>
              <Action
                title="Fetch from API"
                onAction={() => fetchFromApi(query)}
                icon={Icon.Download}
              />
            </ActionPanel>
          }
        />
      )}
      <List.Section title="API Tasks">
        {results.flatMap((task) => {
          const subtasks = collectSubtasksForTaskId(task.task_id, allListItems).filter(
            (s) => !s.subtask.completed
          );
          return [
            <List.Item
              key={task.task_id}
              title={`#${task.task_id} — ${task.title}`}
              subtitle={task.project_name || ""}
              accessories={[{ text: task.last_seen_at.slice(0, 10) }]}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard
                    title="Copy Task ID"
                    content={task.task_id}
                  />
                  <Action
                    title="Start Focus with Task"
                    icon={Icon.Play}
                    onAction={() =>
                      open(`drip://start-focus?taskId=${task.task_id}`)
                    }
                  />
                  <Action.OpenInBrowser
                    title="Open in Easy Project"
                    url={`https://es.easyproject.com/issues/${task.task_id}`}
                  />
                </ActionPanel>
              }
            />,
            ...subtasks.map((s) => (
              <List.Item
                key={`${task.task_id}-sub-${s.subtask.id}`}
                title={`└ ${s.subtask.title}`}
                subtitle={s.listItemTitle}
                icon={Icon.ChevronRight}
                actions={
                  <ActionPanel>
                    <Action
                      title="Start Focus"
                      icon={Icon.Play}
                      onAction={() => {
                        const params = new URLSearchParams();
                        params.set("taskId", task.task_id);
                        params.set("intention", s.subtask.title);
                        open(`drip://start-focus?${params.toString()}`);
                      }}
                    />
                  </ActionPanel>
                }
              />
            )),
          ];
        })}
      </List.Section>
      <List.Section title="List Items">
        {dedupedListItems.flatMap((li) => {
          const tag = COLUMN_TAGS[li.column] ?? COLUMN_TAGS.backlog;
          const eid = effectiveTaskId(li);
          const accessories: List.Item.Accessory[] = [{ tag }];
          if (eid) {
            accessories.unshift({ text: `#${eid}` });
          }
          const subtasks = parseSubtasks(li.subtasks).filter((s) => !s.completed);
          return [
            <List.Item
              key={li.id}
              title={li.title}
              subtitle={li.list_name}
              accessories={accessories}
              actions={
                <ActionPanel>
                  <Action
                    title="Start Focus"
                    icon={Icon.Play}
                    onAction={() => {
                      const params = new URLSearchParams();
                      if (eid) params.set("taskId", eid);
                      params.set("intention", li.title);
                      open(`drip://start-focus?${params.toString()}`);
                    }}
                  />
                  {eid && (
                    <Action.CopyToClipboard
                      title="Copy Task ID"
                      content={eid}
                    />
                  )}
                  {eid && (
                    <Action.OpenInBrowser
                      title="Open in Easy Project"
                      url={`https://es.easyproject.com/issues/${eid}`}
                    />
                  )}
                </ActionPanel>
              }
            />,
            ...subtasks.map((s) => (
              <List.Item
                key={`${li.id}-sub-${s.id}`}
                title={`└ ${s.title}`}
                subtitle={li.list_name}
                icon={Icon.ChevronRight}
                actions={
                  <ActionPanel>
                    <Action
                      title="Start Focus"
                      icon={Icon.Play}
                      onAction={() => {
                        const params = new URLSearchParams();
                        if (eid) params.set("taskId", eid);
                        params.set("intention", s.title);
                        open(`drip://start-focus?${params.toString()}`);
                      }}
                    />
                  </ActionPanel>
                }
              />
            )),
          ];
        })}
      </List.Section>
    </List>
  );
}
