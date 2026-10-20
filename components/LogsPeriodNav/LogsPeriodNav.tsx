'use client';

import { CalendarIcon } from '@components/Icons/Icons';
import { fromISODate } from '@utils/date';
import Link from '@components/NavigationLink/NavigationLink';
import { useRouter } from 'next/navigation';
import type { Period } from '@/lib/aggregate';

import styles from './LogsPeriodNav.module.css';

interface LogsPeriodNavProps {
    period: Period;
    selectedDate: string | null;
    today: string;
}

const periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
];

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export const LogsPeriodNav = ({ period, selectedDate, today }: LogsPeriodNavProps) => {
    const router = useRouter();

    return (
        <nav className={styles.periods} aria-label="Period">
            {periods.map((option) => (
                <Link
                    key={option.key}
                    href={`/logs?period=${option.key}`}
                    className={styles.period}
                    data-active={!selectedDate && option.key === period}
                    aria-current={!selectedDate && option.key === period ? 'page' : undefined}
                >
                    {option.label}
                </Link>
            ))}
            <label
                className={`${styles.dateControl} ${selectedDate ? styles.dateActive : ''}`}
                title="View logs for a date"
            >
                <CalendarIcon size={18} />
                {selectedDate && (
                    <span aria-hidden="true">{shortDate.format(fromISODate(selectedDate))}</span>
                )}
                <input
                    type="date"
                    aria-label="View logs for a date"
                    max={today}
                    value={selectedDate ?? ''}
                    onChange={(event) => {
                        const date = event.target.value;
                        if (date) router.push(`/logs?date=${date}`);
                    }}
                />
            </label>
        </nav>
    );
};