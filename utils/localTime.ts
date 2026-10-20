export const TIME_ZONE_COOKIE = 'fitnessjourni-timezone';

export const validTimeZone = (value?: string): string => {
  if (value) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: decodeURIComponent(value),
      }).resolvedOptions().timeZone;
    } catch {}
  }
  return 'UTC';
};

/** Calendar date and wall-clock time in the browser's IANA timezone, including DST. */
export const localTime = (now: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  return {
    today: `${part('year')}-${part('month')}-${part('day')}`,
    nowMinutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
};

/** Convert a session's local date/time into an instant without using the host timezone. */
export const localDateTimeMs = (date: string, time: string, timeZone: string) => {
  const wallClock = Date.parse(`${date}T${time}:00Z`);
  let instant = wallClock;
  for (let step = 0; step < 3; step++) {
    const { today, nowMinutes } = localTime(new Date(instant), timeZone);
    const displayed = Date.parse(`${today}T00:00:00Z`) + nowMinutes * 60_000;
    const correction = wallClock - displayed;
    if (correction === 0) break;
    instant += correction;
  }
  return instant;
};
