/**
 * The palette, in one place.
 *
 * Plain JS on purpose: tailwind.config.js and the overlay renderer (which draws
 * with inline styles in its own Electron window, so it cannot use Tailwind
 * classes) both import this, and the Tailwind config is loaded by Node.
 */
export const COLOR = {
  drip: {
    bg: '#0a0a0c',
    surface: '#141418',
    elevated: '#1c1c22',
    border: '#2a2a32',
  },
  focus: {
    DEFAULT: '#f59e0b',
    light: '#fbbf24',
    bright: '#fde68a',
    dark: '#d97706',
  },
  break: {
    DEFAULT: '#34d399',
    light: '#6ee7b7',
    dark: '#10b981',
  },
  // Semantic error red — Tailwind red-500 / red-400, as used across the app.
  // Not an accent: only for errors and the idle nudge.
  alert: {
    DEFAULT: '#ef4444',
    light: '#f87171',
  },
  txt: {
    primary: '#f0f0f2',
    secondary: '#a0a0b0',
    muted: '#8585a0',
    dim: '#45455a',
  },
};
