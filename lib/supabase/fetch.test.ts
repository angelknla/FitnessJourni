import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFetch } from './fetch';

const fetchMock = vi.fn<typeof fetch>(async () => new Response('[]', { status: 200 }));
const url = 'https://example.supabase.co';

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Supabase caching transport', () => {
  it('preserves Supabase filters and credentials while caching display queries', async () => {
    const client = createClient(url, 'test-server-key', {
      auth: { persistSession: false },
      global: { fetch: createSupabaseFetch(true) },
    });
    await client.from('daily_logs').select('*').eq('member_id', 'm1').eq('log_date', '2026-10-20');
    await client.from('daily_logs').select('*').eq('member_id', 'm2').eq('log_date', '2026-10-19');

    const [firstUrl, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [secondUrl] = fetchMock.mock.calls[1];
    expect(firstUrl).toContain('member_id=eq.m1');
    expect(firstUrl).toContain('log_date=eq.2026-10-20');
    expect(secondUrl).not.toBe(firstUrl);
    expect(new Headers(options.headers).get('apikey')).toBe('test-server-key');
    expect(options).toMatchObject({
      cache: 'force-cache',
      next: { revalidate: 60, tags: ['fitnessjourni:logs'] },
    });
  });

  it.each([
    'members',
    'weight_measurements',
    'workouts',
    'runs',
    'messages',
    'message_reactions',
    'message_reads',
    'sessions',
    'session_reads',
  ])('caches %s reads with a bounded lifetime', async (table) => {
    await createSupabaseFetch(true)(`${url}/rest/v1/${table}?select=*`);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        cache: 'force-cache',
        next: expect.objectContaining({
          revalidate: expect.any(Number),
          tags: [expect.any(String)],
        }),
      })
    );
  });

  it.each([
    'member_credentials',
    'group_members',
    'member_active_groups',
    'group_invitations',
    'group_join_requests',
    'rpc/create_group',
  ])('keeps %s fresh even on the display client', async (table) => {
    await createSupabaseFetch(true)(`${url}/rest/v1/${table}`);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: 'no-store', next: { revalidate: 0 } })
    );
  });

  it.each([
    'POST',
    'PATCH',
    'DELETE',
    'PUT',
    'HEAD',
  ])('never caches %s requests', async (method) => {
    await createSupabaseFetch(true)(`${url}/rest/v1/members`, { method });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method, cache: 'no-store', next: { revalidate: 0 } })
    );
  });

  it('keeps all mutation-client reads fresh', async () => {
    await createSupabaseFetch(false)(`${url}/rest/v1/members`);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('reads the method from a Request and leaves storage uncached', async () => {
    await createSupabaseFetch(true)(new Request(`${url}/rest/v1/members`, { method: 'DELETE' }));
    await createSupabaseFetch(true)(`${url}/storage/v1/object/public/profile-avatars/m1.png`);
    for (const [, options] of fetchMock.mock.calls)
      expect(options).toMatchObject({ cache: 'no-store' });
  });
});
