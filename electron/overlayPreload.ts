import { contextBridge, ipcRenderer } from 'electron';
import type { OverlayAPI, OverlayActionData, OverlayActionType, SessionOverlayPayload } from '../src/types';

/**
 * Minimal bridge for the overlay window. Deliberately separate from
 * preload.ts — the overlay has no business reaching the API key, the time-entry
 * endpoints or the ~100 other channels the main window uses.
 */
const overlayAPI: OverlayAPI = {
  onState: (callback: (payload: SessionOverlayPayload) => void): void => {
    ipcRenderer.on('overlay:state', (_event, payload: SessionOverlayPayload) => callback(payload));
  },

  onTick: (callback: (remainingSeconds: number) => void): void => {
    ipcRenderer.on('overlay:tick', (_event, remainingSeconds: number) => callback(remainingSeconds));
  },

  action: (type: OverlayActionType, data?: OverlayActionData): void => {
    ipcRenderer.send('overlay:action', type, data);
  },

  saveNote: async (sessionId: string, note: string): Promise<void> => {
    const result = await ipcRenderer.invoke('overlay:save-note', sessionId, note);
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to save note');
    }
  },

  setInteractive: (interactive: boolean): void => {
    ipcRenderer.send('overlay:set-interactive', interactive);
  },

  setEscalated: (escalated: boolean): void => {
    ipcRenderer.send('overlay:set-escalated', escalated);
  },
};

contextBridge.exposeInMainWorld('overlayAPI', overlayAPI);
