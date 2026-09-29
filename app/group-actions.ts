'use server';

import {
  AVATAR_UPLOAD_MAX_BYTES,
  avatarUploadTypes,
  GROUP_IMAGE_BUCKET,
  groupImageObjectPath,
} from '@data/avatarData';
import { revalidatePath } from 'next/cache';
import { isValidUsername, normalizeUsername } from '@/lib/account';
import { findAccountByUsername } from '@/lib/data/accounts';
import { getActiveGroup, getGroupRole, getMemberships } from '@/lib/data/groups';
import { getMembers } from '@/lib/data/members';
import {
  canDeleteGroup,
  canEditGroupDetails,
  canInviteMembers,
  canLeaveGroup,
  canRegenerateJoinCode,
  canReviewJoinRequests,
  canTransferOwnership,
  GROUP_DESCRIPTION_MAX,
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  isValidGroupDescription,
  isValidGroupName,
  normalizeJoinCode,
} from '@/lib/groups';
import { isUnlocked, readViewer } from '@/lib/session';
import { getSupabase } from '@/lib/supabase/server';
import type { GroupRole } from '@/types/fitness';

/**
 * Group mutations.
 *
 * Every one of these re-derives who is asking from the session cookie and their
 * role from group_members. A group id, a member id and a role all arrive as form
 * fields that anyone can edit by hand, so none of them is ever believed: the id
 * is only a lookup key, and the permission is the row that comes back.
 *
 * The operations that cross an invariant — accepting, approving, transferring,
 * removing, deleting — are single calls into the Postgres functions in
 * supabase/schema.sql, because supabase-js cannot open a transaction and those
 * must not be observable half-done. Those functions repeat the role checks; the
 * checks here exist so a refusal can say why.
 */

export interface GroupActionState {
  ok: boolean;
  error?: string;
  message?: string;
  /** Changes on every success, for forms that reset on a primitive. */
  bookedAt?: number;
  /** Returned by code regeneration so the panel can show the new code at once. */
  joinCode?: string;
}

const ok = (message: string, extra: Partial<GroupActionState> = {}): GroupActionState => ({
  ok: true,
  message,
  bookedAt: Date.now(),
  ...extra,
});

const fail = (error: string): GroupActionState => ({ ok: false, error });

const NOT_CONFIGURED =
  'Supabase is not connected yet — add SUPABASE_URL and a Supabase server key.';
const LOCKED = 'Locked — reload the page and log in.';
const NO_PERMISSION = 'You do not have permission to do that in this group.';
const GONE = 'That has already been dealt with.';

const toText = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : '';

type Supabase = NonNullable<ReturnType<typeof getSupabase>>;

/** The signed-in member and a configured client, or the refusal to return. */
const requireMember = async (): Promise<
  { memberId: string; supabase: Supabase } | GroupActionState
> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const viewer = await readViewer();
  if (!viewer.memberId) {
    return fail('Log in before managing groups.');
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  return { memberId: viewer.memberId, supabase };
};

const isRefusal = (value: unknown): value is GroupActionState =>
  typeof value === 'object' && value !== null && 'ok' in value;

/**
 * Membership and role for a group the caller named. Returns a refusal rather than
 * null for a group they are not in, and deliberately uses the same wording as a
 * permission failure — "no such group" and "not your group" must not be
 * distinguishable, or the form becomes a way to test whether a group exists.
 */
const requireRole = async (
  groupId: string,
  memberId: string,
  allowed: (role: GroupRole | null) => boolean
): Promise<GroupRole | GroupActionState> => {
  if (!groupId) {
    return fail('Pick a group.');
  }

  const role = await getGroupRole(groupId, memberId);
  if (!role || !allowed(role)) {
    return fail(NO_PERMISSION);
  }

  return role;
};

/**
 * Switching group, or changing who is in one, changes what every group-scoped
 * page is allowed to show. Revalidating the layout purges the client cache as
 * well, which is what stops the previous group's data being served from it.
 */
const revalidateGroupScope = () => {
  for (const path of [
    '/',
    '/logs',
    '/workouts',
    '/running',
    '/sessions',
    '/messages',
    '/profile',
    '/groups',
  ]) {
    revalidatePath(path);
  }
  revalidatePath('/', 'layout');
};

/**
 * For changes that alter what Groups shows without changing which group anything
 * is scoped to — a new code, an invitation sent, a request answered.
 *
 * /groups renders all of it and /profile names the current group, so both need
 * it; the layout carries the badge's pending marker.
 */
const revalidateGroupPages = () => {
  revalidatePath('/groups');
  revalidatePath('/profile');
  /*
   * Home too: the badge there carries the group's name, its picture and the
   * pending marker, so a new picture or an answered request goes stale on it
   * otherwise. Revalidating the layout alone does not re-render the page.
   */
  revalidatePath('/');
  revalidatePath('/', 'layout');
};

/** Turns a function's short result code into something the person can act on. */
const explain = (code: string): string => {
  switch (code) {
    case 'forbidden':
      return NO_PERMISSION;
    case 'not_found':
      return GONE;
    case 'stale':
      return 'That has already been answered.';
    case 'last_owner':
      return 'Hand the group over to someone else before you leave it.';
    default:
      return 'Could not complete that.';
  }
};

export const createGroup = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const name = toText(formData.get('name'));
  const description = toText(formData.get('description'));

  if (!isValidGroupName(name)) {
    return fail(`Give the group a name of ${GROUP_NAME_MIN} to ${GROUP_NAME_MAX} characters.`);
  }
  if (!isValidGroupDescription(description)) {
    return fail(`Keep the description under ${GROUP_DESCRIPTION_MAX} characters.`);
  }

  const { data, error } = await session.supabase.rpc('create_group', {
    p_name: name,
    p_description: description || null,
    p_owner_id: session.memberId,
  });

  if (error) {
    console.error('[createGroup]', error.message);
    return fail('Could not create that group.');
  }

  const created = (data as { group_id: string; join_code: string }[] | null)?.[0];
  revalidateGroupScope();

  return ok(`${name} created — you are its owner.`, { joinCode: created?.join_code });
};

/**
 * Switching the active group. The id is checked against an accepted membership
 * before anything is written, and the composite foreign key on
 * member_active_groups would refuse it anyway — two layers, because this is the
 * one field that decides what every other page shows.
 */
export const switchActiveGroup = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const role = await requireRole(groupId, session.memberId, (value) => value !== null);
  if (isRefusal(role)) return role;

  const { error } = await session.supabase.from('member_active_groups').upsert(
    {
      member_id: session.memberId,
      group_id: groupId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id' }
  );

  if (error) {
    console.error('[switchActiveGroup]', error.message);
    return fail('Could not switch group.');
  }

  const switched = (await getMemberships(session.memberId)).find(
    (membership) => membership.group.id === groupId
  );

  revalidateGroupScope();
  return ok(`Now viewing ${switched?.group.name ?? 'that group'}.`);
};

export const updateGroupDetails = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const name = toText(formData.get('name'));
  const description = toText(formData.get('description'));

  const role = await requireRole(groupId, session.memberId, canEditGroupDetails);
  if (isRefusal(role)) return role;

  if (!isValidGroupName(name)) {
    return fail(`Give the group a name of ${GROUP_NAME_MIN} to ${GROUP_NAME_MAX} characters.`);
  }
  if (!isValidGroupDescription(description)) {
    return fail(`Keep the description under ${GROUP_DESCRIPTION_MAX} characters.`);
  }

  const { error } = await session.supabase
    .from('groups')
    .update({ name, description: description || null, updated_at: new Date().toISOString() })
    .eq('id', groupId);

  if (error) {
    console.error('[updateGroupDetails]', error.message);
    return fail('Could not save those group details.');
  }

  revalidateGroupScope();
  return ok('Group details saved.');
};

/**
 * Invite by username. The role check comes first on purpose: looking a username
 * up tells you whether it exists, so only someone already entitled to invite
 * people gets to ask.
 */
export const inviteMemberByUsername = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const role = await requireRole(groupId, session.memberId, canInviteMembers);
  if (isRefusal(role)) return role;

  const username = normalizeUsername(toText(formData.get('username')));
  if (!isValidUsername(username)) {
    return fail('Enter a valid username.');
  }

  const account = await findAccountByUsername(username);
  if (!account) {
    return fail('No user has that username.');
  }

  if (await getGroupRole(groupId, account.memberId)) {
    return fail('They are already in this group.');
  }

  const [invitation, request] = await Promise.all([
    session.supabase
      .from('group_invitations')
      .select('id')
      .eq('group_id', groupId)
      .eq('member_id', account.memberId)
      .eq('status', 'pending')
      .maybeSingle(),
    session.supabase
      .from('group_join_requests')
      .select('id')
      .eq('group_id', groupId)
      .eq('member_id', account.memberId)
      .eq('status', 'pending')
      .maybeSingle(),
  ]);

  if (invitation.data) {
    return fail('They have already been invited — they just need to accept.');
  }
  if (request.data) {
    return fail('They have already asked to join — approve their request instead.');
  }

  const { error } = await session.supabase.from('group_invitations').insert({
    group_id: groupId,
    member_id: account.memberId,
    invited_by: session.memberId,
  });

  if (error) {
    // The partial unique index catches a second tap that raced the check above.
    if (error.code === '23505') {
      return fail('They have already been invited — they just need to accept.');
    }
    console.error('[inviteMemberByUsername]', error.message);
    return fail('Could not send that invitation.');
  }

  const invited = (await getMembers()).find((member) => member.id === account.memberId);
  revalidateGroupPages();

  return ok(`${invited?.name ?? account.username} has been invited.`);
};

/** Accepting adds the membership; declining only answers the invitation. */
export const respondToInvitation = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const invitationId = toText(formData.get('invitationId'));
  const response = toText(formData.get('response'));

  if (!invitationId || (response !== 'accept' && response !== 'decline')) {
    return fail('Choose whether to accept or decline.');
  }

  if (response === 'decline') {
    /*
     * Scoped to their own pending row, so the id alone cannot decline someone
     * else's invitation, and an already-answered one reports as gone rather than
     * being silently re-answered.
     */
    const { data, error } = await session.supabase
      .from('group_invitations')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', invitationId)
      .eq('member_id', session.memberId)
      .eq('status', 'pending')
      .select('id');

    if (error) {
      console.error('[respondToInvitation:decline]', error.message);
      return fail('Could not decline that invitation.');
    }
    if (!data || data.length === 0) {
      return fail(GONE);
    }

    revalidateGroupPages();
    return ok('Invitation declined.');
  }

  const { data, error } = await session.supabase.rpc('accept_group_invitation', {
    p_invitation_id: invitationId,
    p_member_id: session.memberId,
  });

  if (error) {
    console.error('[respondToInvitation:accept]', error.message);
    return fail('Could not accept that invitation.');
  }
  if (data !== 'ok') {
    return fail(explain(String(data)));
  }

  revalidateGroupScope();
  return ok('Invitation accepted — you are in.');
};

/** Entering a code raises a request; it never joins anyone on its own. */
export const requestGroupAccess = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const joinCode = normalizeJoinCode(toText(formData.get('joinCode')));
  if (!joinCode) {
    return fail('Group codes look like N7K4-P2Q9.');
  }

  const { data: group, error: lookupError } = await session.supabase
    .from('groups')
    .select('id, name')
    .eq('join_code', joinCode)
    .maybeSingle();

  if (lookupError) {
    console.error('[requestGroupAccess:lookup]', lookupError.message);
    return fail('Could not check that code.');
  }
  if (!group) {
    return fail('No group has that code.');
  }

  const groupId = group.id as string;
  const groupName = group.name as string;

  if (await getGroupRole(groupId, session.memberId)) {
    return fail(`You are already in ${groupName}.`);
  }

  const [invitation, request] = await Promise.all([
    session.supabase
      .from('group_invitations')
      .select('id')
      .eq('group_id', groupId)
      .eq('member_id', session.memberId)
      .eq('status', 'pending')
      .maybeSingle(),
    session.supabase
      .from('group_join_requests')
      .select('id')
      .eq('group_id', groupId)
      .eq('member_id', session.memberId)
      .eq('status', 'pending')
      .maybeSingle(),
  ]);

  if (invitation.data) {
    return fail(`You have already been invited to ${groupName} — accept the invitation instead.`);
  }
  if (request.data) {
    return fail(`You have already asked to join ${groupName}.`);
  }

  const { error } = await session.supabase.from('group_join_requests').insert({
    group_id: groupId,
    member_id: session.memberId,
  });

  if (error) {
    if (error.code === '23505') {
      return fail(`You have already asked to join ${groupName}.`);
    }
    console.error('[requestGroupAccess]', error.message);
    return fail('Could not send that request.');
  }

  revalidateGroupPages();
  return ok(`Asked to join ${groupName}. An owner or admin has to approve it.`);
};

export const reviewJoinRequest = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const requestId = toText(formData.get('requestId'));
  const decision = toText(formData.get('decision'));

  if (!requestId || (decision !== 'approve' && decision !== 'reject')) {
    return fail('Choose whether to approve or reject.');
  }

  if (decision === 'approve') {
    const { data, error } = await session.supabase.rpc('approve_group_join_request', {
      p_request_id: requestId,
      p_reviewer_id: session.memberId,
    });

    if (error) {
      console.error('[reviewJoinRequest:approve]', error.message);
      return fail('Could not approve that request.');
    }
    if (data !== 'ok') {
      return fail(explain(String(data)));
    }

    revalidateGroupScope();
    return ok('Request approved — they are in the group.');
  }

  /*
   * Rejecting is one statement, so it needs no function — but the group has to be
   * read from the request row rather than taken from the form, or the id would be
   * enough to reject a request in someone else's group.
   */
  const { data: request, error: readError } = await session.supabase
    .from('group_join_requests')
    .select('group_id')
    .eq('id', requestId)
    .eq('status', 'pending')
    .maybeSingle();

  if (readError) {
    console.error('[reviewJoinRequest:read]', readError.message);
    return fail('Could not reject that request.');
  }
  if (!request) {
    return fail(GONE);
  }

  const role = await requireRole(
    request.group_id as string,
    session.memberId,
    canReviewJoinRequests
  );
  if (isRefusal(role)) return role;

  const { error } = await session.supabase
    .from('group_join_requests')
    .update({
      status: 'rejected',
      reviewed_by: session.memberId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (error) {
    console.error('[reviewJoinRequest:reject]', error.message);
    return fail('Could not reject that request.');
  }

  revalidateGroupPages();
  return ok('Request rejected.');
};

export const changeGroupMemberRole = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const memberId = toText(formData.get('memberId'));
  const role = toText(formData.get('role'));

  if (!memberId || (role !== 'admin' && role !== 'member')) {
    return fail('Choose a role.');
  }

  // Only an owner promotes or demotes; the function refuses anything else too.
  const actorRole = await requireRole(groupId, session.memberId, (value) => value === 'owner');
  if (isRefusal(actorRole)) return actorRole;

  const { data, error } = await session.supabase.rpc('set_group_member_role', {
    p_group_id: groupId,
    p_actor_id: session.memberId,
    p_member_id: memberId,
    p_role: role,
  });

  if (error) {
    console.error('[changeGroupMemberRole]', error.message);
    return fail('Could not change that role.');
  }
  if (data !== 'ok') {
    return fail(explain(String(data)));
  }

  const changed = (await getMembers()).find((member) => member.id === memberId);
  revalidateGroupScope();

  return ok(
    role === 'admin'
      ? `${changed?.name ?? 'They'} is now an admin.`
      : `${changed?.name ?? 'They'} is now a member.`
  );
};

export const transferGroupOwnership = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const memberId = toText(formData.get('memberId'));

  if (!memberId) {
    return fail('Choose who to hand the group to.');
  }

  const actorRole = await requireRole(groupId, session.memberId, canTransferOwnership);
  if (isRefusal(actorRole)) return actorRole;

  const { data, error } = await session.supabase.rpc('transfer_group_ownership', {
    p_group_id: groupId,
    p_owner_id: session.memberId,
    p_member_id: memberId,
  });

  if (error) {
    console.error('[transferGroupOwnership]', error.message);
    return fail('Could not transfer ownership.');
  }
  if (data !== 'ok') {
    return fail(explain(String(data)));
  }

  const newOwner = (await getMembers()).find((member) => member.id === memberId);
  revalidateGroupScope();

  return ok(`${newOwner?.name ?? 'They'} now owns this group. You are an admin.`);
};

export const removeGroupMember = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const memberId = toText(formData.get('memberId'));

  if (!memberId) {
    return fail('Choose who to remove.');
  }

  const actorRole = await requireRole(groupId, session.memberId, canInviteMembers);
  if (isRefusal(actorRole)) return actorRole;

  const { data, error } = await session.supabase.rpc('remove_group_member', {
    p_group_id: groupId,
    p_actor_id: session.memberId,
    p_member_id: memberId,
  });

  if (error) {
    console.error('[removeGroupMember]', error.message);
    return fail('Could not remove them.');
  }
  if (data !== 'ok') {
    return fail(explain(String(data)));
  }

  const removed = (await getMembers()).find((member) => member.id === memberId);
  revalidateGroupScope();

  /*
   * Their own logs, workouts and runs are untouched, and so is everything they
   * already shared with this group — the remaining members keep seeing the days
   * this person was part of.
   */
  return ok(`${removed?.name ?? 'They'} is no longer in this group.`);
};

export const leaveGroup = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const role = await requireRole(groupId, session.memberId, (value) => value !== null);
  if (isRefusal(role)) return role;

  if (!canLeaveGroup(role)) {
    return fail('Hand the group over to someone else before you leave it.');
  }

  const { data, error } = await session.supabase.rpc('leave_group', {
    p_group_id: groupId,
    p_member_id: session.memberId,
  });

  if (error) {
    console.error('[leaveGroup]', error.message);
    return fail('Could not leave that group.');
  }
  if (data !== 'ok') {
    return fail(explain(String(data)));
  }

  const remaining = await getActiveGroup(session.memberId);
  revalidateGroupScope();

  return ok(
    remaining ? `You have left. Now viewing ${remaining.name}.` : 'You have left. Back to Personal.'
  );
};

export const regenerateGroupCode = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const role = await requireRole(groupId, session.memberId, canRegenerateJoinCode);
  if (isRefusal(role)) return role;

  const { data, error } = await session.supabase.rpc('regenerate_group_join_code', {
    p_group_id: groupId,
    p_actor_id: session.memberId,
  });

  if (error) {
    console.error('[regenerateGroupCode]', error.message);
    return fail('Could not make a new code.');
  }

  const result = (data as { result: string; join_code: string | null }[] | null)?.[0];
  if (result?.result !== 'ok' || !result.join_code) {
    return fail(explain(result?.result ?? 'unknown'));
  }

  revalidateGroupPages();
  return ok('New code ready. The old one no longer works.', { joinCode: result.join_code });
};

/**
 * The group's picture. Upload replaces whatever was there; removing clears both the
 * column and the object, and the UI falls back to the two-figure icon.
 *
 * Only an owner or admin, checked here and re-checked nowhere else — this is the one
 * group mutation with no plpgsql function behind it, because a single column update
 * has no invariant to cross.
 */
export const saveGroupImage = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const role = await requireRole(groupId, session.memberId, canEditGroupDetails);
  if (isRefusal(role)) return role;

  const remove = toText(formData.get('remove')) === 'true';
  const entry = formData.get('image');
  const image = entry instanceof File && entry.size > 0 ? entry : null;
  const objectPath = groupImageObjectPath(groupId);

  if (remove) {
    const { error } = await session.supabase
      .from('groups')
      .update({ avatar_path: null, updated_at: new Date().toISOString() })
      .eq('id', groupId);

    if (error) {
      console.error('[saveGroupImage:remove]', error.message);
      return fail('Could not remove that picture.');
    }

    // The column is what the app reads, so a failure here is worth knowing about
    // but not worth failing the action the person asked for.
    const { error: objectError } = await session.supabase.storage
      .from(GROUP_IMAGE_BUCKET)
      .remove([objectPath]);
    if (objectError) {
      console.error('[saveGroupImage:object]', objectError.message);
    }

    revalidateGroupPages();
    return ok('Group picture removed.');
  }

  if (!image) {
    return fail('Choose a picture to upload.');
  }
  if (!avatarUploadTypes.includes(image.type as (typeof avatarUploadTypes)[number])) {
    return fail('Upload a JPEG, PNG or WebP image.');
  }
  if (image.size > AVATAR_UPLOAD_MAX_BYTES) {
    return fail('Group pictures must be 5 MB or smaller.');
  }

  const { error: uploadError } = await session.supabase.storage
    .from(GROUP_IMAGE_BUCKET)
    .upload(objectPath, image, {
      cacheControl: '3600',
      contentType: image.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[saveGroupImage:upload]', uploadError.message);
    return fail('Could not upload that picture.');
  }

  const { publicUrl } = session.supabase.storage
    .from(GROUP_IMAGE_BUCKET)
    .getPublicUrl(objectPath).data;

  /*
   * Versioned, because the object path is deterministic: without this the browser
   * and the image optimiser would both keep serving the picture it replaced.
   */
  const { error } = await session.supabase
    .from('groups')
    .update({ avatar_path: `${publicUrl}?v=${Date.now()}`, updated_at: new Date().toISOString() })
    .eq('id', groupId);

  if (error) {
    console.error('[saveGroupImage]', error.message);
    return fail('Could not save that picture.');
  }

  revalidateGroupPages();
  return ok('Group picture saved.');
};

export const deleteGroup = async (
  _prev: GroupActionState,
  formData: FormData
): Promise<GroupActionState> => {
  const session = await requireMember();
  if (isRefusal(session)) return session;

  const groupId = toText(formData.get('groupId'));
  const confirmation = toText(formData.get('confirm'));

  const role = await requireRole(groupId, session.memberId, canDeleteGroup);
  if (isRefusal(role)) return role;

  const membership = (await getMemberships(session.memberId)).find(
    (item) => item.group.id === groupId
  );

  /*
   * Typing the name is the confirmation. Destructive and irreversible: the chat,
   * the sessions and the group itself go. Everyone's personal logs, workouts and
   * runs stay — only their association with this group is removed.
   */
  if (!membership || confirmation.toLowerCase() !== membership.group.name.toLowerCase()) {
    return fail('Type the group name exactly to confirm.');
  }

  const { data, error } = await session.supabase.rpc('delete_group', {
    p_group_id: groupId,
    p_actor_id: session.memberId,
  });

  if (error) {
    console.error('[deleteGroup]', error.message);
    return fail('Could not delete that group.');
  }
  if (data !== 'ok') {
    return fail(explain(String(data)));
  }

  const remaining = await getActiveGroup(session.memberId);
  revalidateGroupScope();

  return ok(
    remaining
      ? `${membership.group.name} deleted. Now viewing ${remaining.name}.`
      : `${membership.group.name} deleted. Back to Personal.`
  );
};
