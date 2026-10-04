'use client';

import { CrossIcon } from '@components/Icons/Icons';
import { toISODate } from '@utils/date';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import styles from './SessionBanner.module.css';

export const WeightReminderBanner = ({ viewerId }: { viewerId: string | null }) => {
    const [reminderDate, setReminderDate] = useState<string | null>(null);
    const storageKey = `fj_dismissed_weight_reminder:${viewerId}`;

    useEffect(() => {
        if (!viewerId) {
            setReminderDate(null);
            return;
        }

        let timeout: ReturnType<typeof setTimeout>;
        const updateReminder = () => {
            const now = new Date();
            const today = toISODate(now);
            let dismissedDate: string | null = null;
            try {
                dismissedDate = window.localStorage.getItem(storageKey);
            } catch { }
            setReminderDate(now.getDay() === 0 && dismissedDate !== today ? today : null);
            const midnight = new Date(now);
            midnight.setHours(24, 0, 0, 0);
            timeout = setTimeout(updateReminder, midnight.getTime() - now.getTime());
        };

        updateReminder();
        return () => clearTimeout(timeout);
    }, [viewerId, storageKey]);

    const dismiss = () => {
        setReminderDate(null);
        try {
            if (reminderDate) window.localStorage.setItem(storageKey, reminderDate);
        } catch { }
    };

    if (!viewerId || !reminderDate) return null;

    return (
        <aside className={styles.banner} aria-label="Weekly weight reminder">
            <div className={styles.body}>
                <p className={styles.eyebrow}>Weekly check-in</p>
                <p className={styles.headline}>Time to log your weekly weight</p>
                <Link href="/profile#log-weight" className={styles.link}>
                    Log your weight
                </Link>
            </div>
            <button
                type="button"
                className={styles.close}
                onClick={dismiss}
                aria-label="Dismiss weight reminder"
            >
                <CrossIcon size={13} />
            </button>
        </aside>
    );
};