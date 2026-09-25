export type ActivityType = 'run' | 'workout' | 'swim' | 'walk' | 'cycle' | 'other';

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
}

export interface Member {
  id: string;
  name: string;
  accent: AccentName;
  sortOrder: number;
  targets: MemberTargets;
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

/** A training slot the group agreed on. `time` is always HH:MM. */
export interface TrainingSession {
  id: string;
  date: string;
  time: string;
  activity: ActivityType;
  note: string | null;
  createdBy: string | null;
}
