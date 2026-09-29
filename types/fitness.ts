export type ActivityType = 'run' | 'workout' | 'swim' | 'walk' | 'cycle' | 'other';

/** The playbook's four-day split, plus the cases that fall outside it. */
export type WorkoutFocus = 'upper' | 'legs' | 'push' | 'pull' | 'full_body' | 'cardio' | 'other';

/**
 * The twelve categorical slots used against this app's dark chart surface
 * (see supabase/schema.sql). Assigned in order, never cycled or generated.
 */
export type AccentName =
  | 'blue'
  | 'orange'
  | 'aqua'
  | 'yellow'
  | 'magenta'
  | 'green'
  | 'violet'
  | 'red'
  | 'cyan'
  | 'lime'
  | 'pink'
  | 'silver';

export interface MemberTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Ring goal — the playbook's "10k ideal". */
  steps: number;
  /** Floor marker on the ring — the playbook's "8k minimum". */
  stepsMin: number;
  waterMl: number;
  /** Personal nightly sleep goal, defaulting to 8 hours. */
  sleepHours?: number;
  /** The playbook's standard is 4 lifting sessions a week. */
  workoutsPerWeek: number;
}

export interface Member {
  id: string;
  firstName?: string;
  surname?: string | null;
  name: string;
  accent: AccentName;
  avatarPath?: string | null;
  sortOrder: number;
  targets: MemberTargets;
}

export interface MemberProfile {
  memberId: string;
  age: number | null;
  heightCm: number | null;
  targetWeightKg: number | null;
  targetBmi: number | null;
}

export interface WeightMeasurement {
  date: string;
  weightKg: number;
}

/** One member's numbers for one day. `date` is always YYYY-MM-DD. */
export interface DailyLog {
  memberId: string;
  date: string;
  steps: number;
  waterMl: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sleepHours: number | null;
}

export type RsvpStatus = 'going' | 'not_going';

export interface SessionRsvp {
  memberId: string;
  status: RsvpStatus;
}

/** A training slot the group agreed on. `time` is always HH:MM. */
export interface TrainingSession {
  id: string;
  date: string;
  time: string;
  activity: ActivityType;
  note: string | null;
  createdBy: string | null;
  rsvps: SessionRsvp[];
}

/** One session done. Several on the same day is legitimate, so there is no
 *  one-per-day constraint — a lift and a cardio session are two workouts. */
export interface Workout {
  id: string;
  memberId: string;
  date: string;
  /** At least one; a session can cover several areas. */
  focuses: WorkoutFocus[];
  note: string | null;
}

/** Counts for one member, derived rather than stored. */
export interface WorkoutTally {
  today: number;
  week: number;
  month: number;
}

export interface GroupRun {
  id: string;
  date: string;
  durationMinutes: number;
  distanceKm: number;
  paceSecondsPerKm: number | null;
  createdBy: string | null;
  attendeeIds: string[];
}

export interface RunTally {
  week: number;
  month: number;
}

export interface MessagePost {
  id: string;
  memberId: string;
  content: string;
  createdAt: string;
  replyTo?: MessageReply;
  reactions: MessageReaction[];
}

export interface MessageReply {
  id: string;
  memberId: string;
  content: string;
}

export type MessageReactionType =
  | 'heart'
  | 'smile'
  | 'shocked'
  | 'angry'
  | 'thumbs_up'
  | 'thumbs_down';

export interface MessageReaction {
  memberId: string;
  type: MessageReactionType;
}

/**
 * Group roles, most privileged first. The creator of a group is its owner, a
 * group always has exactly one, and the rules each role implies live in
 * lib/groups.ts rather than being re-derived at each call site.
 */
export type GroupRole = 'owner' | 'admin' | 'member';

export interface FitnessGroup {
  id: string;
  name: string;
  description: string | null;
  /** Short, human-friendly and regeneratable, e.g. `N7K4-P2Q9`. */
  joinCode: string;
  /** Uploaded group picture, or null to fall back to the two-figure icon. */
  imagePath: string | null;
  /** Counted from accepted memberships, never stored. */
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

/** One group this member has accepted membership of, and what they may do in it. */
export interface GroupMembership {
  group: FitnessGroup;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupMemberRole {
  memberId: string;
  role: GroupRole;
  joinedAt: string;
}

export type GroupInvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';
export type GroupJoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  memberId: string;
  invitedBy: string | null;
  status: GroupInvitationStatus;
  createdAt: string;
}

export interface GroupJoinRequest {
  id: string;
  groupId: string;
  groupName: string;
  memberId: string;
  status: GroupJoinRequestStatus;
  createdAt: string;
}

/**
 * The group whose shared content the viewer is currently seeing. Always resolved
 * on the server from an accepted membership; null means Personal mode, where
 * only the viewer's own records exist.
 */
export interface ActiveGroup {
  id: string;
  name: string;
  role: GroupRole;
  /** Shown on the badge in place of the icon when the group has a picture. */
  imagePath: string | null;
}

/** How many answers are waiting on this person, for the header's quiet marker. */
export interface GroupPendingSummary {
  /** Invitations addressed to them. */
  invitations: number;
  /** Join requests waiting for them to approve, across the groups they manage. */
  requests: number;
}
