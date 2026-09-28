import { describe, it, expect } from 'vitest';
import { formatMinutes, parseDbTimestamp, relativeTime } from './time';

describe('formatMinutes', () => {
  it('formats minutes and hours compactly', () => {
    expect(formatMinutes(25)).toBe('25m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(75)).toBe('1h 15m');
    expect(formatMinutes(0)).toBe('0m');
  });
});

describe('parseDbTimestamp', () => {
  it('reads SQLite datetime values as UTC', () => {
    expect(parseDbTimestamp('2026-09-25 08:00:00')).toBe(Date.parse('2026-09-25T08:00:00Z'));
  });

  it('reads ISO strings as-is', () => {
    expect(parseDbTimestamp('2026-09-25T08:00:00.000Z')).toBe(Date.parse('2026-09-25T08:00:00.000Z'));
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-09-25T12:00:00Z');
  it('buckets ages', () => {
    expect(relativeTime('2026-09-25 11:30:00', now)).toBe('Just now');
    expect(relativeTime('2026-09-25T09:00:00Z', now)).toBe('3h');
    expect(relativeTime('2026-09-24T10:00:00Z', now)).toBe('Yesterday');
    expect(relativeTime('2026-09-21T12:00:00Z', now)).toBe('4d');
  });
});
