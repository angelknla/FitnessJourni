import { cache } from 'react';
import { getSupabase } from '@/lib/supabase/server';
import type {
  ActiveGroup,
  FitnessGroup,
  GroupInvitation,
  GroupJoinRequest,
  GroupMemberRole,
  GroupMembership,
  GroupPendingSummary,
  GroupRole,
} from '@/types/fitness';

export interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  join_code: string;
  avatar_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberRow {
  group_id?: string;
  member_id: string;
  role: string;
  joined_at: string;
}

export interface GroupInvitationRow {
  id: string;
  group_id: string;
  member_id: string;
  invited_by: string | null;
  status: string;
  created_at: string;
  groups?: { name: string } | null;
}

export interface GroupJoinRequestRow {
  id: string;
  group_id: string;
  member_id: string;
  status: string;
  created_at: string;
  groups?: { name: string } | null;
}

/** memberCount arrives separately because it is counted, never stored. */
export const mapGroup = (row: GroupRow, memberCount: number): FitnessGroup => ({
  id: row.id,
  name: row.name,
  description: row.description?.trim() || null,
  joinCode: row.join_code,
  imagePath: row.avatar_path ?? null,
  memberCount,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapGroupMember = (row: GroupMemberRow): GroupMemberRole => ({
  memberId: row.member_id,
  role: row.role as GroupRole,
  joinedAt: row.joined_at,
});

export const mapInvitation = (row: GroupInvitationRow): GroupInvitation => ({
  id: row.id,
  groupId: row.group_id,
  groupName: row.groups?.name ?? 'A group',
  memberId: row.member_id,
  invitedBy: row.invited_by,
  status: row.status as GroupInvitation['status'],
  createdAt: row.created_at,
});

export const mapJoinRequest = (row: GroupJoinRequestRow): GroupJoinRequest => ({
  id: row.id,
  groupId: row.group_id,
  groupName: row.groups?.name ?? 'A group',
  memberId: row.member_id,
  status: row.status as GroupJoinRequest['status'],
  createdAt: row.created_at,
});

/**
 * Every group this member has accepted membership of, oldest first — the same
 * order reassign_active_group() uses in the database, so a fallback here and a
 * fallback there pick the same group.
 *
 * Cached per request: the layout, the page and the active-group lookup all want
 * it, and one request should not ask three times.
 */
export const getMemberships = cache(async (memberId: string): Promise<GroupMembership[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('group_members')
    .select(
      'role, joined_at, groups!inner(id, name, description, join_code, avatar_path, created_at, updated_at)'
    )
    .eq('member_id', memberId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('[groups] membership read failed:', error.message);
    return [];
  }

  const rows = data as unknown as {
    role: string;
    joined_at: string;
    groups: GroupRow;
  }[];

  if (rows.length === 0) {
    return [];
  }

  const counts = await getMemberCounts(rows.map((row) => row.groups.id));

  return rows
    .map((row) => ({
      group: mapGroup(row.groups, counts[row.groups.id] ?? 0),
      role: row.role as GroupRole,
      joinedAt: row.joined_at,
    }))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.group.id.localeCompare(b.group.id));
});

/** Accepted-member counts, derived from the membership rows themselves. */
export const getMemberCounts = async (groupIds: string[]): Promise<Record<string, number>> => {
  const supabase = getSupabase();
  if (!supabase || groupIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  if (error) {
    console.error('[groups] member count read failed:', error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data as { group_id: string }[]) {
    counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
  }

  return counts;
};

/**
 * The group this member is currently looking at, or null for Personal mode.
 *
 * Deliberately derived from their memberships rather than read straight out of
 * member_active_groups: a stored id only counts if it is still an accepted
 * membership, so a group they were removed from can never resolve, and neither
 * can one they never belonged to. When the stored id no longer matches anything
 * it falls back to their oldest membership instead of dropping them to Personal
 * mode while they still have groups.
 */
export const getActiveGroup = cache(async (memberId: string): Promise<ActiveGroup | null> => {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const memberships = await getMemberships(memberId);
  if (memberships.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('member_active_groups')
    .select('group_id')
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) {
    console.error('[groups] active group read failed:', error.message);
  }

  const storedId = (data?.group_id as string | undefined) ?? null;
  const chosen =
    memberships.find((membership) => membership.group.id === storedId) ?? memberships[0];

  return {
    id: chosen.group.id,
    name: chosen.group.name,
    role: chosen.role,
    imagePath: chosen.group.imagePath,
  };
});

/**
 * This member's role in one group, or null if they are not in it. The single
 * primitive every group-scoped mutation authorises against — a group id is only
 * ever as trustworthy as the row this returns.
 */
export const getGroupRole = async (
  groupId: string,
  memberId: string
): Promise<GroupRole | null> => {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) {
    console.error('[groups] role read failed:', error.message);
    return null;
  }

  return (data?.role as GroupRole | undefined) ?? null;
};

export const getGroupMembers = cache(async (groupId: string): Promise<GroupMemberRole[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('group_members')
    .select('member_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('[groups] member read failed:', error.message);
    return [];
  }

  return (data as GroupMemberRow[]).map(mapGroupMember);
});

/**
 * Roles for several groups at once, keyed by group id. One query rather than one
 * per group, because the Groups page shows the membership of every group the
 * viewer belongs to, not just the active one.
 */
export const getMembersForGroups = async (
  groupIds: string[]
): Promise<Record<string, GroupMemberRole[]>> => {
  const supabase = getSupabase();
  if (!supabase || groupIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from('group_members')
    .select('group_id, member_id, role, joined_at')
    .in('group_id', groupIds)
    .order('joined_at', { ascending: true });

  if (error) {
    console.error('[groups] group member read failed:', error.message);
    return {};
  }

  const byGroup: Record<string, GroupMemberRole[]> = {};
  for (const row of data as GroupMemberRow[]) {
    const groupId = row.group_id as string;
    byGroup[groupId] = [...(byGroup[groupId] ?? []), mapGroupMember(row)];
  }

  return byGroup;
};

/** Just the ids, for scoping a member list to one group. */
export const getGroupMemberIds = async (groupId: string): Promise<string[]> =>
  (await getGroupMembers(groupId)).map((member) => member.memberId);

/** Invitations waiting for this person to accept or decline. */
export const getInvitationsForMember = async (memberId: string): Promise<GroupInvitation[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('group_invitations')
    .select('id, group_id, member_id, invited_by, status, created_at, groups!inner(name)')
    .eq('member_id', memberId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[groups] invitation read failed:', error.message);
    return [];
  }

  return (data as unknown as GroupInvitationRow[]).map(mapInvitation);
};

/**
 * This person's own join requests, answered ones included, so Profile can show
 * where an earlier ask got to rather than silently forgetting it.
 */
export const getJoinRequestsForMember = async (memberId: string): Promise<GroupJoinRequest[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('group_join_requests')
    .select('id, group_id, member_id, status, created_at, groups!inner(name)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[groups] join request read failed:', error.message);
    return [];
  }

  return (data as unknown as GroupJoinRequestRow[]).map(mapJoinRequest);
};

/** Requests waiting on a manager, across every group they run. */
export const getPendingJoinRequests = async (groupIds: string[]): Promise<GroupJoinRequest[]> => {
  const supabase = getSupabase();
  if (!supabase || groupIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('group_join_requests')
    .select('id, group_id, member_id, status, created_at, groups!inner(name)')
    .in('group_id', groupIds)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[groups] pending request read failed:', error.message);
    return [];
  }

  return (data as unknown as GroupJoinRequestRow[]).map(mapJoinRequest);
};

/**
 * Counts for the header's marker. Two `head` counts rather than fetching rows:
 * the header only needs to know whether anything is waiting.
 */
export const getPendingSummary = async (
  memberId: string,
  managedGroupIds: string[]
): Promise<GroupPendingSummary> => {
  const supabase = getSupabase();
  if (!supabase) {
    return { invitations: 0, requests: 0 };
  }

  const [invitationResult, requestResult] = await Promise.all([
    supabase
      .from('group_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('status', 'pending'),
    managedGroupIds.length > 0
      ? supabase
          .from('group_join_requests')
          .select('id', { count: 'exact', head: true })
          .in('group_id', managedGroupIds)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0, error: null }),
  ]);

  if (invitationResult.error || requestResult.error) {
    console.error(
      '[groups] pending summary failed:',
      invitationResult.error?.message ?? requestResult.error?.message
    );
  }

  return {
    invitations: invitationResult.count ?? 0,
    requests: requestResult.count ?? 0,
  };
};

/**
 * Looks a group up by code. Returns only the id and name even on a hit: a code
 * that turns out to be real must not hand back the group's membership or its
 * other details before anyone has approved the person holding it.
 */
export const findGroupByJoinCode = async (
  joinCode: string
): Promise<{ id: string; name: string } | null> => {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('groups')
    .select('id, name')
    .eq('join_code', joinCode)
    .maybeSingle();

  if (error) {
    console.error('[groups] join code lookup failed:', error.message);
    return null;
  }

  return (data as { id: string; name: string } | null) ?? null;
};
