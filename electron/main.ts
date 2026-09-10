import { app, BrowserWindow, ipcMain, Notification, net, shell, screen } from 'electron';
import { join } from 'path';
import type { FocusCompletePayload, BreakCompletePayload, OverlayActionType } from '../src/types';
import {
  initDB,
  closeDB,
  saveSession,
  getSessions,
  getSessionsInRange,
  getLastSessionWithTask,
  updateSession,
  deleteSession,
  getSetting,
  saveSetting,
  addAdhocEntry,
  getAdhocEntries,
  getAdhocEntriesInRange,
  updateAdhocEntry,
  deleteAdhocEntry,
  getCalendarProposals,
  addCalendarProposal,
  updateCalendarProposal,
  acceptCalendarProposal,
  dismissCalendarProposal,
  getAllCachedTasks,
  getCachedTask,
  cacheTask,
  getRecentTasks,
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  getDaysSinceLastLog,
  getTaskPreference,
  getAllTaskPreferences,
  setTaskPreference,
  setTaskGoalId,
  getMilestone,
  getMilestonesByParent,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getGoal,
  getAllGoals,
  getActiveGoal,
  createGoal,
  updateGoal,
  setActiveGoal,
  getDailyIntentions,
  setDailyIntentions,
  getShutdownRitual,
  saveShutdownRitual,
  unlockDay,
  isDayLocked,
  getWeeklySummary,
  getWeeklySummariesInRange,
  computeWeeklySummary,
  getTaskTotalMinutes,
  getShutdownReflectionsInRange,
  getSessionsByTimeOfDay,
  getLists,
  createList,
  updateList,
  deleteList,
  getListItems,
  getAllListItems,
  createListItem,
  updateListItem,
  deleteListItem,
  getArchivedLists,
  archiveList,
  unarchiveList,
  archiveOldCompleted,
  reorderItemsInColumn,
  getBillableDefaultForTask
} from '../src/services/db';
import { createTray, updateTray, destroyTray } from './tray';
import {
  initOverlayEnabled,
  setOverlayEnabled,
  showOverlay,
  sendOverlayState,
  hideOverlay,
  setOverlayInteractive,
  repositionOverlayIfVisible,
  destroyOverlay
} from './overlayWindow';
import {
  setMainWindowReference,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getTimerState,
  extendTimer,
  cleanupTimer
} from './timer';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register drip:// URL scheme for Raycast integration
app.setAsDefaultProtocolClient('drip');

function handleDripUrl(url: string) {
  try {
    const parsed = new URL(url);
    const command = parsed.hostname;
    const params = parsed.searchParams;

    console.log(`[Drip URL] Handling: ${command}`, Object.fromEntries(params));

    switch (command) {
      case 'start-focus': {
        const taskId = params.get('taskId') || undefined;
        const intention = params.get('intention') || '';
        // Send to renderer to start focus via the store (handles session count, break logic, etc.)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('url-start-focus', { taskId, intention });
          mainWindow.show();
        }
        break;
      }
      case 'pause':
        pauseTimer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('url-timer-action', 'pause');
        }
        break;
      case 'resume':
        resumeTimer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('url-timer-action', 'resume');
        }
        break;
      case 'stop':
        stopTimer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('url-timer-action', 'stop');
        }
        break;
      case 'finish-early':
        stopTimer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('url-timer-action', 'finish-early');
        }
        break;
      case 'start-break': {
        const duration = parseInt(params.get('duration') || '5', 10);
        startTimer(duration * 60, 'break');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('url-timer-action', 'start-break', { isLong: duration === 10 });
        }
        break;
      }
      case 'skip-break':
        stopTimer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('url-timer-action', 'skip-break');
        }
        break;
      default:
        console.log(`[Drip URL] Unknown command: ${command}`);
    }
  } catch (error) {
    console.error('[Drip URL] Failed to parse URL:', url, error);
  }
}

// Handle URL on macOS when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDripUrl(url);
});

// Handle second-instance for URL forwarding (single instance lock)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // On macOS, the URL is passed via open-url event, not commandLine
    // On Windows/Linux, the URL is in commandLine
    const url = commandLine.find(arg => arg.startsWith('drip://'));
    if (url) {
      handleDripUrl(url);
    }
    // Focus the window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Initialize app
app.whenReady().then(() => {
  // Initialize database
  try {
    initDB();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  // Create main window
  createWindow();

  // Pass window reference to timer module
  setMainWindowReference(mainWindow);

  // Create tray icon only if setting is enabled (default: off)
  const showTray = getSetting('show_tray_icon');
  if (showTray === 'true') {
    createTray(mainWindow);
  }

  // Session-end overlay: read the enabled flag once, create the window lazily
  initOverlayEnabled();

  // A disconnected or rearranged display would otherwise leave the overlay
  // alive at off-screen coordinates.
  screen.on('display-removed', repositionOverlayIfVisible);
  screen.on('display-added', repositionOverlayIfVisible);
  screen.on('display-metrics-changed', repositionOverlayIfVisible);

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
      // Without this the timer module keeps sending to a dead window
      setMainWindowReference(mainWindow);
    } else {
      mainWindow.show();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    destroyOverlay();
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  app.isQuitting = true;
  cleanupTimer();
  destroyOverlay();
  closeDB();
  destroyTray();
});

// IPC Handlers

// Save pomodoro session
ipcMain.handle('save-session', async (_event, session) => {
  try {
    const id = saveSession(session);
    return { success: true, id };
  } catch (error) {
    console.error('Failed to save session:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Get sessions for a date
ipcMain.handle('get-sessions', async (_event, date: string) => {
  try {
    const sessions = getSessions(date);
    return { success: true, sessions };
  } catch (error) {
    console.error('Failed to get sessions:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Get sessions within a date range (for dashboard)
ipcMain.handle('get-sessions-in-range', async (_event, startDate: string, endDate: string) => {
  try {
    const sessions = getSessionsInRange(startDate, endDate);
    return { success: true, sessions };
  } catch (error) {
    console.error('Failed to get sessions in range:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Get last session with task for continue feature
ipcMain.handle('get-last-session-with-task', async (_event, date: string) => {
  try {
    const session = getLastSessionWithTask(date);
    return { success: true, session };
  } catch (error) {
    console.error('Failed to get last session:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Open URL in default external browser (e.g. Safari)
ipcMain.handle('open-external', async (_event, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Get setting
ipcMain.handle('get-setting', async (_event, key: string) => {
  try {
    const value = getSetting(key);
    return { success: true, value };
  } catch (error) {
    console.error('Failed to get setting:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Save setting
ipcMain.handle('save-setting', async (_event, key: string, value: string) => {
  try {
    saveSetting(key, value);
    return { success: true };
  } catch (error) {
    console.error('Failed to save setting:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Get days since last log
ipcMain.handle('get-days-since-last-log', async () => {
  try {
    const days = getDaysSinceLastLog();
    return { success: true, days };
  } catch (error) {
    console.error('Failed to get days since last log:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Update tray time
ipcMain.on('update-tray-time', (_event, time: string) => {
  updateTray(time);
});

// ---------------------------------------------------------------------------
// Session-end overlay
// ---------------------------------------------------------------------------

// Main window renderer asks for the overlay. Returns { shown: false } when the
// setting is off or window creation failed, so the caller can fall back.
ipcMain.handle('overlay:show', async (_event, payload: FocusCompletePayload | BreakCompletePayload) => {
  try {
    return { success: true, shown: showOverlay(payload) };
  } catch (error) {
    console.error('Failed to show overlay:', error);
    return { success: true, shown: false };
  }
});

ipcMain.handle('overlay:hide', async () => {
  try {
    hideOverlay();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// The break actually started — patch the pill's progress denominator.
ipcMain.handle('overlay:break-started', async (_event, totalSeconds: number, isLong: boolean) => {
  try {
    sendOverlayState({
      kind: 'break-running',
      totalSeconds,
      remainingSeconds: totalSeconds,
      isLong
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('overlay:set-enabled', async (_event, value: boolean) => {
  try {
    setOverlayEnabled(value);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Narrow write path for the overlay's note field — deliberately not the
// generic update-session handler.
ipcMain.handle('overlay:save-note', async (_event, sessionId: string, note: string) => {
  try {
    updateSession(sessionId, { comment: note.trim() || 'Focus session' });
    return { success: true };
  } catch (error) {
    console.error('Failed to save overlay note:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Overlay relays its actions to the main window renderer, which owns all timer
// logic — the overlay never drives the timer itself.
ipcMain.on('overlay:action', (_event, type: OverlayActionType) => {
  if (type === 'start-break') {
    // Collapse to the break pill immediately so there is no flash; the real
    // totalSeconds arrives via overlay:break-started.
    sendOverlayState({ kind: 'break-running', totalSeconds: 300, remainingSeconds: 300, isLong: false });
  } else {
    hideOverlay();
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay-action', type);
  }
});

ipcMain.on('overlay:set-interactive', (_event, interactive: boolean) => {
  setOverlayInteractive(interactive);
});

// Show notification
ipcMain.on('show-notification', (_event, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      silent: false
    }).show();
  }
});

// Show main window
ipcMain.on('show-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
});

// Toggle tray icon visibility
ipcMain.handle('toggle-tray', async (_event, show: boolean) => {
  try {
    if (show) {
      createTray(mainWindow);
    } else {
      destroyTray();
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to toggle tray:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Update session
ipcMain.handle('update-session', async (_event, id: string, updates) => {
  try {
    updateSession(id, updates);
    return { success: true };
  } catch (error) {
    console.error('Failed to update session:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Delete session
ipcMain.handle('delete-session', async (_event, id: string) => {
  try {
    deleteSession(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete session:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Adhoc entry handlers
ipcMain.handle('add-adhoc-entry', async (_event, entry) => {
  try {
    const id = addAdhocEntry(entry);
    return { success: true, id };
  } catch (error) {
    console.error('Failed to add adhoc entry:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-adhoc-entries', async (_event, date: string) => {
  try {
    const entries = getAdhocEntries(date);
    return { success: true, entries };
  } catch (error) {
    console.error('Failed to get adhoc entries:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Get adhoc entries within a date range (for dashboard)
ipcMain.handle('get-adhoc-entries-in-range', async (_event, startDate: string, endDate: string) => {
  try {
    const entries = getAdhocEntriesInRange(startDate, endDate);
    return { success: true, entries };
  } catch (error) {
    console.error('Failed to get adhoc entries in range:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('update-adhoc-entry', async (_event, id: string, updates) => {
  try {
    updateAdhocEntry(id, updates);
    return { success: true };
  } catch (error) {
    console.error('Failed to update adhoc entry:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-adhoc-entry', async (_event, id: string) => {
  try {
    deleteAdhocEntry(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete adhoc entry:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Calendar proposal handlers
ipcMain.handle('get-calendar-proposals', async (_event, date: string, includeAll?: boolean) => {
  try {
    const proposals = getCalendarProposals(date, includeAll);
    return { success: true, proposals };
  } catch (error) {
    console.error('Failed to get calendar proposals:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Task cache handlers
ipcMain.handle('get-cached-tasks', async () => {
  try {
    const tasks = getAllCachedTasks();
    return { success: true, tasks };
  } catch (error) {
    console.error('Failed to get cached tasks:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-cached-task', async (_event, taskId: string) => {
  try {
    const task = getCachedTask(taskId);
    return { success: true, task };
  } catch (error) {
    console.error('Failed to get cached task:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('cache-task', async (_event, taskId: string, title: string, projectId: number, projectName: string) => {
  try {
    cacheTask(taskId, title, projectId, projectName);
    return { success: true };
  } catch (error) {
    console.error('Failed to cache task:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-recent-tasks', async () => {
  try {
    const tasks = getRecentTasks();
    return { success: true, tasks };
  } catch (error) {
    console.error('Failed to get recent tasks:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Template handlers
ipcMain.handle('get-templates', async () => {
  try {
    const templates = getTemplates();
    return { success: true, templates };
  } catch (error) {
    console.error('Failed to get templates:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('add-template', async (_event, template) => {
  try {
    const id = addTemplate(template);
    return { success: true, id };
  } catch (error) {
    console.error('Failed to add template:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('update-template', async (_event, id: string, template) => {
  try {
    updateTemplate(id, template);
    return { success: true };
  } catch (error) {
    console.error('Failed to update template:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-template', async (_event, id: string) => {
  try {
    deleteTemplate(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete template:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Test API connection
ipcMain.handle('test-api-connection', async (_event, baseUrl: string, apiKey: string) => {
  try {
    const url = `${baseUrl}/users/current.json`;
    console.log('Testing API connection to:', url);

    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: url,
        headers: {
          'X-Redmine-API-Key': apiKey
        }
      });

      let responseData = '';

      request.on('response', (response) => {
        console.log('API response status:', response.statusCode);

        if (response.statusCode === 200) {
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            try {
              const data = JSON.parse(responseData);
              console.log('API test successful:', data);
              resolve({ success: true, data });
            } catch (parseError) {
              console.error('Failed to parse response:', parseError);
              resolve({ success: false, error: 'Invalid JSON response from API' });
            }
          });
        } else if (response.statusCode === 401) {
          resolve({ success: false, error: 'Invalid API key (401)' });
        } else if (response.statusCode === 404) {
          resolve({ success: false, error: 'API endpoint not found (404) - check base URL' });
        } else {
          resolve({ success: false, error: `API error: ${response.statusCode}` });
        }
      });

      request.on('error', (error) => {
        console.error('Request error:', error);
        resolve({ success: false, error: error.message });
      });

      request.end();
    });
  } catch (error) {
    console.error('Failed to test API connection:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Get issue details
ipcMain.handle('get-issue', async (_event, baseUrl: string, apiKey: string, issueId: string) => {
  try {
    const url = `${baseUrl}/issues/${issueId}.json`;
    console.log('Fetching issue from:', url);

    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: url,
        headers: {
          'X-Redmine-API-Key': apiKey
        }
      });

      let responseData = '';

      request.on('response', (response) => {
        console.log('Get issue response status:', response.statusCode);

        if (response.statusCode === 200) {
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            try {
              const apiResponse = JSON.parse(responseData);
              const issue = apiResponse.issue;

              const data = {
                taskId: issue.id.toString(),
                title: issue.subject,
                projectId: issue.project.id,
                projectName: issue.project.name
              };

              console.log('Issue fetched successfully:', data);

              // Cache the task immediately after fetching
              try {
                cacheTask(data.taskId, data.title, data.projectId, data.projectName);
                console.log('Task cached successfully:', data.taskId);
              } catch (cacheError) {
                console.error('Failed to cache task:', cacheError);
                // Don't fail the request if caching fails
              }

              resolve({ success: true, data });
            } catch (parseError) {
              console.error('Failed to parse issue response:', parseError);
              resolve({ success: false, error: 'Invalid JSON response from API' });
            }
          });
        } else if (response.statusCode === 401) {
          resolve({ success: false, error: 'Invalid API key (401)' });
        } else if (response.statusCode === 404) {
          resolve({ success: false, error: `Issue #${issueId} not found (404)` });
        } else {
          resolve({ success: false, error: `API error: ${response.statusCode}` });
        }
      });

      request.on('error', (error) => {
        console.error('Request error:', error);
        resolve({ success: false, error: error.message });
      });

      request.end();
    });
  } catch (error) {
    console.error('Failed to get issue:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Post time entry
ipcMain.handle('post-time-entry', async (_event, baseUrl: string, apiKey: string, payload: any) => {
  try {
    const url = `${baseUrl}/time_entries.json`;
    console.log('Posting time entry to:', url);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    return new Promise((resolve) => {
      const request = net.request({
        method: 'POST',
        url: url,
        headers: {
          'X-Redmine-API-Key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      let responseData = '';

      request.on('response', (response) => {
        console.log('Post time entry response status:', response.statusCode);

        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          if (response.statusCode === 201 || response.statusCode === 200) {
            try {
              const data = JSON.parse(responseData);
              const entryId = data.time_entry.id;
              console.log('Time entry posted successfully, ID:', entryId);
              resolve({ success: true, entryId });
            } catch (parseError) {
              console.error('Failed to parse time entry response:', parseError);
              resolve({ success: false, error: 'Invalid JSON response from API' });
            }
          } else if (response.statusCode === 401) {
            resolve({ success: false, error: 'Invalid API key (401)' });
          } else if (response.statusCode === 404) {
            resolve({ success: false, error: 'Issue not found (404)' });
          } else if (response.statusCode === 422) {
            try {
              const errorData = JSON.parse(responseData);
              const errors = errorData.errors || ['Validation failed'];
              resolve({ success: false, error: `Validation error: ${errors.join(', ')}` });
            } catch {
              resolve({ success: false, error: 'Validation failed (422)' });
            }
          } else {
            console.error('API error response:', responseData);
            resolve({ success: false, error: `API error: ${response.statusCode}` });
          }
        });
      });

      request.on('error', (error) => {
        console.error('Request error:', error);
        resolve({ success: false, error: error.message });
      });

      request.write(JSON.stringify(payload));
      request.end();
    });
  } catch (error) {
    console.error('Failed to post time entry:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Fetch calendar feed
ipcMain.handle('fetch-calendar-feed', async (_event, url: string) => {
  try {
    console.log('Fetching calendar feed from:', url);

    return new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: url
      });

      let responseData = '';

      request.on('response', (response) => {
        console.log('Calendar feed response status:', response.statusCode);

        if (response.statusCode === 200) {
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            console.log('Calendar feed fetched successfully');
            resolve({ success: true, data: responseData });
          });
        } else {
          resolve({ success: false, error: `HTTP error: ${response.statusCode}` });
        }
      });

      request.on('error', (error) => {
        console.error('Calendar feed fetch error:', error);
        resolve({ success: false, error: error.message });
      });

      request.end();
    });
  } catch (error) {
    console.error('Failed to fetch calendar feed:', error);
    return { success: false, error: (error as Error).message };
  }
});

// Calendar proposal IPC handlers
ipcMain.handle('add-calendar-proposal', async (_event, proposal) => {
  try {
    const id = addCalendarProposal(proposal);
    return { success: true, id };
  } catch (error) {
    console.error('Failed to add calendar proposal:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('update-calendar-proposal', async (_event, id: string, updates) => {
  try {
    updateCalendarProposal(id, updates);
    return { success: true };
  } catch (error) {
    console.error('Failed to update calendar proposal:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('accept-calendar-proposal', async (_event, id: string, taskId?: string) => {
  try {
    acceptCalendarProposal(id, taskId);
    return { success: true };
  } catch (error) {
    console.error('Failed to accept calendar proposal:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('dismiss-calendar-proposal', async (_event, id: string) => {
  try {
    dismissCalendarProposal(id);
    return { success: true };
  } catch (error) {
    console.error('Failed to dismiss calendar proposal:', error);
    return { success: false, error: (error as Error).message };
  }
});

// ==================== TASK PREFERENCES ====================

ipcMain.handle('get-task-preference', async (_event, taskId: string) => {
  return getTaskPreference(taskId);
});

ipcMain.handle('get-all-task-preferences', async () => {
  return getAllTaskPreferences();
});

ipcMain.handle('set-task-preference', async (_event, taskId: string, pref: any) => {
  setTaskPreference(taskId, pref);
});

// ==================== MILESTONES ====================

ipcMain.handle('get-milestone', async (_event, id: string) => {
  return getMilestone(id);
});

ipcMain.handle('get-milestones-by-parent', async (_event, parentType: string, parentId: string) => {
  return getMilestonesByParent(parentType, parentId);
});

ipcMain.handle('create-milestone', async (_event, milestone: any) => {
  createMilestone(milestone);
});

ipcMain.handle('update-milestone', async (_event, id: string, patch: any) => {
  updateMilestone(id, patch);
});

ipcMain.handle('delete-milestone', async (_event, id: string) => {
  deleteMilestone(id);
});

// ==================== GOALS ====================

ipcMain.handle('get-goal', async (_event, id: string) => {
  return getGoal(id);
});

ipcMain.handle('get-all-goals', async () => {
  return getAllGoals();
});

ipcMain.handle('get-active-goal', async () => {
  return getActiveGoal();
});

ipcMain.handle('create-goal', async (_event, goal: any) => {
  createGoal(goal);
});

ipcMain.handle('update-goal', async (_event, id: string, patch: any) => {
  updateGoal(id, patch);
});

ipcMain.handle('set-active-goal', async (_event, id: string) => {
  setActiveGoal(id);
});

// ==================== DAILY INTENTIONS ====================

ipcMain.handle('get-daily-intentions', async (_event, date: string) => {
  return getDailyIntentions(date);
});

ipcMain.handle('set-daily-intentions', async (_event, date: string, intentions: string[]) => {
  setDailyIntentions(date, intentions);
});

// Shutdown Rituals
ipcMain.handle('get-shutdown-ritual', async (_event, date: string) => {
  return getShutdownRitual(date);
});

ipcMain.handle('save-shutdown-ritual', async (
  _event,
  date: string,
  totalMinutes: number,
  deepWorkMinutes: number,
  tasksWorked: string[],
  reflection: string | null,
  notes: string | null,
  tomorrowIntentions: string[] | null
) => {
  saveShutdownRitual(date, totalMinutes, deepWorkMinutes, tasksWorked, reflection, notes, tomorrowIntentions);
});

ipcMain.handle('unlock-day', async (_event, date: string) => {
  unlockDay(date);
});

ipcMain.handle('is-day-locked', async (_event, date: string) => {
  return isDayLocked(date);
});

// ==================== WEEKLY SUMMARIES ====================

ipcMain.handle('get-weekly-summary', async (_event, weekStart: string) => {
  try {
    const summary = getWeeklySummary(weekStart);
    return { success: true, summary };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-weekly-summaries-in-range', async (_event, startDate: string, endDate: string) => {
  try {
    const summaries = getWeeklySummariesInRange(startDate, endDate);
    return { success: true, summaries };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('compute-weekly-summary', async (_event, weekStart: string) => {
  try {
    computeWeeklySummary(weekStart);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// ==================== PROGRESS QUERIES ====================

ipcMain.handle('get-task-total-minutes', async (_event, taskId: string) => {
  try {
    const minutes = getTaskTotalMinutes(taskId);
    return { success: true, minutes };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-shutdown-reflections-in-range', async (_event, startDate: string, endDate: string) => {
  try {
    const reflections = getShutdownReflectionsInRange(startDate, endDate);
    return { success: true, reflections };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-sessions-by-time-of-day', async (_event, startDate: string, endDate: string) => {
  try {
    const data = getSessionsByTimeOfDay(startDate, endDate);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('set-task-goal-id', async (_event, taskId: string, goalId: string | null) => {
  try {
    setTaskGoalId(taskId, goalId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// ==================== OPENROUTER AI ====================

ipcMain.handle('call-openrouter', async (_event, apiKey: string, model: string, systemPrompt: string, userMessage: string) => {
  try {
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      });

      const request = net.request({
        method: 'POST',
        url: 'https://openrouter.ai/api/v1/messages'
      });

      request.setHeader('Authorization', `Bearer ${apiKey}`);
      request.setHeader('Content-Type', 'application/json');

      let responseData = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const data = JSON.parse(responseData);
              const text = data.content?.[0]?.text || '';
              resolve({ success: true, text });
            } catch {
              resolve({ success: false, error: 'Failed to parse AI response' });
            }
          } else if (response.statusCode === 401) {
            resolve({ success: false, error: 'Invalid API key. Check your OpenRouter key in Settings.' });
          } else if (response.statusCode === 429) {
            resolve({ success: false, error: 'Rate limited. Try again in a moment.' });
          } else {
            resolve({ success: false, error: `OpenRouter error: ${response.statusCode}` });
          }
        });
      });

      request.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      request.write(payload);
      request.end();
    });
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// ==================== MAIN PROCESS TIMER ====================

ipcMain.handle('start-main-timer', async (_event, duration: number, timerType: 'focus' | 'break', nextBreakDuration?: 5 | 10, taskId?: string) => {
  try {
    startTimer(duration, timerType, nextBreakDuration, taskId);
    return { success: true };
  } catch (error) {
    console.error('Failed to start main timer:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('pause-main-timer', async () => {
  try {
    pauseTimer();
    return { success: true };
  } catch (error) {
    console.error('Failed to pause main timer:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('resume-main-timer', async () => {
  try {
    resumeTimer();
    return { success: true };
  } catch (error) {
    console.error('Failed to resume main timer:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('stop-main-timer', async () => {
  try {
    stopTimer();
    return { success: true };
  } catch (error) {
    console.error('Failed to stop main timer:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-main-timer-state', async () => {
  try {
    const state = getTimerState();
    return { success: true, state };
  } catch (error) {
    console.error('Failed to get main timer state:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('extend-main-timer', async (_event, additionalSeconds: number) => {
  try {
    extendTimer(additionalSeconds);
    return { success: true };
  } catch (error) {
    console.error('Failed to extend main timer:', error);
    return { success: false, error: (error as Error).message };
  }
});

// ==================== LISTS ====================

ipcMain.handle('get-lists', async () => {
  try {
    const lists = getLists();
    return { success: true, lists };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('create-list', async (_event, list) => {
  try {
    const id = createList(list);
    return { success: true, id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('update-list', async (_event, id: string, updates) => {
  try {
    updateList(id, updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-list', async (_event, id: string) => {
  try {
    deleteList(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-list-items', async (_event, listId: string) => {
  try {
    const items = getListItems(listId);
    return { success: true, items };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-all-list-items', async () => {
  try {
    const items = getAllListItems();
    return { success: true, items };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('create-list-item', async (_event, item) => {
  try {
    const id = createListItem(item);
    return { success: true, id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('update-list-item', async (_event, id: string, updates) => {
  try {
    updateListItem(id, updates);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('delete-list-item', async (_event, id: string) => {
  try {
    deleteListItem(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-billable-for-task', async (_event, taskId: string | null) => {
  try {
    const billable = getBillableDefaultForTask(taskId);
    return { success: true, billable };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('archive-list', async (_event, id: string) => {
  try {
    archiveList(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('unarchive-list', async (_event, id: string) => {
  try {
    unarchiveList(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('get-archived-lists', async () => {
  try {
    const lists = getArchivedLists();
    return { success: true, lists };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('archive-old-completed', async () => {
  try {
    const count = archiveOldCompleted();
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});
