'use server';

import {
  AVATAR_UPLOAD_BUCKET,
  AVATAR_UPLOAD_MAX_BYTES,
  avatarObjectPath,
  avatarUploadTypes,
  isAvatarPath,
} from '@data/avatarData';
import {
  accentNames,
  activityLabels,
  activityTypes,
  defaultTargets,
  workoutFocuses,
} from '@data/fitnessData';
import { minutesOfTime, toISODate } from '@utils/date';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from '@/lib/account';
import { COOKIE_MAX_AGE, createViewerToken, VIEWER_COOKIE } from '@/lib/auth';
import { createCredentials, findAccountByUsername } from '@/lib/data/accounts';
import { getMembers } from '@/lib/data/members';
import { canModifyMessage } from '@/lib/messagePolicy';
import { ADMIN_MEMBER_NAME, canEditMember, canRemoveMember } from '@/lib/ownership';
import { hasEnrollmentAccess, isUnlocked, readViewer } from '@/lib/session';
import { getSupabase } from '@/lib/supabase/server';
import type { AccentName, ActivityType, MessageReactionType, WorkoutFocus } from '@/types/fitness';

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
  /** The message postMessage just created, used to scroll after refreshed data arrives. */
  messageId?: string;
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

const NOT_CONFIGURED =
  'Supabase is not connected yet — add SUPABASE_URL and a Supabase server key.';
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

export const saveAvatar = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const memberId = toText(formData.get('memberId'));
  const avatarPathEntry = formData.get('avatarPath');
  const avatarFileEntry = formData.get('avatarFile');
  const avatarFile =
    avatarFileEntry instanceof File && avatarFileEntry.size > 0 ? avatarFileEntry : null;
  const notYours = await refuseUnlessOwn(memberId);

  if (notYours) {
    return fail(notYours);
  }

  let avatarPath: string | null;

  if (avatarFile) {
    if (!avatarUploadTypes.includes(avatarFile.type as (typeof avatarUploadTypes)[number])) {
      return fail('Upload a JPEG, PNG or WebP image.');
    }
    if (avatarFile.size > AVATAR_UPLOAD_MAX_BYTES) {
      return fail('Profile pictures must be 5 MB or smaller.');
    }

    const objectPath = avatarObjectPath(memberId);
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_UPLOAD_BUCKET)
      .upload(objectPath, avatarFile, {
        cacheControl: '3600',
        contentType: avatarFile.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[saveAvatar:upload]', uploadError.message);
      return fail('Could not upload your profile picture.');
    }

    const { data } = supabase.storage.from(AVATAR_UPLOAD_BUCKET).getPublicUrl(objectPath);
    avatarPath = `${data.publicUrl}?v=${Date.now()}`;
  } else {
    const submittedPath = toText(avatarPathEntry);
    const objectUrl = supabase.storage
      .from(AVATAR_UPLOAD_BUCKET)
      .getPublicUrl(avatarObjectPath(memberId)).data.publicUrl;
    const isOwnUpload = (() => {
      try {
        const submitted = new URL(submittedPath);
        const expected = new URL(objectUrl);
        return submitted.origin === expected.origin && submitted.pathname === expected.pathname;
      } catch {
        return false;
      }
    })();

    if (avatarPathEntry === null || (!isAvatarPath(submittedPath) && !isOwnUpload)) {
      return fail('Choose or upload a profile picture.');
    }
    avatarPath = submittedPath || null;
  }

  const { error } = await supabase
    .from('members')
    .update({ avatar_path: avatarPath })
    .eq('id', memberId);

  if (error) {
    console.error('[saveAvatar]', error.message);
    return fail('Could not save your profile picture.');
  }

  revalidatePath('/profile');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Profile picture saved.', bookedAt: Date.now() };
};

export const saveProfileAccent = async (
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
  const requestedAccent = toText(formData.get('accent'));
  const notYours = await refuseUnlessOwn(memberId);

  if (notYours) {
    return fail(notYours);
  }
  if (!(accentNames as readonly string[]).includes(requestedAccent)) {
    return fail('Choose a valid profile colour.');
  }

  const accent = requestedAccent as AccentName;
  const accentTaken = (await getMembers()).some(
    (member) => member.id !== memberId && member.accent === accent
  );
  if (accentTaken) {
    return fail('That profile colour is already assigned.');
  }

  const { error } = await supabase.from('members').update({ accent }).eq('id', memberId);

  if (error) {
    console.error('[saveProfileAccent]', error.message);
    return fail('Could not save your profile colour.');
  }

  revalidatePath('/profile');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Profile colour saved.', bookedAt: Date.now() };
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
  const name = toText(formData.get('name'));
  const surname = toText(formData.get('surname'));
  const age = toOptionalNumber(formData.get('age'));
  const heightCm = toOptionalNumber(formData.get('heightCm'));
  const targetWeightKg = toOptionalNumber(formData.get('targetWeightKg'));
  const targetBmi = toOptionalNumber(formData.get('targetBmi'));
  const targetSleepHours = toOptionalNumber(formData.get('targetSleepHours'));
  const targetCalories = toOptionalNumber(formData.get('targetCalories'));
  const targetProtein = toOptionalNumber(formData.get('targetProtein'));
  const targetCarbs = toOptionalNumber(formData.get('targetCarbs'));
  const targetFat = toOptionalNumber(formData.get('targetFat'));
  const saveCurrentWeight = formData.get('saveCurrentWeight') === 'true';
  const currentDateInput = toText(formData.get('currentDate'));
  const currentDate = ISO_DATE.test(currentDateInput) ? currentDateInput : '';
  const currentWeightKg = toOptionalNumber(formData.get('currentWeightKg'));
  const notYours = await refuseUnlessOwn(memberId);

  if (notYours) {
    return fail(notYours);
  }
  if (!name || name.length > 50) {
    return fail('Enter a first name up to 50 characters.');
  }
  if (surname.length > 50) {
    return fail('Keep the surname under 50 characters.');
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
  if (
    targetSleepHours !== null &&
    (!Number.isFinite(targetSleepHours) || targetSleepHours < 1 || targetSleepHours > 24)
  ) {
    return fail('Enter a sleep target from 1 to 24 hours.');
  }
  const nutritionTargets = [
    { value: targetCalories, max: 20000, label: 'calorie' },
    { value: targetProtein, max: 1000, label: 'protein' },
    { value: targetCarbs, max: 2000, label: 'carb' },
    { value: targetFat, max: 1000, label: 'fat' },
  ];
  const invalidNutritionTarget = nutritionTargets.find(
    ({ value, max }) => value !== null && (!Number.isInteger(value) || value < 1 || value > max)
  );
  if (invalidNutritionTarget) {
    return fail(`Enter a valid ${invalidNutritionTarget.label} target.`);
  }
  if (
    saveCurrentWeight &&
    (!currentDate ||
      currentWeightKg === null ||
      !Number.isFinite(currentWeightKg) ||
      currentWeightKg < 25 ||
      currentWeightKg > 500)
  ) {
    return fail('Enter a current weight from 25 to 500 kg.');
  }

  const { error } = await supabase
    .from('members')
    .update({
      name,
      surname: surname || null,
      age,
      height_cm: heightCm,
      target_weight_kg: targetWeightKg,
      target_bmi: targetBmi,
      ...(targetSleepHours !== null
        ? { target_sleep_hours: Math.round(targetSleepHours * 100) / 100 }
        : {}),
      ...(targetCalories !== null ? { target_calories: targetCalories } : {}),
      ...(targetProtein !== null ? { target_protein: targetProtein } : {}),
      ...(targetCarbs !== null ? { target_carbs: targetCarbs } : {}),
      ...(targetFat !== null ? { target_fat: targetFat } : {}),
    })
    .eq('id', memberId);

  if (error) {
    console.error('[saveProfileDetails]', error.message);
    return fail('Could not save your profile.');
  }

  if (saveCurrentWeight && currentWeightKg !== null) {
    const { error: weightError } = await supabase.from('weight_measurements').upsert(
      {
        member_id: memberId,
        month_start: `${currentDate.slice(0, 7)}-01`,
        measured_on: currentDate,
        weight_kg: Math.round(currentWeightKg * 100) / 100,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'member_id,measured_on' }
    );

    if (weightError) {
      console.error('[saveProfileDetails:weight]', weightError.message);
      return fail('Your profile saved, but the current weight did not. Try that weight again.');
    }
  }

  revalidatePath('/profile');
  revalidatePath('/logs');
  revalidatePath('/', 'layout');
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
  const dateInput = toText(formData.get('date'));
  const measuredOn = ISO_DATE.test(dateInput) ? dateInput : '';
  const weightKg = Number(formData.get('weightKg'));
  const notYours = await refuseUnlessOwn(memberId);

  if (notYours) {
    return fail(notYours);
  }
  if (!measuredOn) {
    return fail('Choose a date.');
  }
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 500) {
    return fail('Enter a weight from 25 to 500 kg.');
  }

  const { error } = await supabase.from('weight_measurements').upsert(
    {
      member_id: memberId,
      month_start: `${measuredOn.slice(0, 7)}-01`,
      measured_on: measuredOn,
      weight_kg: Math.round(weightKg * 100) / 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,measured_on' }
  );

  if (error) {
    console.error('[saveWeightMeasurement]', error.message);
    return fail('Could not save that weight.');
  }

  revalidatePath('/profile');
  return { ok: true, message: 'Weight saved.' };
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
  return { ok: true, message: 'Data saved.' };
};

export const saveSleep = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const memberId = toText(formData.get('memberId'));
  const date = toText(formData.get('date'));
  const sleepHours = Number(formData.get('sleepHours'));

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
  if (!Number.isFinite(sleepHours) || sleepHours < 0.1 || sleepHours > 24) {
    return fail('Enter sleep from 0.1 to 24 hours.');
  }

  const { error } = await supabase.from('daily_logs').upsert(
    {
      member_id: memberId,
      log_date: date,
      sleep_hours: Math.round(sleepHours * 10) / 10,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,log_date' }
  );

  if (error) {
    console.error('[saveSleep]', error.message);
    return fail('Could not save that sleep.');
  }

  revalidatePath('/');
  revalidatePath('/logs');
  return { ok: true, message: 'Sleep saved.', bookedAt: Date.now() };
};

export const addMember = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await hasEnrollmentAccess())) {
    return fail('Enter the app passcode before creating a user.');
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

  const username = normalizeUsername(toText(formData.get('username')));
  const email = normalizeEmail(toText(formData.get('email')));
  const password = String(formData.get('password') ?? '');
  if (!isValidUsername(username)) {
    return fail('Use 3–30 lowercase letters, numbers, dots, dashes or underscores.');
  }
  if (!isValidEmail(email)) {
    return fail('Enter a valid email address.');
  }
  if (!isValidPassword(password)) {
    return fail('Use a password between 8 and 128 characters.');
  }

  const requested = toText(formData.get('accent')) as AccentName;
  const accent: AccentName = accentNames.includes(requested) ? requested : 'violet';
  const avatarPath = toText(formData.get('avatarPath'));
  const avatarFileEntry = formData.get('avatarFile');
  const avatarFile =
    avatarFileEntry instanceof File && avatarFileEntry.size > 0 ? avatarFileEntry : null;
  if (!avatarFile && !isAvatarPath(avatarPath)) {
    return fail('Choose a valid profile picture.');
  }
  if (
    avatarFile &&
    !avatarUploadTypes.includes(avatarFile.type as (typeof avatarUploadTypes)[number])
  ) {
    return fail('Upload a JPEG, PNG or WebP image.');
  }
  if (avatarFile && avatarFile.size > AVATAR_UPLOAD_MAX_BYTES) {
    return fail('Profile pictures must be 5 MB or smaller.');
  }

  const { data, error } = await supabase
    .from('members')
    .insert({
      name,
      accent,
      avatar_path: avatarPath || null,
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

  if (avatarFile) {
    const memberId = data.id as string;
    const objectPath = avatarObjectPath(memberId);
    const { error: uploadError } = await supabase.storage
      .from(AVATAR_UPLOAD_BUCKET)
      .upload(objectPath, avatarFile, {
        cacheControl: '3600',
        contentType: avatarFile.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('[addMember:upload]', uploadError.message);
      await supabase.from('members').delete().eq('id', memberId);
      return fail('Could not upload their profile picture.');
    }

    const publicUrl = supabase.storage.from(AVATAR_UPLOAD_BUCKET).getPublicUrl(objectPath)
      .data.publicUrl;
    const { error: avatarError } = await supabase
      .from('members')
      .update({ avatar_path: `${publicUrl}?v=${Date.now()}` })
      .eq('id', memberId);

    if (avatarError) {
      console.error('[addMember:avatar]', avatarError.message);
      await supabase.storage.from(AVATAR_UPLOAD_BUCKET).remove([objectPath]);
      await supabase.from('members').delete().eq('id', memberId);
      return fail('Could not save their profile picture.');
    }
  }

  const credentialError = await createCredentials(
    data.id as string,
    username,
    email,
    await hashPassword(password)
  );
  if (credentialError) {
    if (avatarFile) {
      await supabase.storage.from(AVATAR_UPLOAD_BUCKET).remove([avatarObjectPath(data.id as string)]);
    }
    await supabase.from('members').delete().eq('id', data.id as string);
    return fail(credentialError);
  }

  const store = await cookies();
  store.set(
    VIEWER_COOKIE,
    await createViewerToken(data.id as string, process.env.APP_PASSCODE as string),
    {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    }
  );

  revalidatePath('/');
  return {
    ok: true,
    newMemberId: data.id as string,
    newMemberName: data.name as string,
    newMemberAccent: accent,
  };
};

export const linkMemberByUsername = async (
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> => {
  if (!(await isUnlocked())) return fail(LOCKED);
  const viewer = await readViewer();
  if (!viewer.memberId) return fail('Log in before linking a user.');

  const username = normalizeUsername(toText(formData.get('username')));
  if (!isValidUsername(username)) return fail('Enter a valid username.');

  const account = await findAccountByUsername(username);
  if (!account) return fail('No user has that username.');
  if (account.memberId === viewer.memberId) return fail('That is already your account.');

  const supabase = getSupabase();
  if (!supabase) return fail(NOT_CONFIGURED);
  const { error } = await supabase.from('member_links').upsert([
    { member_id: viewer.memberId, linked_member_id: account.memberId },
    { member_id: account.memberId, linked_member_id: viewer.memberId },
  ]);
  if (error) {
    console.error('[linkMemberByUsername]', error.message);
    return fail('Could not link that user.');
  }

  const linked = (await getMembers()).find((member) => member.id === account.memberId);
  revalidatePath('/', 'layout');
  return { ok: true, message: `${linked?.name ?? account.username} linked.` };
};

/**
 * Removes a person and everything of theirs. The admin may remove anyone;
 * everyone else may remove only themselves.
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

  const target = members.find((member) => member.id === memberId);
  if (!target) {
    return fail('They are already gone.');
  }

  if (!canRemoveMember(viewer, memberId, members)) {
    return fail(`Only ${ADMIN_MEMBER_NAME} can remove another person.`);
  }

  const { error } = await supabase.from('members').delete().eq('id', memberId);

  if (error) {
    console.error('[removeMember]', error.message);
    return fail('Could not remove them.');
  }

  const { error: avatarError } = await supabase.storage
    .from(AVATAR_UPLOAD_BUCKET)
    .remove([avatarObjectPath(memberId)]);
  if (avatarError) {
    console.error('[removeMember:avatar]', avatarError.message);
  }

  if (viewer.memberId === memberId) {
    (await cookies()).delete(VIEWER_COOKIE);
  }

  revalidatePath('/');
  revalidatePath('/profile');
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
  const sleepHoursRaw = formData.get('sleepHours');
  if (sleepHoursRaw !== null && String(sleepHoursRaw).trim() !== '') {
    const sleepHours = Number(sleepHoursRaw);
    if (!Number.isFinite(sleepHours) || sleepHours < 1 || sleepHours > 24) {
      invalid.push('sleep hours');
    } else {
      patch.target_sleep_hours = Math.round(sleepHours * 100) / 100;
    }
  }

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
  revalidatePath('/logs');
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
  const now = new Date();
  const today = toISODate(now);
  if (
    date < today ||
    (date === today && minutesOfTime(time) <= now.getHours() * 60 + now.getMinutes())
  ) {
    return fail('Pick a future time.');
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

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      session_date: date,
      session_time: time,
      activity,
      note: note ? note.slice(0, 200) : null,
      created_by: createdBy || null,
    })
    .select('created_at')
    .single();

  if (error || !session) {
    console.error('[bookSession]', error?.message ?? 'Session insert returned no row.');
    return fail('Could not book that.');
  }

  if (createdBy) {
    const { error: readError } = await supabase
      .from('session_reads')
      .upsert(
        { member_id: createdBy, last_read_at: session.created_at },
        { onConflict: 'member_id' }
      );
    if (readError) {
      console.error('[bookSession read cursor]', readError.message);
    }
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
  const minutes = Number(formData.get('minutes') ?? 0);
  const distanceKm = Number(formData.get('distanceKm'));
  const paceMinutesText = toText(formData.get('paceMinutes'));
  const paceSecondsText = toText(formData.get('paceSeconds'));
  const hasManualPace = paceMinutesText !== '' || paceSecondsText !== '';
  const paceMinutes = Number(paceMinutesText || 0);
  const paceSeconds = Number(paceSecondsText || 0);
  const manualPaceSeconds = paceMinutes * 60 + paceSeconds;
  const durationMinutes = Math.round((hours * 60 + minutes) * 10) / 10;

  if (!createdBy) {
    return fail('Pick who is logging this run.');
  }
  if (!ISO_DATE.test(date)) {
    return fail('Pick a valid run date.');
  }
  if (
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > 59.9 ||
    Math.abs(minutes - Math.round(minutes * 10) / 10) > 1e-9 ||
    durationMinutes < 1 ||
    durationMinutes > 1440
  ) {
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

export const editRun = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const id = toText(formData.get('id'));
  const date = toText(formData.get('date'));
  const hours = toInt(formData.get('hours'), 24);
  const minutes = Number(formData.get('minutes') ?? 0);
  const distanceKm = Number(formData.get('distanceKm'));
  const paceMinutesText = toText(formData.get('paceMinutes'));
  const paceSecondsText = toText(formData.get('paceSeconds'));
  const hasManualPace = paceMinutesText !== '' || paceSecondsText !== '';
  const paceMinutes = Number(paceMinutesText || 0);
  const paceSeconds = Number(paceSecondsText || 0);
  const manualPaceSeconds = paceMinutes * 60 + paceSeconds;
  const durationMinutes = Math.round((hours * 60 + minutes) * 10) / 10;

  if (!id) {
    return fail('That run is missing.');
  }
  if (!ISO_DATE.test(date)) {
    return fail('Pick a valid run date.');
  }
  if (
    !Number.isFinite(minutes) ||
    minutes < 0 ||
    minutes > 59.9 ||
    Math.abs(minutes - Math.round(minutes * 10) / 10) > 1e-9 ||
    durationMinutes < 1 ||
    durationMinutes > 1440
  ) {
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

  const { data: run } = await supabase.from('runs').select('created_by').eq('id', id).maybeSingle();
  if (!run?.created_by) {
    return fail('That run is already gone.');
  }

  const createdBy = run.created_by as string;
  const notYours = await refuseUnlessOwn(createdBy);
  if (notYours) {
    return fail(notYours);
  }

  const members = await getMembers();
  const memberIds = new Set(members.map((member) => member.id));
  const attendeeIds = [
    ...new Set([createdBy, ...formData.getAll('attendee').map((value) => String(value))]),
  ].filter((memberId) => memberIds.has(memberId));

  const { error: runError } = await supabase
    .from('runs')
    .update({
      run_date: date,
      duration_minutes: durationMinutes,
      distance_km: Math.round(distanceKm * 100) / 100,
      pace_seconds_per_km: hasManualPace ? manualPaceSeconds : null,
    })
    .eq('id', id);

  if (runError) {
    console.error('[editRun]', runError.message);
    return fail('Could not update that run.');
  }

  const { error: clearError } = await supabase.from('run_attendees').delete().eq('run_id', id);
  if (clearError) {
    console.error('[editRun attendees:clear]', clearError.message);
    return fail('Could not update who attended.');
  }

  const { error: attendeeError } = await supabase.from('run_attendees').insert(
    attendeeIds.map((memberId) => ({
      run_id: id,
      member_id: memberId,
    }))
  );

  if (attendeeError) {
    console.error('[editRun attendees]', attendeeError.message);
    return fail('Could not update who attended.');
  }

  revalidatePath('/running');
  return { ok: true, bookedAt: Date.now() };
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

export const postMessage = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const viewer = await readViewer();
  const content = toText(formData.get('content'));
  const replyToId = toText(formData.get('replyToId')) || null;

  if (!viewer.memberId) {
    return fail('Choose who you are before posting.');
  }
  if (!content) {
    return fail('Write something to share.');
  }
  if (content.length > 500) {
    return fail('Keep your post under 500 characters.');
  }

  let insertResult = await supabase
    .from('messages')
    .insert({ member_id: viewer.memberId, content, reply_to_id: replyToId })
    .select('id, created_at')
    .single();

  if (!replyToId && insertResult.error?.message.includes('reply_to_id')) {
    insertResult = await supabase
      .from('messages')
      .insert({ member_id: viewer.memberId, content })
      .select('id, created_at')
      .single();
  }

  const { data, error } = insertResult;

  if (error || !data) {
    console.error('[postMessage]', error?.message ?? 'Message insert returned no row.');
    return fail('Could not share that post.');
  }

  const { error: readError } = await supabase
    .from('message_reads')
    .upsert(
      { member_id: viewer.memberId, last_read_at: data.created_at },
      { onConflict: 'member_id' }
    );

  if (readError) {
    console.error('[postMessage read cursor]', readError.message);
  }

  revalidatePath('/messages');
  revalidatePath('/', 'layout');
  return { ok: true, bookedAt: Date.now(), messageId: data.id as string };
};

const ownedMessage = async (
  id: string
): Promise<
  { memberId: string; supabase: NonNullable<ReturnType<typeof getSupabase>> } | ActionState
> => {
  if (!(await isUnlocked())) {
    return fail(LOCKED);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }
  if (!id) {
    return fail('That message is already gone.');
  }

  const { data: message } = await supabase
    .from('messages')
    .select('member_id, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!message?.member_id) {
    return fail('That message is already gone.');
  }
  if (await refuseUnlessOwn(message.member_id as string)) {
    return fail('You can only change your own messages.');
  }
  if (!canModifyMessage(message.created_at as string)) {
    return fail('Messages can only be changed within 15 minutes of being sent.');
  }

  return { memberId: message.member_id as string, supabase };
};

export const editMessage = async (_prev: ActionState, formData: FormData): Promise<ActionState> => {
  const id = toText(formData.get('id'));
  const content = toText(formData.get('content'));
  if (!content) {
    return fail('Write something to share.');
  }
  if (content.length > 500) {
    return fail('Keep your post under 500 characters.');
  }

  const owned = await ownedMessage(id);
  if ('ok' in owned) {
    return owned;
  }

  const { error } = await owned.supabase
    .from('messages')
    .update({ content })
    .eq('id', id)
    .eq('member_id', owned.memberId);
  if (error) {
    console.error('[editMessage]', error.message);
    return fail('Could not update that message.');
  }

  revalidatePath('/messages');
  return { ok: true, message: 'Message updated.', bookedAt: Date.now() };
};

export const deleteMessage = async (
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> => {
  const id = toText(formData.get('id'));
  const owned = await ownedMessage(id);
  if ('ok' in owned) {
    return owned;
  }

  const { error } = await owned.supabase
    .from('messages')
    .delete()
    .eq('id', id)
    .eq('member_id', owned.memberId);
  if (error) {
    console.error('[deleteMessage]', error.message);
    return fail('Could not remove that message.');
  }

  revalidatePath('/messages');
  revalidatePath('/', 'layout');
  return ok;
};

const messageReactionTypes: MessageReactionType[] = [
  'heart',
  'thumbs_up',
  'thumbs_down',
  'smile',
  'shocked',
  'angry',
];

export const reactToMessage = async (
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

  const viewer = await readViewer();
  const messageId = toText(formData.get('messageId'));
  const reaction = toText(formData.get('reaction')) as MessageReactionType;

  if (!viewer.memberId) {
    return fail('Choose who you are before reacting.');
  }
  if (!messageId || !messageReactionTypes.includes(reaction)) {
    return fail('Choose a reaction.');
  }

  const { data: existing, error: readError } = await supabase
    .from('message_reactions')
    .select('reaction')
    .eq('message_id', messageId)
    .eq('member_id', viewer.memberId)
    .maybeSingle();

  if (readError) {
    console.error('[reactToMessage:read]', readError.message);
    return fail('Could not update that reaction.');
  }

  const reactionQuery =
    existing?.reaction === reaction
      ? supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('member_id', viewer.memberId)
      : supabase.from('message_reactions').upsert(
          {
            message_id: messageId,
            member_id: viewer.memberId,
            reaction,
          },
          { onConflict: 'message_id,member_id' }
        );

  const { error } = await reactionQuery;
  if (error) {
    console.error('[reactToMessage]', error.message);
    return fail('Could not update that reaction.');
  }

  revalidatePath('/messages');
  return { ok: true, bookedAt: Date.now() };
};

export const markMessagesRead = async (): Promise<void> => {
  if (!(await isUnlocked())) {
    return;
  }

  const [viewer, supabase] = await Promise.all([readViewer(), Promise.resolve(getSupabase())]);
  if (!viewer.memberId || !supabase) {
    return;
  }

  const { data: latest } = await supabase
    .from('messages')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest?.created_at) {
    return;
  }

  const { error } = await supabase
    .from('message_reads')
    .upsert(
      { member_id: viewer.memberId, last_read_at: latest.created_at },
      { onConflict: 'member_id' }
    );

  if (error) {
    console.error('[markMessagesRead]', error.message);
    return;
  }

  revalidatePath('/', 'layout');
};

export const markSessionsRead = async (): Promise<void> => {
  if (!(await isUnlocked())) {
    return;
  }

  const [viewer, supabase] = await Promise.all([readViewer(), Promise.resolve(getSupabase())]);
  if (!viewer.memberId || !supabase) {
    return;
  }

  const { data: latest } = await supabase
    .from('sessions')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest?.created_at) {
    return;
  }

  const { error } = await supabase
    .from('session_reads')
    .upsert(
      { member_id: viewer.memberId, last_read_at: latest.created_at },
      { onConflict: 'member_id' }
    );
  if (error) {
    console.error('[markSessionsRead]', error.message);
  }

  revalidatePath('/', 'layout');
};
