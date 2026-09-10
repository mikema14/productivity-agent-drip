/**
 * Single source of truth for the overlay's glass recipe.
 *
 * A transparent Electron BrowserWindow cannot blur the desktop behind it —
 * `backdrop-filter` only blurs content within the same window. So the fill is
 * raised well above the 0.62 used in the design mock, and the amber glow is
 * rendered as a layer *behind* the pane, which is what makes it read as glass.
 */
export const GLASS_OPACITY = 0.86;

export const GLASS = {
  fill: `rgba(16, 16, 20, ${GLASS_OPACITY})`,
  fillWarm: `rgba(22, 17, 12, ${GLASS_OPACITY + 0.04})`,
  fillCool: `rgba(16, 20, 18, ${GLASS_OPACITY - 0.04})`,
  hairline: 'rgba(255, 255, 255, 0.11)',
  hairlineHot: 'rgba(245, 158, 11, 0.35)',
  blur: 'blur(52px) saturate(180%)',
  radiusCard: 24,
  radiusPill: 18,
  shadowCard:
    '0 28px 64px rgba(0, 0, 0, 0.58), 0 2px 6px rgba(0, 0, 0, 0.35), inset 0 0.5px 0 rgba(255, 255, 255, 0.11)',
  shadowPill:
    '0 12px 32px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.30), inset 0 0.5px 0 rgba(255, 255, 255, 0.10)',
  sheen: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 38%)',
  ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const;

export const FOCUS = {
  base: '#f59e0b',
  light: '#fbbf24',
  bright: '#fde68a',
  dark: '#d97706',
} as const;

export const BREAK = {
  base: '#34d399',
  light: '#6ee7b7',
} as const;

export const TXT = {
  primary: '#f0f0f2',
  secondary: '#a0a0b0',
  muted: '#8585a0',
  dim: '#45455a',
} as const;

/** Window geometry — must match OVERLAY_W/H in electron/overlayWindow.ts */
export const WINDOW = { width: 420, height: 280, inset: 18 } as const;
