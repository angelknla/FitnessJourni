import type { WorkoutFocus } from '@/types/fitness';

export interface PlanExercise {
  name: string;
  /** As written in the playbook, e.g. "3 × 6–12". */
  sets: string;
  rest: string;
  cue: string;
}

export interface WorkoutBundle {
  focus: WorkoutFocus;
  title: string;
  /** The day the playbook schedules it on. */
  day: string;
  summary: string;
  exercises: PlanExercise[];
}

/**
 * The four lifting sessions, transcribed from the 12-week playbook (sections
 * 8-11). Kept verbatim — the sets, rest and cues are the plan, not suggestions.
 */
export const workoutBundles: WorkoutBundle[] = [
  {
    focus: 'upper',
    title: 'Upper / Aesthetics',
    day: 'Saturday',
    summary: 'Chest, back, lateral delts and arms — the session that drives visible width.',
    exercises: [
      {
        name: 'Dips / assisted dips',
        sets: '3 × 6–12',
        rest: '2 min',
        cue: "Chest/triceps. Keep shoulders comfortable; don't bounce.",
      },
      {
        name: 'Chin-up / assisted chin-up',
        sets: '3 × 6–10',
        rest: '2 min',
        cue: 'Pull elbows down; avoid swinging.',
      },
      {
        name: 'Low-incline machine chest press',
        sets: '3 × 8–12',
        rest: '90 sec',
        cue: 'Upper chest focus; controlled stretch.',
      },
      {
        name: 'Cable row',
        sets: '3 × 10–12',
        rest: '90 sec',
        cue: 'Drive elbows back; avoid shrugging.',
      },
      {
        name: 'Lateral raise',
        sets: '4 × 12–20',
        rest: '60 sec',
        cue: 'Lead with elbows; control both directions.',
      },
      {
        name: 'Cable curl',
        sets: '3 × 10–15',
        rest: '60–90 sec',
        cue: 'Full extension; no torso swing.',
      },
      {
        name: 'Cable triceps extension',
        sets: '3 × 10–15',
        rest: '60–90 sec',
        cue: 'Elbows stable; full lockout.',
      },
      {
        name: 'Cable crunch',
        sets: '3 × 10–15',
        rest: '60 sec',
        cue: 'Curl ribs toward pelvis.',
      },
    ],
  },
  {
    focus: 'legs',
    title: 'Legs + Abs',
    day: 'Sunday',
    summary: 'Quads, hamstrings, calves and core — the athletic base under the frame.',
    exercises: [
      {
        name: 'Hack squat / Smith squat',
        sets: '3 × 6–10',
        rest: '2–3 min',
        cue: 'Brace; controlled depth; stable foot pressure.',
      },
      {
        name: 'Leg press',
        sets: '3 × 8–12',
        rest: '2 min',
        cue: "Deep comfortable ROM; don't let pelvis roll.",
      },
      {
        name: 'Romanian deadlift',
        sets: '3 × 8–10',
        rest: '2 min',
        cue: 'Hips back; feel hamstrings; neutral spine.',
      },
      {
        name: 'Leg curl',
        sets: '3 × 10–15',
        rest: '90 sec',
        cue: 'Controlled stretch and hard squeeze.',
      },
      {
        name: 'Leg extension',
        sets: '2 × 12–15',
        rest: '60–90 sec',
        cue: 'Smooth reps; no swinging.',
      },
      {
        name: 'Calf raise',
        sets: '4 × 8–15',
        rest: '60–90 sec',
        cue: 'Pause in stretched and contracted positions.',
      },
      {
        name: 'Hanging leg raise',
        sets: '3 × 8–15',
        rest: '60 sec',
        cue: 'Control pelvis; no swinging.',
      },
    ],
  },
  {
    focus: 'push',
    title: 'Push',
    day: 'Tuesday',
    summary: 'Chest, shoulders and triceps, with lateral raises doing the width work again.',
    exercises: [
      {
        name: 'Smith machine bench press',
        sets: '4 × 6–8',
        rest: '2–3 min',
        cue: 'Stable setup; controlled touch.',
      },
      {
        name: 'Incline DB press',
        sets: '3 × 8–10',
        rest: '90–120 sec',
        cue: 'Upper chest; avoid excessive elbow flare.',
      },
      {
        name: 'Cable fly',
        sets: '2 × 12–15',
        rest: '60–90 sec',
        cue: 'Squeeze without shoulder discomfort.',
      },
      {
        name: 'Machine shoulder press',
        sets: '3 × 8–12',
        rest: '90–120 sec',
        cue: "Controlled; don't force painful ROM.",
      },
      {
        name: 'Lateral raise',
        sets: '4 × 12–20',
        rest: '60–90 sec',
        cue: 'Major shoulder-width builder.',
      },
      {
        name: 'Rope triceps pushdown',
        sets: '3 × 10–15',
        rest: '60–90 sec',
        cue: 'Full extension.',
      },
      {
        name: 'Overhead cable extension',
        sets: '2 × 10–15',
        rest: '60–90 sec',
        cue: 'Long-head triceps stretch.',
      },
    ],
  },
  {
    focus: 'pull',
    title: 'Pull',
    day: 'Thursday',
    summary: 'Lats, upper back, rear delts and biceps — back width and thickness.',
    exercises: [
      {
        name: 'Pull-up / assisted pull-up',
        sets: '3 × 6–10',
        rest: '2 min',
        cue: 'Chest tall; elbows toward hips.',
      },
      {
        name: 'Chest-supported row',
        sets: '3 × 8–12',
        rest: '90–120 sec',
        cue: 'Upper-back thickness.',
      },
      {
        name: 'Lat pulldown',
        sets: '3 × 8–12',
        rest: '90 sec',
        cue: "Pull to upper chest; don't lean excessively.",
      },
      {
        name: 'Single-arm cable lat pulldown',
        sets: '2 × 10–15',
        rest: '60–90 sec',
        cue: 'Think elbow toward hip.',
      },
      {
        name: 'Face pull / rear-delt fly',
        sets: '3 × 12–20',
        rest: '60–90 sec',
        cue: 'Rear delts; light and clean.',
      },
      {
        name: 'DB curl',
        sets: '3 × 8–12',
        rest: '60–90 sec',
        cue: 'No body swing.',
      },
      {
        name: 'Hammer curl',
        sets: '2 × 10–15',
        rest: '60–90 sec',
        cue: 'Neutral grip; controlled.',
      },
    ],
  },
];

/** The playbook's 60-minute session shape (section 7). */
export const sessionStructure = [
  { window: '0–5 min', action: 'General warm-up: treadmill, bike or rower, easy pace.' },
  {
    window: '5–10 min',
    action: 'Movement-specific warm-up plus 2–4 ramp-up sets for the first compound.',
  },
  { window: '10–50 min', action: 'Working sets. Use the prescribed rest; do not rush heavy sets.' },
  {
    window: '50–60 min',
    action: 'Finish priority isolation and core work; log loads and reps before leaving.',
  },
];

/** How to progress, from section 6. Reps first, then load. */
export const progressionRules = [
  'Stay in the listed rep range. Add reps first, then load.',
  'Compounds stop at 1–2 reps in reserve. Do not chase ugly failure.',
  'A last isolation set can approach failure while technique stays clean.',
  'Once every set hits the top of the range cleanly, add the smallest practical load.',
  'Beat last session by one total rep, keeping technique and effort honest.',
];
