import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom has no layout, so scrollIntoView is missing.
Element.prototype.scrollIntoView = vi.fn();

/**
 * Minimal stubs for the preload bridges the Timer, Rail and Lists panel touch.
 * Tests override individual methods (e.g. `window.logAPI.searchTasks = vi.fn(...)`) as needed.
 */
function installBridgeStubs() {
  window.logAPI = {
    searchTasks: vi.fn(async () => []),
    getCachedTasks: vi.fn(async () => []),
    getCachedTask: vi.fn(async () => null),
    getRecentTasks: vi.fn(async () => []),
    getRankedRecentTasks: vi.fn(async () => []),
    getCalendarProposals: vi.fn(async () => []),
    getAdhocEntries: vi.fn(async () => []),
    getSessions: vi.fn(async () => []),
  } as unknown as Window['logAPI'];

  window.timerAPI = {
    getSettings: vi.fn(async (key: string) =>
      key === 'apiBaseUrl' ? 'https://example.test' : key === 'apiKey' ? 'test-key' : null
    ),
    saveSettings: vi.fn(async () => undefined),
    getIssue: vi.fn(async () => {
      throw new Error('Issue not found');
    }),
    getSessions: vi.fn(async () => []),
    getLastSessionWithTask: vi.fn(async () => null),
    startMainTimer: vi.fn(async () => undefined),
    stopMainTimer: vi.fn(async () => undefined),
    pauseMainTimer: vi.fn(async () => undefined),
    resumeMainTimer: vi.fn(async () => undefined),
    extendMainTimer: vi.fn(async () => undefined),
    updateTrayTime: vi.fn(async () => undefined),
    showNotification: vi.fn(async () => undefined),
    showSessionOverlay: vi.fn(async () => ({ shown: false })),
    hideSessionOverlay: vi.fn(async () => undefined),
  } as unknown as Window['timerAPI'];

  window.listsAPI = {
    getLists: vi.fn(async () => []),
    getArchivedLists: vi.fn(async () => []),
    getListItems: vi.fn(async () => []),
    getAllListItems: vi.fn(async () => []),
    getBillableForTask: vi.fn(async () => true),
    archiveOldCompleted: vi.fn(async () => 0),
    unarchiveList: vi.fn(async () => undefined),
    updateListItem: vi.fn(async () => undefined),
  } as unknown as Window['listsAPI'];

  window.dashboardAPI = {
    getDailyIntentions: vi.fn(async () => null),
    setDailyIntentions: vi.fn(async () => undefined),
  } as unknown as Window['dashboardAPI'];
}

beforeEach(() => {
  installBridgeStubs();
  vi.mocked(Element.prototype.scrollIntoView).mockClear();
});

afterEach(() => {
  cleanup();
});
