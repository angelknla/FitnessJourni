import { cookies } from 'next/headers';
import { COOKIE_NAME, deriveToken, tokensMatch, VIEWER_COOKIE, VIEWER_VISITOR } from '@/lib/auth';

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

const VISITOR: Viewer = { memberId: null, chosen: true };

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
export const readViewer = async (): Promise<Viewer> => {
  const value = (await cookies()).get(VIEWER_COOKIE)?.value;

  if (!value) {
    return { memberId: null, chosen: false };
  }

  return value === VIEWER_VISITOR ? VISITOR : { memberId: value, chosen: true };
};
