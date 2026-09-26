import { Landing } from '@components/Landing/Landing';
import { LogsTable } from '@components/LogsTable/LogsTable';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import Link from 'next/link';
import { leaders, type Period, summarise } from '@/lib/aggregate';
import { getLogsSince } from '@/lib/data/logs';
import { getMembers } from '@/lib/data/members';
import { countWorkouts, getWorkoutsSince } from '@/lib/data/workouts';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Logs — FitnessJourni',
  description: 'Compare steps, water, nutrition and sleep across the group',
};

export const dynamic = 'force-dynamic';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

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

  const [members, logs, workouts, viewer] = await Promise.all([
    getMembers(),
    getLogsSince(from),
    getWorkoutsSince(from),
    readViewer(),
  ]);

  const summaries = summarise(logs, from, today);
  const workoutCounts = countWorkouts(workouts, from, today);

  return (
    <PageLayout>
      <PageHeader eyebrow="Logs" title="How everyone is doing" />

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
        workoutCounts={workoutCounts}
        leaders={leaders(summaries)}
        showAverages={period !== 'today'}
      />

      <p className={styles.note}>A ★ marks whoever leads a column.</p>
    </PageLayout>
  );
};

export default LogsPage;
