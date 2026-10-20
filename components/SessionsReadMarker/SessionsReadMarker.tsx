'use client';

import { useEffect, useRef } from 'react';
import { markSessionsRead } from '@/app/actions';

export const SessionsReadMarker = () => {
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current) return;
    marked.current = true;
    void markSessionsRead().catch(() => {
      marked.current = false;
    });
  }, []);

  return null;
};
