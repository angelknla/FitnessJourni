import { describe, expect, it } from 'vitest';
import {
  buildDays,
  clamp,
  earlier,
  fromISODate,
  minutesOfTime,
  startOfMonth,
  startOfWeek,
  toISODate,
  toShortTime,
} from './date';

describe('toISODate', () => {
  it('zero-pads month and day', () => {
    expect(toISODate(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('fromISODate', () => {
  it('round-trips through toISODate', () => {
    expect(toISODate(fromISODate('2026-09-25'))).toBe('2026-09-25');
  });

  it('parses at midday, so a DST shift cannot roll the day over', () => {
    // Europe/London springs forward on 2026-03-29. Parsed at 00:00 a negative
    // offset could land on the 28th; at midday there is no such risk.
    expect(fromISODate('2026-03-29').getDate()).toBe(29);
    expect(fromISODate('2026-10-25').getDate()).toBe(25);
  });
});

describe('buildDays', () => {
  it('returns consecutive days with offsets', () => {
    const days = buildDays('2026-09-25', 3);

    expect(days.map((day) => day.iso)).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
    expect(days.map((day) => day.offset)).toEqual([0, 1, 2]);
  });

  it('does not skip or repeat a day across a DST boundary', () => {
    expect(buildDays('2026-03-28', 3).map((day) => day.iso)).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
    ]);
  });
});

describe('toShortTime', () => {
  it("trims Postgres's HH:MM:SS to HH:MM", () => {
    expect(toShortTime('07:30:00')).toBe('07:30');
  });
});

describe('minutesOfTime', () => {
  it('converts HH:MM to minutes past midnight', () => {
    expect(minutesOfTime('06:30')).toBe(390);
  });
});

describe('clamp', () => {
  it('bounds a value both ways', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('startOfWeek', () => {
  it('returns the Monday of that week', () => {
    // Fri 25 Sep 2026 -> Mon 21 Sep 2026.
    expect(startOfWeek('2026-09-25')).toBe('2026-09-21');
  });

  it('returns the same day when it is already a Monday', () => {
    expect(startOfWeek('2026-09-21')).toBe('2026-09-21');
  });

  it('places Sunday at the end of the preceding Monday-start week', () => {
    expect(startOfWeek('2026-09-20')).toBe('2026-09-14');
  });

  it('crosses into the previous month when the week straddles one', () => {
    // Thu 1 Oct 2026 -> Mon 28 Sep 2026.
    expect(startOfWeek('2026-10-01')).toBe('2026-09-28');
  });

  it('keeps Saturday in the week beginning the preceding Monday', () => {
    expect(startOfWeek('2026-09-12')).toBe('2026-09-07');
  });
});

describe('startOfMonth', () => {
  it('returns the first of the month', () => {
    expect(startOfMonth('2026-09-25')).toBe('2026-09-01');
  });
});

describe('earlier', () => {
  it('returns whichever ISO date comes first', () => {
    expect(earlier('2026-09-27', '2026-10-01')).toBe('2026-09-27');
    expect(earlier('2026-10-01', '2026-09-27')).toBe('2026-09-27');
  });
});
