'use server';

import { accentNames, activityTypes, defaultTargets, workoutFocuses } from '@data/fitnessData';
import { revalidatePath } from 'next/cache';
import { isUnlocked } from '@/lib/session';
import { getSupabase } from '@/lib/supabase/server';
import type { AccentName, ActivityType, WorkoutFocus } from '@/types/fitness';

export interface ActionState {
  ok: boolean;
  error?: string;
}

const ok: ActionState = { ok: true };
const fail = (error: string): ActionState => ({ ok: false, error });

const NOT_CONFIGURED = 'Supabase is not connected yet — add SUPABASE_URL and SUPABASE_ANON_KEY.';
const LOCKED = 'Locked — reload the page and log in.';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^\d{2}:\d{2}$/;

/** Blank inputs mean zero, not NaN. Negatives and absurd values are clamped away. */
const toInt = (value: FormDataEntryValue | null, max: number) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(Math.round(parsed), max);
};

const toText = (value: FormDataEntryValue | null) =>
  typeof value === 'string' ? value.trim() : '';

export const saveDailyLog = async (
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const memberId = toText(formData.get('memberId'));
  const date = toText(formData.get('date'));

  if (!memberId) {
    return fail('Pick who this is for.');
  }
  if (!ISO_DATE.test(date)) {
    return fail('That date looks wrong.');
  }

  const { error } = await supabase.from('daily_logs').upsert(
    {
      member_id: memberId,
      log_date: date,
      steps: toInt(formData.get('steps'), 200000),
      water_ml: toInt(formData.get('waterMl'), 20000),
      calories: toInt(formData.get('calories'), 20000),
      protein_g: toInt(formData.get('proteinG'), 1000),
      carbs_g: toInt(formData.get('carbsG'), 2000),
      fat_g: toInt(formData.get('fatG'), 1000),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,log_date' }
  );

  if (error) {
    console.error('[saveDailyLog]', error.message);
    return fail("Could not save that. It's logged on the server.");
  }

  revalidatePath('/');
  return ok;
};

export const addMember = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const name = toText(formData.get('name'));
  if (!name) {
    return fail('Give them a name.');
  }
  if (name.length > 40) {
    return fail('That name is too long.');
  }

  const requested = toText(formData.get('accent')) as AccentName;
  const accent: AccentName = accentNames.includes(requested) ? requested : 'violet';

  const { error } = await supabase.from('members').insert({
    name,
    accent,
    sort_order: toInt(formData.get('sortOrder'), 999),
    target_calories: defaultTargets.calories,
    target_protein: defaultTargets.protein,
    target_carbs: defaultTargets.carbs,
    target_fat: defaultTargets.fat,
    target_steps: defaultTargets.steps,
    target_steps_min: defaultTargets.stepsMin,
    target_water_ml: defaultTargets.waterMl,
  });

  if (error) {
    console.error('[addMember]', error.message);
    return fail('Could not add them.');
  }

  revalidatePath('/');
  return ok;
};

export const updateTargets = async (
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const memberId = toText(formData.get('memberId'));
  if (!memberId) {
    return fail('Pick who these targets are for.');
  }

  /*
   * Patch only the fields actually submitted. Writing all seven every time meant
   * a form covering just the macros would send nothing for steps, water and
   * calories and silently zero those targets — and a zero target makes its meter
   * read "of 0". A target of 0 is never meaningful, so each one must be >= 1.
   */
  const patch: Record<string, number> = {};
  const invalid: string[] = [];

  const field = (name: string, column: string, max: number, label: string) => {
    const raw = formData.get(name);
    if (raw === null || String(raw).trim() === '') {
      return;
    }

    const value = toInt(raw, max);
    if (value < 1) {
      invalid.push(label);
      return;
    }

    patch[column] = value;
  };

  field('calories', 'target_calories', 20000, 'calories');
  field('protein', 'target_protein', 1000, 'protein');
  field('carbs', 'target_carbs', 2000, 'carbs');
  field('fat', 'target_fat', 1000, 'fat');
  field('steps', 'target_steps', 200000, 'steps');
  field('stepsMin', 'target_steps_min', 200000, 'step minimum');
  field('waterMl', 'target_water_ml', 20000, 'water');

  if (invalid.length > 0) {
    return fail(`A target has to be at least 1 — check ${invalid.join(', ')}.`);
  }

  if (Object.keys(patch).length === 0) {
    return fail('Nothing to change.');
  }

  const { error } = await supabase.from('members').update(patch).eq('id', memberId);

  if (error) {
    console.error('[updateTargets]', error.message);
    return fail('Could not save those targets.');
  }

  revalidatePath('/');
  return ok;
};

export const bookSession = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const date = toText(formData.get('date'));
  const time = toText(formData.get('time'));
  const activity = toText(formData.get('activity')) as ActivityType;
  const note = toText(formData.get('note'));
  const createdBy = toText(formData.get('createdBy'));

  if (!ISO_DATE.test(date)) {
    return fail('Pick a day.');
  }
  if (!HH_MM.test(time)) {
    return fail('Pick a time.');
  }
  if (!activityTypes.includes(activity)) {
    return fail('Pick an activity.');
  }

  const { error } = await supabase.from('sessions').insert({
    session_date: date,
    session_time: time,
    activity,
    note: note ? note.slice(0, 200) : null,
    created_by: createdBy || null,
  });

  if (error) {
    console.error('[bookSession]', error.message);
    return fail('Could not book that.');
  }

  revalidatePath('/sessions');
  return ok;
};

export const deleteSession = async (
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const id = toText(formData.get('id'));
  if (!id) {
    return fail('Nothing to remove.');
  }

  const { error } = await supabase.from('sessions').delete().eq('id', id);

  if (error) {
    console.error('[deleteSession]', error.message);
    return fail('Could not remove that.');
  }

  revalidatePath('/sessions');
  return ok;
};

export const logWorkout = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const memberId = toText(formData.get('memberId'));
  const date = toText(formData.get('date'));
  const note = toText(formData.get('note'));

  // Several checkboxes share the name "focus", so read them all and keep only
  // recognised values — de-duplicated, since the array has a length ceiling.
  const focuses = [
    ...new Set(
      formData
        .getAll('focus')
        .map((value) => String(value))
        .filter((value): value is WorkoutFocus => workoutFocuses.includes(value as WorkoutFocus))
    ),
  ];

  if (!memberId) {
    return fail('Pick who trained.');
  }
  if (!ISO_DATE.test(date)) {
    return fail('That date looks wrong.');
  }
  if (focuses.length === 0) {
    return fail('Pick at least one thing you trained.');
  }

  const { error } = await supabase.from('workouts').insert({
    member_id: memberId,
    workout_date: date,
    focuses,
    note: note ? note.slice(0, 200) : null,
  });

  if (error) {
    console.error('[logWorkout]', error.message);
    return fail('Could not log that workout.');
  }

  revalidatePath('/');
  revalidatePath('/workouts');
  return ok;
};

export const deleteWorkout = async (
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const id = toText(formData.get('id'));
  if (!id) {
    return fail('Nothing to remove.');
  }

  const { error } = await supabase.from('workouts').delete().eq('id', id);

  if (error) {
    console.error('[deleteWorkout]', error.message);
    return fail('Could not remove that workout.');
  }

  revalidatePath('/');
  revalidatePath('/workouts');
  return ok;
};
