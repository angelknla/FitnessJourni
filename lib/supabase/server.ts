import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client.
 *
 * The env vars deliberately have no NEXT_PUBLIC_ prefix: the key stays on the
 * server and the browser never talks to Supabase directly. Every read happens in
 * a Server Component and every write in a Server Action.
 *
 * Returns null when unconfigured rather than throwing, so the app still renders
 * (with a setup notice) before the credentials exist.
 */
let cached: SupabaseClient | null | undefined;

/**
 * The placeholder that ships in .env.local counts as unconfigured. Otherwise a
 * half-filled file produces confusing empty screens instead of the setup notice.
 * Real keys are long: a legacy `eyJ...` service-role JWT or a server secret key.
 */
const isRealKey = (key: string | undefined): key is string =>
  Boolean(key) && key!.length > 20 && !key!.toLowerCase().startsWith('paste');

/** http:// is allowed so a local `supabase start` instance works too. */
const isRealUrl = (url: string | undefined): url is string =>
  Boolean(url) && (url!.startsWith('https://') || url!.startsWith('http://'));

const getServerKey = () =>
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = () =>
  isRealUrl(process.env.SUPABASE_URL) && isRealKey(getServerKey());

export const getSupabase = (): SupabaseClient | null => {
  if (cached !== undefined) {
    return cached;
  }

  const url = process.env.SUPABASE_URL;
  const key = getServerKey();

  cached =
    isRealUrl(url) && isRealKey(key)
      ? createClient(url, key, { auth: { persistSession: false } })
      : null;

  return cached;
};
