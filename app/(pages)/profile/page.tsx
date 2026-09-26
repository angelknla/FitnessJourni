import { Landing } from '@components/Landing/Landing';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { ProfileView } from '@components/ProfileView/ProfileView';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getLogsSince } from '@/lib/data/logs';
import { getMembers } from '@/lib/data/members';
import { getProfile } from '@/lib/data/profile';
import { getWorkoutsSince } from '@/lib/data/workouts';
import { buildMedalBoards, medalFetchStart } from '@/lib/medals';
import { canRemoveMembers } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

import styles from './page.module.css';

export const metadata: Metadata = {
    title: 'Profile — FitnessJourni',
    description: 'Measurements, goals and monthly progress',
};

export const dynamic = 'force-dynamic';

const ProfilePage = async () => {
    if (!(await isUnlocked())) {
        return <Landing />;
    }

    if (!isSupabaseConfigured()) {
        return <SetupNotice />;
    }

    const today = toISODate(new Date());
    const medalFrom = medalFetchStart(today);
    const [members, viewer, logs, workouts] = await Promise.all([
        getMembers(),
        readViewer(),
        getLogsSince(medalFrom),
        getWorkoutsSince(medalFrom),
    ]);
    const member = members.find((item) => item.id === viewer.memberId) ?? null;
    const profileData = member ? await getProfile(member.id) : null;
    const profile =
        profileData?.profile ??
        (member
            ? {
                memberId: member.id,
                age: null,
                heightCm: null,
                targetWeightKg: null,
                targetBmi: null,
            }
            : null);

    return (
        <PageLayout>
            <header className={styles.head}>
                <p>Profile</p>
                <h1>Your numbers, over time</h1>
            </header>

            <ProfileView
                members={members}
                member={member}
                profile={profile}
                measurements={profileData?.measurements ?? []}
                currentMonth={new Date().toISOString().slice(0, 7)}
                medalBoards={buildMedalBoards(logs, workouts, today)}
                canRemoveOthers={canRemoveMembers(viewer, members)}
            />
        </PageLayout>
    );
};

export default ProfilePage;