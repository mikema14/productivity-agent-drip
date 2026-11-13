/** Easy8 web address used when Settings has no API base URL. */
export const DEFAULT_EASY8_BASE_URL = 'https://es.easyproject.com';

/** An Easy8 task id: digits only (what Drip stores in task_id columns). */
export function isTaskId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

/** Browser link to the Easy8 task, built from the Settings API base URL. */
export function taskUrl(baseUrl: string | null | undefined, taskId: string): string {
  const base = (baseUrl ?? '').trim().replace(/\/+$/, '') || DEFAULT_EASY8_BASE_URL;
  return `${base}/issues/${taskId}`;
}

export type TaskIdAction = 'copy' | 'copy-link' | 'open' | 'menu';
