import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLocalTime } from './localTime';

const browser = vi.hoisted(() => ({ timeZone: 'Europe%2FSofia' }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: browser.timeZone }) }),
}));

afterEach(() => vi.useRealTimers());

describe('readLocalTime', () => {
  it('uses the browser timezone cookie for server date and time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T21:40:00Z'));
    expect(await readLocalTime()).toMatchObject({
      today: '2026-10-21',
      nowMinutes: 40,
      timeZone: 'Europe/Sofia',
    });
  });
});
