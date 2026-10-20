'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const RESUME_AFTER_MS = 30_000;

/** One refresh after a longer absence, including restoration from browser history. */
export const AppResume = () => {
  const router = useRouter();

  useEffect(() => {
    let lastActiveAt = Date.now();
    const resume = () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return;
      const now = Date.now();
      if (now - lastActiveAt >= RESUME_AFTER_MS) router.refresh();
      lastActiveAt = now;
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'hidden') lastActiveAt = Date.now();
      else resume();
    };

    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pageshow', resume);
    window.addEventListener('online', resume);
    return () => {
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('online', resume);
    };
  }, [router]);

  return null;
};
