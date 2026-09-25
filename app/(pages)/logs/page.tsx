import { ArrowLeftIcon } from '@components/Icons/Icons';
import { Landing } from '@components/Landing/Landing';
import { LogsTable } from '@components/LogsTable/LogsTable';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { fromISODate, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import Link from 'next/link';
import { leaders, type Period, summarise } from '@/lib/aggregate';
import { getLogsSince } from '@/lib/data/logs';
import { getMembers } from '@/lib/data/members';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Logs — FitnessJourni',
  description: 'Compare steps, water, calories and protein across the group',
};

export const dynamic = 'force-dynamic';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

interface LogsPageProps {
  searchParams: Promise<{ period?: string }>;
}

const LogsPage = async ({ searchParams }: LogsPageProps) => {
  // Gate before fetching — see the note in app/layout.tsx.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const { period: raw } = await searchParams;
  const period: Period = raw === 'today' || raw === 'month' ? raw : 'week';

  const now = new Date();
  const today = toISODate(now);
  const from =
    period === 'today' ? today : period === 'week' ? startOfWeek(today) : startOfMonth(today);

  const [members, logs, viewer] = await Promise.all([
    getMembers(),
    getLogsSince(from),
    readViewer(),
  ]);

  const summaries = summarise(logs, from, today);

  const caption =
    period === 'today'
      ? `${dayMonth.format(now)}. Averages are hidden — over a single day they just repeat the total.`
      : period === 'week'
        ? `${dayMonth.format(fromISODate(from))} to ${dayMonth.format(now)}, a Sunday-start week. Averages are per day logged, which is why Days sits beside them.`
        : `${monthYear.format(now)} so far. Averages are per day logged, which is why Days sits beside them.`;

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        <ArrowLeftIcon />
        Home
      </Link>

      <header className={styles.head}>
        <p className={styles.eyebrow}>Logs</p>
        <h1 className={styles.title}>How everyone is doing</h1>
      </header>

      <nav className={styles.periods} aria-label="Period">
        {PERIODS.map((option) => (
          <Link
            key={option.key}
            href={`/logs?period=${option.key}`}
            className={styles.period}
            data-active={option.key === period}
            aria-current={option.key === period ? 'page' : undefined}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <LogsTable
        members={viewerFirst(members, viewer.memberId)}
        summaries={summaries}
        leaders={leaders(summaries)}
        showAverages={period !== 'today'}
        caption={caption}
      />

      <p className={styles.note}>
        A ★ marks whoever leads a column. Calories have no star on purpose — that is a budget to
        hit, not a number to win.
      </p>
    </div>
  );
};

export default LogsPage;
