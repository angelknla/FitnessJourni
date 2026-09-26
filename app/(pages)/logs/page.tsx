import { Landing } from '@components/Landing/Landing';
import { LogsPeriodNav } from '@components/LogsPeriodNav/LogsPeriodNav';
import { LogsTable } from '@components/LogsTable/LogsTable';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { fromISODate, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { awardMedals, type Period, summarise } from '@/lib/aggregate';
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

interface LogsPageProps {
  searchParams: Promise<{ period?: string; date?: string }>;
}

const LogsPage = async ({ searchParams }: LogsPageProps) => {
  // Gate before fetching — see the note in app/layout.tsx.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const { period: rawPeriod, date: rawDate } = await searchParams;
  const now = new Date();
  const today = toISODate(now);
  const selectedDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    && toISODate(fromISODate(rawDate)) === rawDate && rawDate <= today
    ? rawDate
    : null;
  const period: Period = rawPeriod === 'today' || rawPeriod === 'month' ? rawPeriod : 'week';
  const from = selectedDate
    ?? (period === 'today' ? today : period === 'week' ? startOfWeek(today) : startOfMonth(today));
  const through = selectedDate ?? today;

  const [members, logs, workouts, viewer] = await Promise.all([
    getMembers(),
    getLogsSince(from),
    getWorkoutsSince(from),
    readViewer(),
  ]);

  const summaries = summarise(logs, from, through);
  const workoutCounts = countWorkouts(workouts, from, through);

  return (
    <PageLayout>
      <PageHeader eyebrow="Logs" title="How everyone is doing" />

      <LogsPeriodNav period={period} selectedDate={selectedDate} today={today} />

      <LogsTable
        members={viewerFirst(members, viewer.memberId)}
        summaries={summaries}
        workoutCounts={workoutCounts}
        medals={awardMedals(summaries, workoutCounts)}
        showAverages={!selectedDate && period !== 'today'}
      />

      <p className={styles.note}>Medals show each column&apos;s gold, silver and bronze places.</p>
    </PageLayout>
  );
};

export default LogsPage;
