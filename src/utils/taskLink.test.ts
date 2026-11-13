import { describe, it, expect } from 'vitest';
import { isTaskId, taskUrl, DEFAULT_EASY8_BASE_URL } from './taskLink';

describe('taskLink', () => {
  it('accepts only digit ids', () => {
    expect(isTaskId('702448')).toBe(true);
    expect(isTaskId('')).toBe(false);
    expect(isTaskId('70a')).toBe(false);
    expect(isTaskId('../x')).toBe(false);
    expect(isTaskId(null)).toBe(false);
  });

  it('builds the issue link from the base url, trimming trailing slashes', () => {
    expect(taskUrl('https://es.easy8.com', '702448')).toBe('https://es.easy8.com/issues/702448');
    expect(taskUrl('https://es.easy8.com//', '1')).toBe('https://es.easy8.com/issues/1');
  });

  it('falls back to the default base url', () => {
    expect(taskUrl('', '5')).toBe(`${DEFAULT_EASY8_BASE_URL}/issues/5`);
    expect(taskUrl(null, '5')).toBe(`${DEFAULT_EASY8_BASE_URL}/issues/5`);
  });
});
