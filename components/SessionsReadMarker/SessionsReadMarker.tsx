'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { markSessionsRead } from '@/app/actions';

export const SessionsReadMarker = () => {
    const router = useRouter();

    useEffect(() => {
        void markSessionsRead().then(() => router.refresh());
    }, [router]);

    return null;
};
