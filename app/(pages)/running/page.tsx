import { Landing } from '@components/Landing/Landing';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { RunningDashboard } from '@components/RunningDashboard/RunningDashboard';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { earlier, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getScopedMembers } from '@/lib/data/members';
import { getLatestRuns, getRunsSince, tallyRuns } from '@/lib/data/runs';
import { readViewerContext } from '@/lib/data/viewerScope';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import type { GroupRun } from '@/types/fitness';

export const metadata: Metadata = {
  title: 'Running — FitnessJourni',
  description: 'Group runs, pace and weekly attendance',
};

export const dynamic = 'force-dynamic';

/** How many recent runs the dashboard shows. */
const LATEST_RUNS = 3;

const RunningPage = async () => {
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const today = toISODate(new Date());
  const { viewer, scope } = await readViewerContext();
  const [members, groupRuns, groupLatest] = await Promise.all([
    getScopedMembers(scope),
    getRunsSince(earlier(startOfWeek(today), startOfMonth(today)), scope),
    // Fetched wider than needed because the filter below thins it out.
    getLatestRuns(scope, LATEST_RUNS * 6),
  ]);

  /*
   * A run is only this person's if they were on it. Unlike a log or a workout —
   * yours alone, and shared with the group — a run is an event, and one the viewer
   * was not on is somebody else's outing rather than their record of it.
   */
  const ranIt = (run: GroupRun) =>
    viewer.memberId !== null &&
    (run.attendeeIds.includes(viewer.memberId) || run.createdBy === viewer.memberId);

  const runs = groupRuns.filter(ranIt);
  const latestRuns = groupLatest.filter(ranIt).slice(0, LATEST_RUNS);

  /*
   * Runs by person stays group-wide, counted from everyone's runs rather than from
   * the filtered list. Someone who has not run sees an empty history and still sees
   * what the others have done — which is the comparison the page is for.
   */
  const tallies = tallyRuns(groupRuns, today);

  return (
    <PageLayout>
      <PageHeader eyebrow="Running" title="Miles together, momentum shared" />

      <RunningDashboard
        members={viewerFirst(members, viewer.memberId)}
        runs={runs}
        latestRuns={latestRuns}
        tallies={tallies}
        viewerId={viewer.memberId}
        today={today}
      />
    </PageLayout>
  );
};

export default RunningPage;
