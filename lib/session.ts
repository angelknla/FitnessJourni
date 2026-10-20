import { cookies } from 'next/headers';
import { cache } from 'react';
import {
  COOKIE_NAME,
  deriveToken,
  readViewerToken,
  tokensMatch,
  VIEWER_COOKIE,
  VIEWER_VISITOR,
} from '@/lib/auth';

/**
 * Whether this visitor has entered the shared passcode.
 *
 * With no APP_PASSCODE configured the gate is off and everyone counts as
 * unlocked, so a deploy that has not set it still works exactly as before.
 */
export const hasAppAccess = cache(async (): Promise<boolean> => {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) {
    return true;
  }

  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) {
    return false;
  }

  return tokensMatch(cookie, await deriveToken(passcode));
});

/** Enrollment is always passcode-gated, including when the gate is misconfigured. */
export const hasEnrollmentAccess = async (): Promise<boolean> => {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return false;

  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  return Boolean(cookie && tokensMatch(cookie, await deriveToken(passcode)));
};

/** App pages require both enrollment access and a named member session. */
export const isUnlocked = cache(async (): Promise<boolean> => {
  if (!(await hasAppAccess())) return false;
  return Boolean((await readViewer()).memberId);
});

export interface Viewer {
  /** The member this browser may write to, or null for a visitor who may not. */
  memberId: string | null;
  /**
   * Whether a choice has been made at all. False only before anyone has picked,
   * which is what opens the picker — picking Visitor sets this true with a null
   * memberId, so it does not ask again on every load.
   */
  chosen: boolean;
}

/**
 * Who this browser is acting as. Read on the server and handed to client
 * components as a prop, the same way the gate's `locked` is, so the cookie can
 * stay httpOnly and out of reach of client script.
 *
 * The id is not checked against the members table here: this runs on every
 * render, and an id that no longer exists already falls back safely — the tabs
 * resolve an unknown id to the first member, and a write is refused because it
 * cannot match the row it claims.
 */
export const readViewer = cache(async (): Promise<Viewer> => {
  const value = (await cookies()).get(VIEWER_COOKIE)?.value;
  const secret = process.env.APP_PASSCODE;

  if (!value || !secret || value === VIEWER_VISITOR) {
    return { memberId: null, chosen: false };
  }

  const memberId = await readViewerToken(value, secret);
  return memberId ? { memberId, chosen: true } : { memberId: null, chosen: false };
});
