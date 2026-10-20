import { Landing } from '@components/Landing/Landing';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { ProfileView } from '@components/ProfileView/ProfileView';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { fromISODate, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getAccount } from '@/lib/data/accounts';
import { getLogsSince } from '@/lib/data/logs';
import { getMembers } from '@/lib/data/members';
import { getProfile } from '@/lib/data/profile';
import { readViewerContext } from '@/lib/data/viewerScope';
import { getWorkoutsSince } from '@/lib/data/workouts';
import { readLocalTime } from '@/lib/localTime';
import { buildMedalBoards, medalFetchStart } from '@/lib/medals';
import { canRemoveMembers } from '@/lib/ownership';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Profile — FitnessJourni',
  description: 'Measurements, goals and monthly progress',
};

interface ProfilePageProps {
  searchParams: Promise<{ medalDate?: string }>;
}

const ProfilePage = async ({ searchParams }: ProfilePageProps) => {
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const { today } = await readLocalTime();
  const { medalDate: requestedMedalDate } = await searchParams;
  const medalDate =
    requestedMedalDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedMedalDate) &&
    toISODate(fromISODate(requestedMedalDate)) === requestedMedalDate &&
    requestedMedalDate <= today
      ? requestedMedalDate
      : today;
  const medalFrom = medalFetchStart(medalDate);
  const { viewer, activeGroup, scope } = await readViewerContext();

  /*
   * Everyone here, not just this group: accent colours are unique across the whole
   * app, and the Groups panel has to be able to name someone who has only been
   * invited and is therefore not a member yet.
   */
  const [members, logs, workouts] = await Promise.all([
    getMembers(true),
    getLogsSince(medalFrom, scope),
    getWorkoutsSince(medalFrom, scope),
  ]);
  const member = members.find((item) => item.id === viewer.memberId) ?? null;
  const [profileData, account] = member
    ? await Promise.all([getProfile(member.id), getAccount(member.id)])
    : [null, null];

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
      <PageHeader eyebrow="Profile" title="Your numbers, over time" />

      <ProfileView
        key={`${member?.id}:${today}`}
        members={members}
        member={member}
        profile={profile}
        account={account}
        measurements={profileData?.measurements ?? []}
        currentDate={today}
        medalDate={medalDate}
        medalBoards={buildMedalBoards(
          logs,
          workouts,
          medalDate,
          Object.fromEntries(members.map((item) => [item.id, item.targets])),
          today
        )}
        canRemoveOthers={canRemoveMembers(viewer, members)}
        activeGroupName={activeGroup?.name ?? null}
      />
    </PageLayout>
  );
};

export default ProfilePage;
