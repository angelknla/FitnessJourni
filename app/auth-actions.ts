'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  verifyPassword,
} from '@/lib/account';
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  createViewerToken,
  deriveToken,
  tokensMatch,
  VIEWER_COOKIE,
} from '@/lib/auth';
import {
  getCredentialByLogin,
  getCredentialByMemberId,
  updateCredentials,
} from '@/lib/data/accounts';
import { getMembers } from '@/lib/data/members';
import { isUnlocked, readViewer } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import type { AccentName } from '@/types/fitness';

export interface UnlockState {
  /** Set only on a successful unlock, so the client can tell it apart from the
   *  initial state and refresh the tree. */
  ok?: boolean;
  error?: string;
  members?: { id: string; name: string; accent: AccentName }[];
}

const setAuthenticatedCookies = async (memberId: string) => {
  const store = await cookies();
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return false;

  store.set(COOKIE_NAME, await deriveToken(passcode), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  store.set(VIEWER_COOKIE, await createViewerToken(memberId, passcode), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return true;
};

const passcodeMatches = async (entered: string) => {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return false;
  if (!entered) return false;
  return tokensMatch(await deriveToken(entered), await deriveToken(passcode));
};

export const unlockEnrollment = async (
  _prev: UnlockState,
  formData: FormData
): Promise<UnlockState> => {
  if (!isSupabaseConfigured()) {
    return { error: 'Account login is unavailable until a Supabase server key is configured.' };
  }
  if (!process.env.APP_PASSCODE) {
    return { error: 'Account setup is unavailable until APP_PASSCODE is configured.' };
  }
  const entered = String(formData.get('passcode') ?? '');
  if (!(await passcodeMatches(entered))) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: 'That app passcode is not right.' };
  }

  const store = await cookies();
  const passcode = process.env.APP_PASSCODE;
  if (passcode) {
    store.set(COOKIE_NAME, await deriveToken(passcode), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
  }

  const members = await getMembers();
  return {
    ok: true,
    members: members.map(({ id, name, accent }) => ({ id, name, accent })),
  };
};

export const loginWithCredentials = async (
  _prev: IdentityState,
  formData: FormData
): Promise<IdentityState> => {
  if (!isSupabaseConfigured()) {
    return { error: 'Account login is unavailable until a Supabase server key is configured.' };
  }
  const login = String(formData.get('login') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!login || !password) return { error: 'Enter your username or email and password.' };

  const credential = await getCredentialByLogin(login);
  if (!credential || !(await verifyPassword(password, credential.password_hash))) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: 'Username/email or password is incorrect.' };
  }

  if (!(await setAuthenticatedCookies(credential.member_id))) {
    return { error: 'Login is unavailable until APP_PASSCODE is configured.' };
  }
  return { ok: true };
};

export interface IdentityState {
  /** Set only on success, so the client can tell it from the initial state. */
  ok?: boolean;
  error?: string;
  message?: string;
}

export const saveAccountSettings = async (
  _prev: IdentityState,
  formData: FormData
): Promise<IdentityState> => {
  if (!(await isUnlocked())) return { error: 'Log in again to update your account.' };
  const viewer = await readViewer();
  if (!viewer.memberId) return { error: 'Log in again to update your account.' };

  const email = normalizeEmail(String(formData.get('email') ?? ''));
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  if (!isValidEmail(email)) return { error: 'Enter a valid email address.' };
  if (newPassword && !isValidPassword(newPassword)) {
    return { error: 'Use a new password between 8 and 128 characters.' };
  }

  const credential = await getCredentialByMemberId(viewer.memberId);
  if (!credential) return { error: 'Your account login has not been set up yet.' };
  if (newPassword && !(await verifyPassword(currentPassword, credential.password_hash))) {
    return { error: 'Your current password is incorrect.' };
  }

  const error = await updateCredentials(viewer.memberId, {
    email,
    ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {}),
  });
  if (error) return { error };

  revalidatePath('/profile');
  return { ok: true, message: newPassword ? 'Email and password updated.' : 'Email updated.' };
};

/** Drops both cookies: logging out should not leave an identity behind. */
export const lock = async (): Promise<void> => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  store.delete(VIEWER_COOKIE);
};
