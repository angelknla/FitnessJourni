import { GroupsPanel } from '@components/GroupsPanel/GroupsPanel';
import { Landing } from '@components/Landing/Landing';
import { PageHeader } from '@components/PageHeader/PageHeader';
import { PageLayout } from '@components/PageLayout/PageLayout';
import { SetupNotice } from '@components/SetupNotice/SetupNotice';
import type { Metadata } from 'next';
import {
  getInvitationsForMember,
  getJoinRequestsForMember,
  getMembersForGroups,
  getMemberships,
  getPendingJoinRequests,
} from '@/lib/data/groups';
import { getMembers } from '@/lib/data/members';
import { readViewerContext } from '@/lib/data/viewerScope';
import { canManageGroup } from '@/lib/groups';
import { isUnlocked } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Groups — FitnessJourni',
  description: 'Who you share your training with, and who can see what',
};

const GroupsPage = async () => {
  // Gate before fetching — see the note in app/layout.tsx.
  if (!(await isUnlocked())) {
    return <Landing />;
  }

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const { viewer, activeGroup } = await readViewerContext();
  if (!viewer.memberId) {
    return <Landing />;
  }

  const memberId = viewer.memberId;
  const memberships = await getMemberships(memberId);
  const managedGroupIds = memberships
    .filter((membership) => canManageGroup(membership.role))
    .map((membership) => membership.group.id);

  /*
   * Everyone, not just one group: each section names its own members, and an
   * invitation has to be able to name someone who is not a member yet.
   */
  const [members, membersByGroup, invitations, requests, pendingRequests] = await Promise.all([
    getMembers(true),
    getMembersForGroups(memberships.map((membership) => membership.group.id)),
    getInvitationsForMember(memberId),
    getJoinRequestsForMember(memberId),
    getPendingJoinRequests(managedGroupIds),
  ]);

  /* The current group first, then the rest oldest-first as they come back. */
  const ordered = [
    ...memberships.filter((membership) => membership.group.id === activeGroup?.id),
    ...memberships.filter((membership) => membership.group.id !== activeGroup?.id),
  ];

  return (
    <PageLayout>
      <PageHeader eyebrow="Groups" title="Who you share with" />

      <GroupsPanel
        groups={ordered.map((membership) => ({
          membership,
          members: membersByGroup[membership.group.id] ?? [],
          pendingRequests: pendingRequests.filter(
            (request) => request.groupId === membership.group.id
          ),
        }))}
        activeGroupId={activeGroup?.id ?? null}
        invitations={invitations}
        requests={requests}
        members={members}
        viewerId={memberId}
      />
    </PageLayout>
  );
};

export default GroupsPage;
