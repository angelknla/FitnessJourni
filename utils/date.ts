const pad = (value: number) => String(value).padStart(2, '0');

export const toISODate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Parsed at midday so daylight-saving shifts can never roll the day over. */
export const fromISODate = (iso: string) => new Date(`${iso}T12:00:00`);

export const minutesOfTime = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Postgres returns `time` as HH:MM:SS; the UI only ever wants HH:MM. */
export const toShortTime = (time: string) => time.slice(0, 5);

export const buildDays = (startISO: string, count: number) => {
  const start = fromISODate(startISO);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    return { iso: toISODate(date), date, offset };
  });
};
