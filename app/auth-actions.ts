'use server';

import { cookies } from 'next/headers';
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  deriveToken,
  tokensMatch,
  VIEWER_COOKIE,
  VIEWER_VISITOR,
} from '@/lib/auth';
import { getMembers } from '@/lib/data/members';
import { isUnlocked } from '@/lib/session';

export interface UnlockState {
  /** Set only on a successful unlock, so the client can tell it apart from the
   *  initial state and refresh the tree. */
  ok?: boolean;
  error?: string;
}

export const unlock = async (_prev: UnlockState, formData: FormData): Promise<UnlockState> => {
  const passcode = process.env.APP_PASSCODE;

  // Gate is off; nothing to unlock.
  if (!passcode) {
    return {};
  }

  const entered = String(formData.get('passcode') ?? '');

  const [expected, actual] = await Promise.all([deriveToken(passcode), deriveToken(entered)]);

  if (!entered || !tokensMatch(actual, expected)) {
    // A crude brake on guessing — not rate limiting, just not instant.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { error: 'That passcode is not right.' };
  }

  const store = await cookies();
  store.set(COOKIE_NAME, expected, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return { ok: true };
};

export interface IdentityState {
  /** Set only on success, so the client can tell it from the initial state. */
  ok?: boolean;
  error?: string;
}

/**
 * Records which member this browser is acting as, or Visitor for read-only.
 *
 * The id is checked against the members table rather than trusted: a junk value
 * would otherwise be stored as a chosen identity that matches nobody, which
 * looks like being signed in while every write is refused and the picker never
 * reopens to explain why.
 */
export const signInAs = async (
  _prev: IdentityState,
  formData: FormData
): Promise<IdentityState> => {
  // Only meaningful past the gate, and it should not name members before it.
  if (!(await isUnlocked())) {
    return { error: 'Locked — reload the page and log in.' };
  }

  const wanted = String(formData.get('memberId') ?? '');

  if (!wanted) {
    return { error: 'Pick who you are, or choose Visitor.' };
  }

  if (wanted !== VIEWER_VISITOR) {
    const members = await getMembers();

    if (!members.some((member) => member.id === wanted)) {
      return { error: 'That person is no longer here — pick again.' };
    }
  }

  const store = await cookies();
  store.set(VIEWER_COOKIE, wanted, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  return { ok: true };
};

/** Drops both cookies: logging out should not leave an identity behind. */
export const lock = async (): Promise<void> => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
  store.delete(VIEWER_COOKIE);
};
