/**
 * Words for the idle nudge pause, shared by the tray menu (main) and the Now
 * header (renderer): `until 14:30` on the same local day, `until tomorrow`
 * when the pause ends on a later one (Rest of day after work hours, or a
 * pause read back after midnight).
 */
export function formatPausedUntil(until: number, now: number): string {
  const end = new Date(until);
  const today = new Date(now);
  const sameDay =
    end.getFullYear() === today.getFullYear() && end.getMonth() === today.getMonth() && end.getDate() === today.getDate();
  if (!sameDay) return 'until tomorrow';
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `until ${pad(end.getHours())}:${pad(end.getMinutes())}`;
}
