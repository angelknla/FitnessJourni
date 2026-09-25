'use server';

import { accentNames, activityTypes, defaultTargets } from '@data/fitnessData';
import { revalidatePath } from 'next/cache';
import { getSupabase } from '@/lib/supabase/server';
import type { AccentName, ActivityType } from '@/types/fitness';

export interface ActionState {
  ok: boolean;
  error?: string;
}

const ok: ActionState = { ok: true };
const fail = (error: string): ActionState => ({ ok: false, error });

const NOT_CONFIGURED = 'Supabase is not connected yet — add SUPABASE_URL and SUPABASE_ANON_KEY.';

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
  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const memberId = toText(formData.get('memberId'));
  if (!memberId) {
    return fail('Pick who these targets are for.');
  }

  const { error } = await supabase
    .from('members')
    .update({
      target_calories: toInt(formData.get('calories'), 20000),
      target_protein: toInt(formData.get('protein'), 1000),
      target_carbs: toInt(formData.get('carbs'), 2000),
      target_fat: toInt(formData.get('fat'), 1000),
      target_steps: toInt(formData.get('steps'), 200000),
      target_steps_min: toInt(formData.get('stepsMin'), 200000),
      target_water_ml: toInt(formData.get('waterMl'), 20000),
    })
    .eq('id', memberId);

  if (error) {
    console.error('[updateTargets]', error.message);
    return fail('Could not save those targets.');
  }

  revalidatePath('/');
  return ok;
};

export const bookSession = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
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
