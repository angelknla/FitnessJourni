import type { AccentName, ActivityType, MemberTargets, WorkoutFocus } from '@/types/fitness';

/** Straight from Dillon's 12-week playbook. Per-member and editable from there. */
export const defaultTargets: MemberTargets = {
  calories: 2500,
  protein: 156,
  carbs: 313,
  fat: 69,
  steps: 10000,
  stepsMin: 8000,
  waterMl: 2500,
  workoutsPerWeek: 4,
};

export const activityTypes: ActivityType[] = ['run', 'workout', 'swim', 'walk', 'cycle', 'other'];

export const activityLabels: Record<ActivityType, string> = {
  run: 'Run',
  workout: 'Workout',
  swim: 'Swim',
  walk: 'Walk',
  cycle: 'Cycle',
  other: 'Other',
};

/**
 * Fixed assignment order. A new member takes the next unused slot rather than a
 * generated hue, because a generated 9th hue is indistinguishable from an
 * existing one under colourblind simulation.
 */
export const accentNames: AccentName[] = [
  'blue',
  'orange',
  'aqua',
  'yellow',
  'magenta',
  'green',
  'violet',
  'red',
];

/**
 * Resolve whatever the database holds into a valid slot. An unrecognised value
 * (older schema, manual edit) falls back by position rather than to a single
 * colour, so members stay distinguishable from each other.
 */
export const resolveAccent = (accent: string, sortOrder: number): AccentName =>
  (accentNames as readonly string[]).includes(accent)
    ? (accent as AccentName)
    : accentNames[Math.abs(sortOrder) % accentNames.length];

/** Dark-surface steps. Validated as a set — do not hand-tweak these. */
export const accentHex: Record<AccentName, string> = {
  blue: '#3987e5',
  orange: '#d95926',
  aqua: '#199e70',
  yellow: '#c98500',
  magenta: '#d55181',
  green: '#008300',
  violet: '#9085e9',
  red: '#e66767',
};

/** The next free slot for a new member, wrapping only once all eight are taken. */
export const nextAccent = (used: AccentName[]): AccentName =>
  accentNames.find((name) => !used.includes(name)) ?? accentNames[used.length % accentNames.length];

/** How many days forward the session date rail offers. */
export const bookingWindowDays = 14;

/** Handy presets so nobody has to fight a time input on a phone. */
export const quickTimes = ['06:30', '07:00', '08:00', '12:30', '17:30', '18:30', '19:30'];

export const workoutFocuses: WorkoutFocus[] = [
  'upper',
  'legs',
  'push',
  'pull',
  'full_body',
  'cardio',
  'other',
];

/** The first four are the playbook's split: Saturday, Sunday, Tuesday, Thursday. */
export const workoutFocusLabels: Record<WorkoutFocus, string> = {
  upper: 'Upper',
  legs: 'Legs',
  push: 'Push',
  pull: 'Pull',
  full_body: 'Full body',
  cardio: 'Cardio',
  other: 'Other',
};
