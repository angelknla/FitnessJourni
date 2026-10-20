import { Home } from '@components/Home/Home';
import { Landing } from '@components/Landing/Landing';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import { earlier, fromISODate, startOfMonth, startOfWeek, toISODate } from '@utils/date';
import type { Metadata } from 'next';
import { getMemberships, getPendingSummary } from '@/lib/data/groups';
import { getLogsSince } from '@/lib/data/logs';
import { getScopedMembers } from '@/lib/data/members';
import { readViewerContext } from '@/lib/data/viewerScope';
import { getWorkoutsSince, tallyWorkouts } from '@/lib/data/workouts';
import { canManageGroup } from '@/lib/groups';
import { readLocalTime } from '@/lib/localTime';
import { buildMedalBoards, medalFetchStart } from '@/lib/medals';
import { viewerFirst } from '@/lib/ownership';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Home — FitnessJourni',
  description: 'Shared daily steps, water, nutrition, workouts and sleep',
};

interface HomepageProps {
  searchParams: Promise<{ date?: string; medalDate?: string }>;
}

const resolveHomeDate = (today: string, requestedDate?: string) => {
  const date =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    toISODate(fromISODate(requestedDate)) === requestedDate &&
    requestedDate <= today
      ? requestedDate
      : today;
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fromISODate(date));

  return { date, dateLabel, today };
};

const Homepage = async ({ searchParams }: HomepageProps) => {
  // Before any fetch: a locked visitor must not cause member data to be loaded,
  // because it would be serialised into the RSC payload even if never displayed.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const { date: requestedDate, medalDate: requestedMedalDate } = await searchParams;
  const { today } = await readLocalTime();
  const { date, dateLabel } = resolveHomeDate(today, requestedDate);
  const medalDate = requestedMedalDate ? resolveHomeDate(today, requestedMedalDate).date : date;
  const yesterday = fromISODate(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const datePickerLabel =
    date === today
      ? 'Today'
      : date === toISODate(yesterday)
        ? 'Yesterday'
        : new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
          }).format(fromISODate(date));

  const medalFrom = medalFetchStart(medalDate);
  const dashboardWorkoutFrom = earlier(startOfWeek(date), startOfMonth(date));
  const workoutFrom = earlier(dashboardWorkoutFrom, medalFrom);

  // Which group this browser is looking at, resolved from an accepted membership.
  const { viewer, activeGroup, scope } = await readViewerContext();

  const [members, medalLogs, workouts, pending] = await Promise.all([
    getScopedMembers(scope),
    // This range also includes the selected day's own log and group comparisons.
    getLogsSince(earlier(date, medalFrom), scope),
    getWorkoutsSince(workoutFrom, scope),
    // Feeds the badge's marker: invitations for them, plus requests they can approve.
    viewer.memberId
      ? getMemberships(viewer.memberId).then((memberships) =>
          getPendingSummary(
            viewer.memberId as string,
            memberships
              .filter((membership) => canManageGroup(membership.role))
              .map((membership) => membership.group.id)
          )
        )
      : Promise.resolve({ invitations: 0, requests: 0 }),
  ]);
  const dashboardWorkouts = workouts.filter((workout) => workout.date >= dashboardWorkoutFrom);

  const visibleLogs = Object.fromEntries(
    medalLogs.filter((log) => log.date === date).map((log) => [log.memberId, log])
  );

  return (
    <Home
      members={viewerFirst(members, viewer.memberId)}
      logs={visibleLogs}
      workouts={workouts}
      medalLogs={medalLogs}
      tallies={tallyWorkouts(dashboardWorkouts, date)}
      medalBoards={
        // Medals compare a group. In Personal mode there is nobody to compare with.
        activeGroup
          ? buildMedalBoards(
              medalLogs,
              workouts,
              medalDate,
              Object.fromEntries(members.map((member) => [member.id, member.targets])),
              today
            )
          : []
      }
      medalDate={medalDate}
      date={date}
      today={today}
      datePickerLabel={datePickerLabel}
      dateLabel={dateLabel}
      viewerId={viewer.memberId}
      personalMode={!activeGroup}
      activeGroupName={activeGroup?.name ?? null}
      activeGroupId={activeGroup?.id ?? null}
      activeGroupImage={activeGroup?.imagePath ?? null}
      pendingGroupCount={pending.invitations + pending.requests}
    />
  );
};

export default Homepage;
