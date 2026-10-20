import { READ_CACHE } from '@/lib/data/cache';

/**
 * Only display reads opt into the Next Data Cache. Auth, permissions, RPCs,
 * storage and all writes stay fresh. Next keys entries by the entire URL and
 * request headers, keeping member, group, date and project queries separate.
 */
export const createSupabaseFetch =
  (cacheReads: boolean): typeof fetch =>
  (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input));
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const table = /^\/rest\/v1\/([^/]+)$/.exec(url.pathname)?.[1];
    const policy = cacheReads && method === 'GET' && table ? READ_CACHE[table] : undefined;

    return fetch(input, {
      ...init,
      cache: policy ? 'force-cache' : 'no-store',
      next: {
        revalidate: policy?.seconds ?? 0,
        ...(policy ? { tags: [policy.tag] } : {}),
      },
    });
  };
