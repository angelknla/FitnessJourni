import { describe, expect, it } from 'vitest';
import { localDateTimeMs, localTime, validTimeZone } from './localTime';

describe('local calendar time', () => {
  it('uses Wednesday in Bulgaria while UTC and London are still Tuesday', () => {
    const now = new Date('2026-10-20T21:40:00Z');
    expect(localTime(now, 'Europe/Sofia')).toEqual({ today: '2026-10-21', nowMinutes: 40 });
    expect(localTime(now, 'Europe/London')).toEqual({ today: '2026-10-20', nowMinutes: 1360 });
  });

  it('uses the previous date west of UTC and the next date east of UTC', () => {
    const now = new Date('2026-10-21T00:40:00Z');
    expect(localTime(now, 'America/Los_Angeles').today).toBe('2026-10-20');
    expect(localTime(now, 'Pacific/Auckland').today).toBe('2026-10-21');
  });

  it('follows daylight saving changes rather than a fixed offset', () => {
    expect(localTime(new Date('2026-10-25T00:30:00Z'), 'Europe/Sofia').nowMinutes).toBe(210);
    expect(localTime(new Date('2026-10-25T01:30:00Z'), 'Europe/Sofia').nowMinutes).toBe(210);
    expect(localDateTimeMs('2026-10-21', '07:00', 'Europe/Sofia')).toBe(
      Date.parse('2026-10-21T04:00:00Z')
    );
    expect(localDateTimeMs('2026-10-26', '07:00', 'Europe/Sofia')).toBe(
      Date.parse('2026-10-26T05:00:00Z')
    );
  });

  it('reads encoded browser timezone cookies and rejects invalid ones', () => {
    expect(validTimeZone('Europe%2FSofia')).toBe('Europe/Sofia');
    expect(validTimeZone('invalid')).toBe('UTC');
    expect(validTimeZone('%')).toBe('UTC');
  });
});
