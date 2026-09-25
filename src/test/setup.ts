import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no layout, so scrollIntoView is missing.
Element.prototype.scrollIntoView = vi.fn();

/**
 * Minimal stubs for the preload bridges the Timer pickers touch. Tests override
 * individual methods (e.g. `window.logAPI.searchTasks = vi.fn(...)`) as needed.
 */
function installBridgeStubs() {
  window.logAPI = {
    searchTasks: vi.fn(async () => []),
    getCachedTasks: vi.fn(async () => []),
    getCachedTask: vi.fn(async () => null),
    getRecentTasks: vi.fn(async () => []),
    getRankedRecentTasks: vi.fn(async () => []),
  } as unknown as Window['logAPI'];

  window.timerAPI = {
    getSettings: vi.fn(async (key: string) =>
      key === 'apiBaseUrl' ? 'https://example.test' : key === 'apiKey' ? 'test-key' : null
    ),
    saveSettings: vi.fn(async () => undefined),
    getIssue: vi.fn(async () => {
      throw new Error('Issue not found');
    }),
  } as unknown as Window['timerAPI'];
}

beforeEach(() => {
  installBridgeStubs();
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
});

afterEach(() => {
  cleanup();
});
