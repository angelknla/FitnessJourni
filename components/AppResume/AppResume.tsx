'use client';

import { toISODate } from '@utils/date';
import { TIME_ZONE_COOKIE } from '@utils/localTime';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const RESUME_AFTER_MS = 30_000;

/** Refresh on local day/timezone changes or after a longer absence. */
export const AppResume = ({
  initialDate,
  timeZone,
}: {
  initialDate?: string;
  timeZone?: string;
}) => {
  const router = useRouter();

  useEffect(() => {
    let lastActiveAt = Date.now();
    let lastDate = initialDate ?? toISODate(new Date());
    let lastTimeZone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    let midnightTimer: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      clearTimeout(midnightTimer);
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 50);
      midnightTimer = setTimeout(() => {
        resume();
      }, midnight.getTime() - now.getTime());
    };
    const resume = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) {
        scheduleMidnight();
        return;
      }
      const now = Date.now();
      const date = toISODate(new Date(now));
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // biome-ignore lint/suspicious/noDocumentCookie: Write synchronously before refreshing the server-rendered date.
      document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; Path=/; Max-Age=31536000; SameSite=Lax`;
      if (date !== lastDate || zone !== lastTimeZone || now - lastActiveAt >= RESUME_AFTER_MS) {
        router.refresh();
      }
      lastDate = date;
      lastTimeZone = zone;
      lastActiveAt = now;
      scheduleMidnight();
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'hidden') lastActiveAt = Date.now();
      else resume();
    };

    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pageshow', resume);
    window.addEventListener('online', resume);
    resume();
    return () => {
      clearTimeout(midnightTimer);
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('online', resume);
    };
  }, [router, initialDate, timeZone]);

  return null;
};
