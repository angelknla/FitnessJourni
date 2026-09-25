export type ActivityType = 'run' | 'workout' | 'swim' | 'walk' | 'cycle' | 'other';

/** The playbook's four-day split, plus the cases that fall outside it. */
export type WorkoutFocus = 'upper' | 'legs' | 'push' | 'pull' | 'full_body' | 'cardio' | 'other';

/**
 * The eight categorical slots validated against this app's dark chart surface
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
  | 'red';

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
  /** The playbook's standard is 4 lifting sessions a week. */
  workoutsPerWeek: number;
}

export interface Member {
  id: string;
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
  month: string;
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
}
