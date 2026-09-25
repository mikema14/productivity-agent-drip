import type { IssueData, IssueResponse, TimeEntryPayload } from '../types';

// Hardcoded constants for personal use
const API_CONSTANTS = {
  USER_ID: 28668,        // Your user ID - never changes
  ACTIVITY_ID: 95,       // "Work" activity - default
  DEFAULT_BILLABLE: true
};

class EasyProjectAPI {
  private baseUrl: string = '';
  private apiKey: string = '';

  async initialize() {
    const baseUrl = await window.timerAPI.getSettings('apiBaseUrl');
    const apiKey = await window.timerAPI.getSettings('apiKey');

    if (!baseUrl || !apiKey) {
      throw new Error('API not configured. Please add your API key in Settings.');
    }

    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Fetch issue details from Easy Project
   */
  async getIssue(issueId: string): Promise<IssueData> {
    await this.initialize();

    // Use IPC to avoid CORS issues
    if (window.timerAPI.getIssue) {
      const data = await window.timerAPI.getIssue(this.baseUrl, this.apiKey, issueId);

      // Cache the task in the database
      await this.cacheTask(
        data.taskId,
        data.title,
        data.projectId,
        data.projectName
      );

      return data;
    }

    // Fallback to fetch (won't work in production due to CORS)
    const response = await fetch(`${this.baseUrl}/issues/${issueId}.json`, {
      headers: {
        'X-Redmine-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key. Please update in Settings.');
      }
      if (response.status === 404) {
        throw new Error(`Issue #${issueId} not found.`);
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data: IssueResponse = await response.json();
    const { issue } = data;

    // Cache the task in the database
    await this.cacheTask(
      issue.id.toString(),
      issue.subject,
      issue.project.id,
      issue.project.name
    );

    return {
      taskId: issue.id.toString(),
      title: issue.subject,
      projectId: issue.project.id,
      projectName: issue.project.name,
    };
  }

  /**
   * Post a time entry to Easy Project
   */
  async postTimeEntry(params: {
    issueId: string;
    projectId: number;
    hours: number;
    spentOn: string; // YYYY-MM-DD
    comments: string;
    billable?: boolean;
  }): Promise<number> {
    await this.initialize();

    // Validation
    if (!params.issueId) {
      throw new Error('Issue ID is required');
    }
    if (params.hours <= 0) {
      throw new Error('Hours must be greater than 0');
    }
    if (!params.comments?.trim()) {
      throw new Error('Comment is required');
    }

    const payload: TimeEntryPayload = {
      time_entry: {
        project_id: params.projectId,
        issue_id: parseInt(params.issueId),
        user_id: API_CONSTANTS.USER_ID,
        activity_id: API_CONSTANTS.ACTIVITY_ID,
        hours: params.hours,
        spent_on: params.spentOn,
        comments: params.comments,
        easy_is_billable: params.billable ?? API_CONSTANTS.DEFAULT_BILLABLE,
      },
    };

    // Use IPC to avoid CORS issues
    if (window.timerAPI.postTimeEntry) {
      return await window.timerAPI.postTimeEntry(this.baseUrl, this.apiKey, payload);
    }

    // Fallback to fetch (won't work in production due to CORS, but kept for reference)
    if (import.meta.env.DEV) throw new Error('Blocked: posting time entries is disabled in dev builds');
    const response = await fetch(`${this.baseUrl}/time_entries.json`, {
      method: 'POST',
      headers: {
        'X-Redmine-API-Key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      if (response.status === 404) {
        throw new Error('Issue not found');
      }
      if (response.status === 422) {
        const errorData = await response.json().catch(() => ({}));
        const errors = errorData.errors || ['Validation failed'];
        throw new Error(`Validation error: ${errors.join(', ')}`);
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.time_entry.id;
  }

  /**
   * Cache a task in the local database
   */
  private async cacheTask(
    taskId: string,
    title: string,
    projectId: number,
    projectName: string
  ): Promise<void> {
    // This would normally call an IPC method to store in the database
    // For now, we'll create an IPC method for this
    try {
      await window.logAPI.cacheTask?.(taskId, title, projectId, projectName);
    } catch (error) {
      console.warn('Failed to cache task:', error);
      // Don't fail the whole operation if caching fails
    }
  }
}

// Export singleton instance
export const easyProjectAPI = new EasyProjectAPI();
