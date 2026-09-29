import type { GroupRole } from '@/types/fitness';

/**
 * Group rules as pure functions — no Supabase, no next/headers — so every
 * permission decision is unit-testable on its own, the same reason the row
 * mappers in lib/data sit apart from the queries that feed them.
 *
 * Every one of these is also re-checked inside the Postgres functions in
 * supabase/schema.sql. These exist so a refusal can be explained in a sentence;
 * those exist so the rule holds even when a caller forgets to ask.
 */

/**
 * Codes are read aloud and typed back in, so the alphabet leaves out every pair
 * that gets confused: no I or L against 1, no O against 0. Kept in step with
 * groups_join_code_format_check and generate_group_join_code() in the schema —
 * the database constraint is the actual enforcement.
 */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const JOIN_CODE_BLOCK = 4;
const JOIN_CODE_LENGTH = JOIN_CODE_BLOCK * 2;

export const JOIN_CODE_PATTERN = new RegExp(
  `^[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_BLOCK}}-[${JOIN_CODE_ALPHABET}]{${JOIN_CODE_BLOCK}}$`
);

/**
 * `random` is injectable so the tests can pin the output; production uses
 * Math.random. Codes are not secrets — they are shared deliberately, and joining
 * with one only ever creates a request somebody has to approve — so this does
 * not need a CSPRNG. Uniqueness is the database's job, via the unique index.
 */
export const generateJoinCode = (random: () => number = Math.random): string => {
  let code = '';

  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    if (index === JOIN_CODE_BLOCK) {
      code += '-';
    }
    code += JOIN_CODE_ALPHABET.charAt(Math.floor(random() * JOIN_CODE_ALPHABET.length));
  }

  return code;
};

/**
 * Accepts what people actually paste — lower case, spaces, no hyphen, a hyphen in
 * the wrong place — and returns the one canonical spelling, or '' if it could
 * never be a code. Normalising here means the lookup is a plain equality test
 * against the stored value rather than a fuzzy search.
 */
export const normalizeJoinCode = (input: string): string => {
  const stripped = input.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (stripped.length !== JOIN_CODE_LENGTH) {
    return '';
  }

  const code = `${stripped.slice(0, JOIN_CODE_BLOCK)}-${stripped.slice(JOIN_CODE_BLOCK)}`;
  return JOIN_CODE_PATTERN.test(code) ? code : '';
};

export const isValidJoinCode = (code: string): boolean => JOIN_CODE_PATTERN.test(code);

export const GROUP_NAME_MIN = 2;
export const GROUP_NAME_MAX = 40;
export const GROUP_DESCRIPTION_MAX = 200;

export const isValidGroupName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= GROUP_NAME_MIN && trimmed.length <= GROUP_NAME_MAX;
};

export const isValidGroupDescription = (description: string): boolean =>
  description.length <= GROUP_DESCRIPTION_MAX;

export const roleLabels: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

/** Owner and admin share the day-to-day running of a group. */
export const canManageGroup = (role: GroupRole | null): boolean =>
  role === 'owner' || role === 'admin';

export const canEditGroupDetails = canManageGroup;
export const canInviteMembers = canManageGroup;
export const canReviewJoinRequests = canManageGroup;

/**
 * Admins handle regular members and nothing above them: not the owner, not each
 * other, and not themselves — leaving is its own action, with its own wording.
 */
export const canRemoveGroupMember = (
  actorRole: GroupRole | null,
  targetRole: GroupRole,
  isSelf = false
): boolean => {
  if (isSelf || targetRole === 'owner') {
    return false;
  }
  if (actorRole === 'owner') {
    return true;
  }
  return actorRole === 'admin' && targetRole === 'member';
};

/** Only the owner changes roles, so admins cannot quietly recruit more admins. */
export const canPromoteToAdmin = (actorRole: GroupRole | null, targetRole: GroupRole): boolean =>
  actorRole === 'owner' && targetRole === 'member';

export const canDemoteToMember = (actorRole: GroupRole | null, targetRole: GroupRole): boolean =>
  actorRole === 'owner' && targetRole === 'admin';

export const canTransferOwnership = (actorRole: GroupRole | null): boolean => actorRole === 'owner';

export const canRegenerateJoinCode = (actorRole: GroupRole | null): boolean =>
  actorRole === 'owner';

export const canDeleteGroup = (actorRole: GroupRole | null): boolean => actorRole === 'owner';

/**
 * A group must always have an owner, so the owner's way out is to hand the group
 * over first. Everyone else may simply leave.
 */
export const canLeaveGroup = (role: GroupRole | null): boolean =>
  role === 'admin' || role === 'member';

/** Sorted for display: owner, then admins, then members, each alphabetically. */
export const compareByRole = <T extends { role: GroupRole; name: string }>(a: T, b: T): number => {
  const rank: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };
  return rank[a.role] - rank[b.role] || a.name.localeCompare(b.name);
};
