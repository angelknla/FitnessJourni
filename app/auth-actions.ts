'use server';

import { cookies } from 'next/headers';
import { COOKIE_MAX_AGE, COOKIE_NAME, deriveToken, tokensMatch } from '@/lib/auth';

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

export const lock = async (): Promise<void> => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
};
