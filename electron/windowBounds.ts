export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How much of the window must sit on a display for it to count as reachable. */
const MIN_VISIBLE_PX = 100;

function overlaps(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w >= MIN_VISIBLE_PX && h >= MIN_VISIBLE_PX;
}

/**
 * Bounds that put the main window back on a display, or null when it is
 * already reachable. macOS can leave a hidden window at a 0×0 size or off every
 * display (a window hidden in fullscreen, a display that went away); show()
 * then "succeeds" and nothing appears.
 */
export function recoverBounds(
  bounds: Rect,
  workAreas: Rect[],
  fallback: { width: number; height: number; minWidth: number; minHeight: number },
): Rect | null {
  if (workAreas.length === 0) return null;
  const tooSmall = bounds.width < fallback.minWidth || bounds.height < fallback.minHeight;
  const reachable = workAreas.some((area) => overlaps(bounds, area));
  if (!tooSmall && reachable) return null;

  const area = workAreas[0];
  const width = Math.min(Math.max(bounds.width, fallback.width), area.width);
  const height = Math.min(Math.max(bounds.height, fallback.height), area.height);
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
  };
}
