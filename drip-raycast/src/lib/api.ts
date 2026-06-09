import { getPreferenceValues } from "@raycast/api";
import { USER_ID, ACTIVITY_ID } from "./constants";
import { getSetting } from "./db";
import type { TaskCache } from "./types";

interface Preferences {
  apiBaseUrl: string;
  apiKey: string;
}

async function getApiConfig(): Promise<{ baseUrl: string; apiKey: string }> {
  const prefs = getPreferenceValues<Preferences>();

  let baseUrl = prefs.apiBaseUrl;
  let apiKey = prefs.apiKey;

  if (!apiKey) {
    apiKey = (await getSetting("api_key")) || "";
  }
  if (!baseUrl) {
    baseUrl = (await getSetting("api_base_url")) || "https://es.easyproject.com";
  }

  return { baseUrl, apiKey };
}

export async function fetchIssue(issueId: string): Promise<TaskCache> {
  const { baseUrl, apiKey } = await getApiConfig();

  if (!apiKey) {
    throw new Error("API key not configured. Set it in Raycast preferences or Drip app settings.");
  }

  const response = await fetch(`${baseUrl}/issues/${issueId}.json`, {
    headers: {
      "X-Redmine-API-Key": apiKey,
      Accept: "application/json",
    },
  });

  if (response.status === 401) throw new Error("Invalid API key");
  if (response.status === 404) throw new Error(`Issue #${issueId} not found`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = (await response.json()) as {
    issue: {
      id: number;
      subject: string;
      project: { id: number; name: string };
    };
  };

  return {
    task_id: data.issue.id.toString(),
    title: data.issue.subject,
    project_id: data.issue.project.id,
    project_name: data.issue.project.name,
    last_seen_at: new Date().toISOString(),
  };
}

export async function postTimeEntry(params: {
  projectId: number;
  issueId: number;
  hours: number;
  spentOn: string;
  comments: string;
  billable: boolean;
}): Promise<number> {
  const { baseUrl, apiKey } = await getApiConfig();

  if (!apiKey) {
    throw new Error("API key not configured.");
  }

  const payload = {
    time_entry: {
      project_id: params.projectId,
      issue_id: params.issueId,
      user_id: USER_ID,
      activity_id: ACTIVITY_ID,
      hours: params.hours,
      spent_on: params.spentOn,
      comments: params.comments,
      easy_is_billable: params.billable,
    },
  };

  const response = await fetch(`${baseUrl}/time_entries.json`, {
    method: "POST",
    headers: {
      "X-Redmine-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) throw new Error("Invalid API key");
  if (response.status === 404) throw new Error("Issue not found");
  if (response.status === 422) {
    const errorData = (await response.json()) as { errors?: string[] };
    throw new Error(
      `Validation error: ${(errorData.errors || ["Unknown"]).join(", ")}`
    );
  }
  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const data = (await response.json()) as {
    time_entry: { id: number };
  };
  return data.time_entry.id;
}
