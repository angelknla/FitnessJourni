import type { Viewer } from '@/lib/session';

/**
 * Whether this viewer may write the given member's rows.
 *
 * Lives here, pure, so the rule itself is tested without standing up Supabase
 * or next/cache — the same reason the row mappers in lib/data are separate from
 * the queries that feed them.
 *
 * A visitor writes nothing: memberId is null, and null matching null would
 * otherwise hand them every row whose id was also missing.
 */
export const canEditMember = (viewer: Viewer, memberId: string): boolean =>
  viewer.memberId !== null && viewer.memberId === memberId;

/**
 * Who may remove people entirely. One named member rather than a role column:
 * there is no account system here to hang a role off, and the group is three
 * people who know each other.
 *
 * Matched on name, which is the honest limit of it — anyone who can add a member
 * could add one with this name and inherit the power. That is the same trust
 * level as the shared passcode itself. Override with ADMIN_MEMBER if the person
 * holding it changes, so their name is not pinned in the source.
 */
export const ADMIN_MEMBER_NAME = process.env.ADMIN_MEMBER?.trim() || 'Angel';

const named = (name: string) => name.trim().toLowerCase();

export const canRemoveMembers = (
  viewer: Viewer,
  members: readonly { id: string; name: string }[]
): boolean => {
  const you = members.find((member) => member.id === viewer.memberId);

  return you ? named(you.name) === named(ADMIN_MEMBER_NAME) : false;
};
