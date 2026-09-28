import { RAYCAST_BLOCK_CATEGORIES, type KickoffSource } from '../../types';

/** The kickoff takeover's words and numbers, pure (PHASE4_PLAN.md §3.3). */

/** Footer line: where this kickoff came from (K6). */
export function sourceLine(source: KickoffSource | null, escalateMinutes: number | null): string {
  switch (source) {
    case 'auto':
      return escalateMinutes ? `Started automatically after ${escalateMinutes}m idle` : 'Started automatically';
    case 'nudge':
      return 'Started from the nudge';
    case 'deeplink':
      return 'Started from Raycast';
    default:
      return 'Started from Now';
  }
}

/** Header pill: what Drip asked Raycast Focus to do (K5; Raycast has no status API). */
export function raycastLine(active: boolean): string {
  return active ? `Raycast Focus on · ${RAYCAST_BLOCK_CATEGORIES.join(', ')} blocked` : 'Raycast Focus off';
}

/** `1:37` — no leading zero; kickoffs are under ten minutes (K4). */
export function formatKickoff(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const rest = s % 60;
  return `${Math.floor(s / 60)}:${rest < 10 ? `0${rest}` : rest}`;
}

/** Elapsed share of the warmup, clamped to 0..1. */
export function progress(remaining: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remaining / total));
}
