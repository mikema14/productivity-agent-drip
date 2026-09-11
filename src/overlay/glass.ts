/**
 * Single source of truth for the overlay's surface.
 *
 * A transparent Electron BrowserWindow cannot blur the desktop behind it —
 * `backdrop-filter` only blurs content within the same window — so rather than
 * imitate glass badly, this commits to a near-solid dark HUD in the spirit of
 * macOS's own screenshot toolbar: crisp edge, tight shadow, high contrast on
 * any wallpaper. The amber glow still renders as a layer behind the pane.
 */
export const GLASS_OPACITY = 0.9;

export const GLASS = {
  fill: `rgba(16, 16, 20, ${GLASS_OPACITY})`,
  fillWarm: `rgba(22, 17, 12, ${GLASS_OPACITY + 0.04})`,
  fillCool: `rgba(16, 20, 18, ${GLASS_OPACITY - 0.04})`,
  // A firmer edge than glass would use — it's what separates the HUD from a
  // bright wallpaper.
  hairline: 'rgba(255, 255, 255, 0.16)',
  hairlineHot: 'rgba(245, 158, 11, 0.45)',
  blur: 'blur(52px) saturate(180%)',
  radiusCard: 24,
  radiusPill: 18,
  // Tighter and lighter than the mock's — a big soft black shadow reads as a
  // smudge on a light desktop.
  shadowCard:
    '0 16px 40px rgba(0, 0, 0, 0.34), 0 2px 8px rgba(0, 0, 0, 0.22), inset 0 0.5px 0 rgba(255, 255, 255, 0.14)',
  shadowPill:
    '0 8px 22px rgba(0, 0, 0, 0.30), 0 1px 4px rgba(0, 0, 0, 0.20), inset 0 0.5px 0 rgba(255, 255, 255, 0.14)',
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

/**
 * Window geometry — must match OVERLAY_W/H in electron/overlayWindow.ts.
 * `inset` has to exceed the shadow's blur + offset, or the window edge clips it
 * into a hard dark line.
 */
export const WINDOW = { width: 560, height: 400, inset: 44 } as const;

/** Card width. Sized up from 384 — the overlay was too easy to overlook. */
export const CARD_W = 440;

/** Height of the full-width top-edge attention strip window. */
export const EDGE_H = 26;
