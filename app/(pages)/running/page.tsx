import { Landing } from '@components/Landing/Landing';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { RunningDashboard } from '@components/RunningDashboard/RunningDashboard';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { earlier, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getMembers } from '@/lib/data/members';
import { getLatestRuns, getRunsSince, tallyRuns } from '@/lib/data/runs';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
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
    const [members, runs, latestRuns, viewer] = await Promise.all([
        getMembers(),
        getRunsSince(earlier(startOfWeek(today), startOfMonth(today))),
        getLatestRuns(),
        readViewer(),
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