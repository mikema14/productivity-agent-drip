/**
 * Show a native notification using the Electron API
 * This function is called from the renderer process via IPC
 */
export function requestNotification(title: string, body: string): void {
  if (window.timerAPI) {
    window.timerAPI.showNotification(title, body);
  }
}

/**
 * Show notification for completed focus session
 */
export function notifySessionComplete(): void {
  requestNotification(
    'Focus Session Complete!',
    'Great work! Time for a break.'
  );
}

/**
 * Show notification for completed break
 */
export function notifyBreakComplete(): void {
  requestNotification(
    'Break Complete!',
    'Ready to start another focus session?'
  );
}

/**
 * Show notification for long break
 */
export function notifyLongBreak(): void {
  requestNotification(
    'Long Break Time!',
    'You\'ve earned a longer break. Take 10 minutes.'
  );
}

/**
 * Show custom notification
 */
export function notifyCustom(title: string, message: string): void {
  requestNotification(title, message);
}
