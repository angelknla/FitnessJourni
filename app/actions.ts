'use server';

import {
  accentNames,
  activityLabels,
  activityTypes,
  defaultTargets,
  workoutFocuses,
} from '@data/fitnessData';
import { revalidatePath } from 'next/cache';
import { getMembers } from '@/lib/data/members';
import { ADMIN_MEMBER_NAME, canEditMember, canRemoveMembers } from '@/lib/ownership';
import { isUnlocked, readViewer } from '@/lib/session';
import { getSupabase } from '@/lib/supabase/server';
import type { AccentName, ActivityType, WorkoutFocus } from '@/types/fitness';

export interface ActionState {
  ok: boolean;
  error?: string;
  /** Success text built where the values are known, so the client need not. */
  message?: string;
  /**
   * Changes on every successful booking. Gives the form a primitive to key its
   * reset effect on, instead of depending on the whole state object and dragging
   * every field into the dependency list.
   */
  bookedAt?: number;
  /**
   * The member addMember just created. Returned so the form can offer to sign in
   * as them, which is the only way a first identity can be picked on a fresh
   * deploy — before this there is nobody to be.
   */
  newMemberId?: string;
  newMemberName?: string;
  newMemberAccent?: AccentName;
}

const ok: ActionState = { ok: true };
const fail = (error: string): ActionState => ({ ok: false, error });

const NOT_CONFIGURED = 'Supabase is not connected yet — add SUPABASE_URL and SUPABASE_ANON_KEY.';
const LOCKED = 'Locked — reload the page and log in.';
const NOT_YOURS = 'You can only change your own numbers — switch person first.';

/*
 * The forms hide themselves when they are not yours, but that is presentation:
 * memberId travels as a hidden input and can be edited by hand, so the decision
 * has to be remade here against the cookie. Visitors fail this for every row.
 */
const refuseUnlessOwn = async (memberId: string): Promise<string | null> =>
  canEditMember(await readViewer(), memberId) ? null : NOT_YOURS;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^\d{2}:\d{2}$/;
const MONTH_INPUT = /^\d{4}-\d{2}$/;

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

const toOptionalNumber = (value: FormDataEntryValue | null): number | null => {
  const text = toText(value);
  return text === '' ? null : Number(text);
};

export const saveProfileDetails = async (
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
  const age = toOptionalNumber(formData.get('age'));
  const heightCm = toOptionalNumber(formData.get('heightCm'));
  const targetWeightKg = toOptionalNumber(formData.get('targetWeightKg'));
  const targetBmi = toOptionalNumber(formData.get('targetBmi'));
  const notYours = await refuseUnlessOwn(memberId);

  if (notYours) {
    return fail(notYours);
  }
  if (age !== null && (!Number.isInteger(age) || age < 13 || age > 120)) {
    return fail('Enter an age from 13 to 120.');
  }
  if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250)) {
    return fail('Enter a height from 100 to 250 cm.');
  }
  if (
    targetWeightKg !== null &&
    (!Number.isFinite(targetWeightKg) || targetWeightKg < 25 || targetWeightKg > 500)
  ) {
    return fail('Enter a weight goal from 25 to 500 kg.');
  }
  if (targetBmi !== null && (!Number.isFinite(targetBmi) || targetBmi < 10 || targetBmi > 60)) {
    return fail('Enter a BMI goal from 10 to 60.');
  }

  const { error } = await supabase
    .from('members')
    .update({
      age,
      height_cm: heightCm,
      target_weight_kg: targetWeightKg,
      target_bmi: targetBmi,
    })
    .eq('id', memberId);

  if (error) {
    console.error('[saveProfileDetails]', error.message);
    return fail('Could not save your profile.');
  }

  revalidatePath('/profile');
  return { ok: true, message: 'Profile saved.' };
};

export const saveWeightMeasurement = async (
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
  const monthInput = toText(formData.get('month'));
  const month = MONTH_INPUT.test(monthInput) ? `${monthInput}-01` : '';
  const weightKg = Number(formData.get('weightKg'));
  const notYours = await refuseUnlessOwn(memberId);

  if (notYours) {
    return fail(notYours);
  }
  if (!month) {
    return fail('Choose a month.');
  }
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 500) {
    return fail('Enter a weight from 25 to 500 kg.');
  }

  const { error } = await supabase.from('weight_measurements').upsert(
    {
      member_id: memberId,
      month_start: month,
      weight_kg: Math.round(weightKg * 100) / 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,month_start' }
  );

  if (error) {
    console.error('[saveWeightMeasurement]', error.message);
    return fail('Could not save that weight.');
  }

  revalidatePath('/profile');
  return { ok: true, message: 'Monthly weight saved.' };
};

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

  const notYours = await refuseUnlessOwn(memberId);
  if (notYours) {
    return fail(notYours);
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

  /*
   * Deliberately not ownership-checked, unlike the other writes: a visitor has to
   * be able to add someone, or an empty members table deadlocks — with nobody to
   * be, everyone is a visitor, and no visitor could ever create the first person.
   * It only ever inserts a new row, so it cannot overwrite anyone.
   */
  const { data, error } = await supabase
    .from('members')
    .insert({
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
    })
    .select('id, name')
    .single();

  if (error) {
    console.error('[addMember]', error.message);
    return fail('Could not add them.');
  }

  revalidatePath('/');
  return {
    ok: true,
    newMemberId: data.id as string,
    newMemberName: data.name as string,
    newMemberAccent: accent,
  };
};

/**
 * Removes a person and everything of theirs. Only the admin member may do this.
 *
 * Their logs and workouts go with them through the schema's on delete cascade;
 * sessions they booked survive with created_by set null, so a group booking does
 * not vanish because the person who entered it left.
 */
export const removeMember = async (
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
    return fail('Pick who to remove.');
  }

  /*
   * Re-checked here, not just hidden in the UI: the button being absent is not a
   * guard, and this one deletes rows that cascade.
   */
  const [viewer, members] = await Promise.all([readViewer(), getMembers()]);

  if (!canRemoveMembers(viewer, members)) {
    return fail(`Only ${ADMIN_MEMBER_NAME} can remove people.`);
  }

  const target = members.find((member) => member.id === memberId);
  if (!target) {
    return fail('They are already gone.');
  }

  const { error } = await supabase.from('members').delete().eq('id', memberId);

  if (error) {
    console.error('[removeMember]', error.message);
    return fail('Could not remove them.');
  }

  revalidatePath('/');
  revalidatePath('/logs');
  revalidatePath('/workouts');
  revalidatePath('/sessions');

  return { ok: true, message: `${target.name} and all their entries are gone.` };
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

  const notYours = await refuseUnlessOwn(memberId);
  if (notYours) {
    return fail(notYours);
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

  /*
   * Nothing confirmed a booking before, so a second tap was easy and produced a
   * duplicate row. Checked in the app rather than with a unique constraint, so the
   * message can say what clashed. Two people booking the same slot in the same
   * instant could still slip through; at this size that is not worth a migration.
   */
  const { data: clash } = await supabase
    .from('sessions')
    .select('id')
    .eq('session_date', date)
    .eq('session_time', time)
    .eq('activity', activity)
    .limit(1);

  if (clash && clash.length > 0) {
    return fail(`There is already a ${activityLabels[activity].toLowerCase()} booked at ${time}.`);
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
  revalidatePath('/', 'layout');

  const dayLabel = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00`));

  return {
    ok: true,
    message: `${activityLabels[activity]} booked for ${dayLabel} at ${time}.`,
    bookedAt: Date.now(),
  };
};

export const respondToSession = async (
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

  const sessionId = toText(formData.get('sessionId'));
  const memberId = toText(formData.get('memberId'));
  const status = toText(formData.get('status'));

  if (!sessionId || !memberId || !['going', 'not_going'].includes(status)) {
    return fail('Choose a response.');
  }

  const notYours = await refuseUnlessOwn(memberId);
  if (notYours) {
    return fail(notYours);
  }

  const { error } = await supabase.from('session_rsvps').upsert(
    {
      session_id: sessionId,
      member_id: memberId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,member_id' }
  );

  if (error) {
    console.error('[respondToSession]', error.message);
    return fail('Could not save your response.');
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
  // The next-session banner lives in the layout, so it needs refreshing too.
  revalidatePath('/', 'layout');
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

  const notYours = await refuseUnlessOwn(memberId);
  if (notYours) {
    return fail(notYours);
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

  /*
   * This form sends only the row id, so whose workout it is has to be looked up
   * before it can be checked — there is no memberId to compare against.
   */
  const { data: row } = await supabase
    .from('workouts')
    .select('member_id')
    .eq('id', id)
    .maybeSingle();

  if (!row) {
    return fail('That workout is already gone.');
  }

  const notYours = await refuseUnlessOwn(row.member_id as string);
  if (notYours) {
    return fail(notYours);
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

export const logRun = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const createdBy = toText(formData.get('createdBy'));
  const date = toText(formData.get('date'));
  const hours = toInt(formData.get('hours'), 24);
  const minutes = toInt(formData.get('minutes'), 59);
  const distanceKm = Number(formData.get('distanceKm'));
  const paceMinutesText = toText(formData.get('paceMinutes'));
  const paceSecondsText = toText(formData.get('paceSeconds'));
  const hasManualPace = paceMinutesText !== '' || paceSecondsText !== '';
  const paceMinutes = Number(paceMinutesText || 0);
  const paceSeconds = Number(paceSecondsText || 0);
  const manualPaceSeconds = paceMinutes * 60 + paceSeconds;
  const durationMinutes = hours * 60 + minutes;

  if (!createdBy) {
    return fail('Pick who is logging this run.');
  }
  if (!ISO_DATE.test(date)) {
    return fail('Pick a valid run date.');
  }
  if (durationMinutes < 1 || durationMinutes > 1440) {
    return fail('Enter how long the run took.');
  }
  if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 1000) {
    return fail('Enter the distance in kilometres.');
  }
  if (
    hasManualPace &&
    (!Number.isInteger(paceMinutes) ||
      !Number.isInteger(paceSeconds) ||
      paceMinutes < 0 ||
      paceSeconds < 0 ||
      paceSeconds > 59 ||
      manualPaceSeconds < 1 ||
      manualPaceSeconds > 7200)
  ) {
    return fail('Enter pace as minutes and seconds per kilometre.');
  }

  const notYours = await refuseUnlessOwn(createdBy);
  if (notYours) {
    return fail(notYours);
  }

  const members = await getMembers();
  const memberIds = new Set(members.map((member) => member.id));
  const attendeeIds = [
    ...new Set([createdBy, ...formData.getAll('attendee').map((value) => String(value))]),
  ].filter((memberId) => memberIds.has(memberId));

  const { data: run, error: runError } = await supabase
    .from('runs')
    .insert({
      run_date: date,
      duration_minutes: durationMinutes,
      distance_km: Math.round(distanceKm * 100) / 100,
      pace_seconds_per_km: hasManualPace ? manualPaceSeconds : null,
      created_by: createdBy,
    })
    .select('id')
    .single();

  if (runError || !run) {
    console.error('[logRun]', runError?.message ?? 'Run insert returned no row.');
    return fail('Could not log that run.');
  }

  const { error: attendeeError } = await supabase.from('run_attendees').insert(
    attendeeIds.map((memberId) => ({
      run_id: run.id,
      member_id: memberId,
    }))
  );

  if (attendeeError) {
    await supabase.from('runs').delete().eq('id', run.id);
    console.error('[logRun attendees]', attendeeError.message);
    return fail('Could not save who attended.');
  }

  revalidatePath('/running');
  return ok;
};

export const deleteRun = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
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

  const { data: run } = await supabase.from('runs').select('created_by').eq('id', id).maybeSingle();
  if (!run?.created_by) {
    return fail('That run is already gone.');
  }

  const notYours = await refuseUnlessOwn(run.created_by as string);
  if (notYours) {
    return fail(notYours);
  }

  const { error } = await supabase.from('runs').delete().eq('id', id);
  if (error) {
    console.error('[deleteRun]', error.message);
    return fail('Could not remove that run.');
  }

  revalidatePath('/running');
  return ok;
};
