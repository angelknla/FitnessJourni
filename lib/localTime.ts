import { localTime, TIME_ZONE_COOKIE, validTimeZone } from '@utils/localTime';
import { cookies } from 'next/headers';
import { cache } from 'react';

/** Request-scoped: calendar boundaries belong to the viewer, never the server host. */
export const readLocalTime = cache(async () => {
  const timeZone = validTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value);
  const now = new Date();
  return { ...localTime(now, timeZone), now, timeZone };
});
