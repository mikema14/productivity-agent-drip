import { describe, expect, it } from 'vitest';
import { explain, idleFor, kickoffLength, pauseLength, takeoverIn } from './nudgeCopy';

const now = new Date(2026, 8, 23, 10, 0).getTime();
const at = (deltaSec: number) => new Date(now + deltaSec * 1000).toISOString();

describe('nudgeCopy.takeoverIn', () => {
  it('formats the seconds until the kickoff as m:ss', () => {
    expect(takeoverIn(at(872), now)).toBe('14:32');
    expect(takeoverIn(at(25), now)).toBe('0:25');
    expect(takeoverIn(at(60), now)).toBe('1:00');
  });

  it('rounds sub-second remainders and floors at 0:00 once the moment has passed', () => {
    expect(takeoverIn(at(871.6), now)).toBe('14:32');
    expect(takeoverIn(at(0), now)).toBe('0:00');
    expect(takeoverIn(at(-30), now)).toBe('0:00');
  });
});

describe('nudgeCopy.idleFor', () => {
  it('shows minutes, or seconds below a minute', () => {
    expect(idleFor(at(-12 * 60), now)).toBe('12m');
    expect(idleFor(at(-40), now)).toBe('40s');
  });
});

describe('nudgeCopy.pauseLength', () => {
  it('15m, 1h for whole hours, seconds below a minute (DRIP_IDLE_FAST)', () => {
    expect(pauseLength(900)).toBe('15m');
    expect(pauseLength(3600)).toBe('1h');
    expect(pauseLength(7200)).toBe('2h');
    expect(pauseLength(30)).toBe('30s');
    expect(pauseLength(60)).toBe('1m');
    expect(pauseLength(5400)).toBe('90m');
  });
});

describe('nudgeCopy.kickoffLength', () => {
  it('spells whole minutes and plain seconds', () => {
    expect(kickoffLength(120)).toBe('2-minute');
    expect(kickoffLength(20)).toBe('20-second');
    expect(kickoffLength(90)).toBe('90-second');
    expect(kickoffLength(60)).toBe('1-minute');
  });
});

describe('nudgeCopy.explain', () => {
  it('Raycast + task: the mockup sentence with the id as its own part', () => {
    expect(explain({ kickoffSeconds: 120, taskId: '689742', raycastFocus: true })).toEqual({
      before: 'Then Raycast Focus turns on and a 2-minute kickoff starts on ',
      taskId: '689742',
      after: '.',
    });
  });

  it('no Raycast: drops the Raycast clause', () => {
    expect(explain({ kickoffSeconds: 120, taskId: '689742', raycastFocus: false })).toEqual({
      before: 'Then a 2-minute kickoff starts on ',
      taskId: '689742',
      after: '.',
    });
  });

  it('no task: names the last task without an id', () => {
    expect(explain({ kickoffSeconds: 120, taskId: null, raycastFocus: true })).toEqual({
      before: 'Then Raycast Focus turns on and a 2-minute kickoff starts on your last task.',
      taskId: null,
      after: '',
    });
  });

  it('neither: the bare sentence, with the FAST length spelled in seconds', () => {
    expect(explain({ kickoffSeconds: 20, taskId: null, raycastFocus: false })).toEqual({
      before: 'Then a 20-second kickoff starts.',
      taskId: null,
      after: '',
    });
  });
});
