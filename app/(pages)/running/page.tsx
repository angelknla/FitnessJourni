import { ArrowLeftIcon } from '@components/Icons/Icons';
import { Landing } from '@components/Landing/Landing';
import { RunningDashboard } from '@components/RunningDashboard/RunningDashboard';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { earlier, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getMembers } from '@/lib/data/members';
import { getRunsSince, tallyRuns } from '@/lib/data/runs';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

import styles from './page.module.css';

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
    const [members, runs, viewer] = await Promise.all([
        getMembers(),
        getRunsSince(earlier(startOfWeek(today), startOfMonth(today))),
        readViewer(),
    ]);

    return (
        <div className={styles.page}>
            <Link href="/" className={styles.back}>
                <ArrowLeftIcon />
                Home
            </Link>

            <header className={styles.head}>
                <p className={styles.eyebrow}>Running</p>
                <h1 className={styles.title}>Miles together, momentum shared</h1>
            </header>

            <RunningDashboard
                members={viewerFirst(members, viewer.memberId)}
                runs={runs}
                tallies={tallyRuns(runs, today)}
                viewerId={viewer.memberId}
                today={today}
            />
        </div>
    );
};

export default RunningPage;