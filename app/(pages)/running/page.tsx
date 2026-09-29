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

export const metadata: Metadata = {
  title: 'Running — FitnessJourni',
  description: 'Group runs, pace and weekly attendance',
};

export const dynamic = 'force-dynamic';

const RunningPage = async () => {
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const today = toISODate(new Date());
  const { viewer, scope } = await readViewerContext();
  const [members, runs, latestRuns] = await Promise.all([
    getScopedMembers(scope),
    getRunsSince(earlier(startOfWeek(today), startOfMonth(today)), scope),
    getLatestRuns(scope),
  ]);

  return (
    <PageLayout>
      <PageHeader eyebrow="Running" title="Miles together, momentum shared" />

      <RunningDashboard
        members={viewerFirst(members, viewer.memberId)}
        runs={runs}
        latestRuns={latestRuns}
        tallies={tallyRuns(runs, today)}
        viewerId={viewer.memberId}
        today={today}
      />
    </PageLayout>
  );
};

export default RunningPage;
