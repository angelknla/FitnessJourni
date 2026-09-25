/**
 * Shared-passcode gate — pure helpers, no framework imports, so this stays
 * unit-testable. Cookie reading lives in lib/session.ts.
 *
 * Uses Web Crypto rather than node:crypto so it works in any runtime.
 *
 * The cookie holds a hash of the passcode, never the passcode itself, so reading
 * the cookie does not hand someone the phrase the group shares out loud. It is a
 * bearer token, though: anyone who copies the cookie is in until it expires. That
 * is true of any session cookie, and proportionate for keeping a step-count
 * tracker off the open internet. It is not an account system.
 */
export const COOKIE_NAME = 'fj_unlock';

/** 90 days: long enough that nobody re-enters it weekly. */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

const encoder = new TextEncoder();

export const deriveToken = async (passcode: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`fitnessjourni:v1:${passcode}`)
  );

  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/** Compares without leaking the position of the first mismatch through timing. */
export const tokensMatch = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
};

/** Absent passcode means the gate is off, so a deploy without it still works. */
export const isGateEnabled = () => Boolean(process.env.APP_PASSCODE);
