import { ArrowLeftIcon } from '@components/Icons/Icons';
import { Landing } from '@components/Landing/Landing';
import { ProfileView } from '@components/ProfileView/ProfileView';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getMembers } from '@/lib/data/members';
import { getProfile } from '@/lib/data/profile';
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

    const [members, viewer] = await Promise.all([getMembers(), readViewer()]);
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
        <div className={styles.page}>
            <Link href="/" className={styles.back}>
                <ArrowLeftIcon />
                Home
            </Link>

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
                canRemove={canRemoveMembers(viewer, members)}
            />
        </div>
    );
};

export default ProfilePage;