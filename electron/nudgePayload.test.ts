import { describe, expect, it } from 'vitest';
import { buildNudgePayload, type NudgeLookup } from './nudgePayload';
import { IDLE_DEFAULTS, IDLE_FAST } from './idleWatcher';

const T0 = new Date(2026, 8, 23, 10, 0).getTime();
const action = { idleSince: T0, kickoffAt: T0 + 15 * 60_000 };

const known: NudgeLookup = {
  lastTask: () => '689742',
  taskTitle: (id) => (id === '689742' ? 'Automatizovať dokumentáciu' : null),
  raycastFocus: () => true,
};

describe('buildNudgePayload', () => {
  it('turns the action epochs into ISO strings', () => {
    const p = buildNudgePayload(action, IDLE_DEFAULTS, known);
    expect(p.kind).toBe('idle');
    expect(p.idleSince).toBe(new Date(T0).toISOString());
    expect(p.kickoffAt).toBe(new Date(T0 + 15 * 60_000).toISOString());
  });

  it('takes kickoffSeconds / snoozeSeconds / escalateMinutes from IDLE_DEFAULTS (120 / 900 / 15)', () => {
    const p = buildNudgePayload(action, IDLE_DEFAULTS, known);
    expect(p.kickoffSeconds).toBe(120);
    expect(p.snoozeSeconds).toBe(900);
    expect(p.escalateMinutes).toBe(15);
  });

  it('and from IDLE_FAST (20 / 30 / 1)', () => {
    const p = buildNudgePayload(action, IDLE_FAST, known);
    expect(p.kickoffSeconds).toBe(20);
    expect(p.snoozeSeconds).toBe(30);
    expect(p.escalateMinutes).toBe(1);
  });

  it('taskId + taskTitle come from the lookup (today\'s last session with a task)', () => {
    const p = buildNudgePayload(action, IDLE_DEFAULTS, known);
    expect(p.taskId).toBe('689742');
    expect(p.taskTitle).toBe('Automatizovať dokumentáciu');
    expect(p.raycastFocus).toBe(true);
  });

  it('no session with a task → null task, and the title lookup is never asked', () => {
    let asked = 0;
    const p = buildNudgePayload(action, IDLE_DEFAULTS, {
      lastTask: () => undefined,
      taskTitle: () => {
        asked++;
        return 'x';
      },
      raycastFocus: () => false,
    });
    expect(p.taskId).toBeNull();
    expect(p.taskTitle).toBeNull();
    expect(p.raycastFocus).toBe(false);
    expect(asked).toBe(0);
  });

  it('a throwing lookup degrades to nulls and raycastFocus false', () => {
    const boom = () => {
      throw new Error('db closed');
    };
    const p = buildNudgePayload(action, IDLE_DEFAULTS, { lastTask: boom, taskTitle: boom, raycastFocus: boom });
    expect(p.taskId).toBeNull();
    expect(p.taskTitle).toBeNull();
    expect(p.raycastFocus).toBe(false);
    expect(p.kickoffSeconds).toBe(120);
  });
});
