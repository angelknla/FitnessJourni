import { Landing } from '@components/Landing/Landing';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { WorkoutPlan } from '@components/WorkoutPlan/WorkoutPlan';
import { WorkoutTally } from '@components/WorkoutTally/WorkoutTally';
import { earlier, fromISODate, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getMembers } from '@/lib/data/members';
import { getWorkoutsSince, tallyWorkouts } from '@/lib/data/workouts';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Workouts — FitnessJourni',
  description: 'The four-day split, and who has trained this week',
};

export const dynamic = 'force-dynamic';

const dayMonth = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' });
const monthOnly = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const dayMonthFull = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const WorkoutsPage = async () => {
  // Gate before fetching — see the note in app/layout.tsx.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const now = new Date();
  const today = toISODate(now);
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  // A Sunday-start week can begin in the previous month, so fetch from whichever
  // boundary is earlier or the week's counts would be short.
  const [members, workouts, viewer] = await Promise.all([
    getMembers(),
    getWorkoutsSince(earlier(weekStart, monthStart)),
    readViewer(),
  ]);

  const tallies = tallyWorkouts(workouts, today);

  const weekEnd = fromISODate(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return (
    <PageLayout>
      <PageHeader eyebrow="Workouts" title="The split, and who has shown up" />

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>This week and month</h2>
        <WorkoutTally
          members={viewerFirst(members, viewer.memberId)}
          tallies={tallies}
          weekLabel={`${dayMonth.format(fromISODate(weekStart))} – ${dayMonthFull.format(weekEnd)}`}
          monthLabel={monthOnly.format(now)}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>The playbook split</h2>
        <p className={styles.note}>
          Four lifting days a week, plus cardio on Wednesday and Friday. Tap a session for the
          exercises, sets and cues.
        </p>
        <WorkoutPlan />
      </section>
    </PageLayout>
  );
};

export default WorkoutsPage;
