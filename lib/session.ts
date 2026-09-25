import { cookies } from 'next/headers';
import { COOKIE_NAME, deriveToken, tokensMatch } from '@/lib/auth';

/**
 * Whether this visitor has entered the shared passcode.
 *
 * With no APP_PASSCODE configured the gate is off and everyone counts as
 * unlocked, so a deploy that has not set it still works exactly as before.
 */
export const isUnlocked = async (): Promise<boolean> => {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) {
    return true;
  }

  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) {
    return false;
  }

  return tokensMatch(cookie, await deriveToken(passcode));
};
