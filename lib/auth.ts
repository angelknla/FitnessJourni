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

/** The signed member session created after credential authentication. */
export const VIEWER_COOKIE = 'fj_who';

/**
 * Stored when someone picks Visitor. A sentinel rather than an absent cookie,
 * because "has not chosen yet" opens the picker and "chose to just look" must
 * not — an empty value cannot tell those apart. Member ids are uuids, so the
 * word can never collide with one.
 */
export const VIEWER_VISITOR = 'visitor';

const encoder = new TextEncoder();

const encodeBytes = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const deriveToken = async (passcode: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(`fitnessjourni:v1:${passcode}`)
  );

  return encodeBytes(new Uint8Array(digest));
};

const sessionSignature = async (memberId: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`fitnessjourni:member:v1:${memberId}`)
  );
  return encodeBytes(new Uint8Array(signature));
};

export const createViewerToken = async (memberId: string, secret: string): Promise<string> =>
  `${memberId}.${await sessionSignature(memberId, secret)}`;

export const readViewerToken = async (
  token: string,
  secret: string
): Promise<string | null> => {
  const separator = token.lastIndexOf('.');
  if (separator < 1) return null;

  const memberId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = await sessionSignature(memberId, secret);
  return tokensMatch(signature, expected) ? memberId : null;
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
