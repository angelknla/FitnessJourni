import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionState } from '@/app/actions';
import { useOptimisticSave } from './useOptimisticSave';

const deferred = () => {
  let resolve!: (value: ActionState) => void;
  const promise = new Promise<ActionState>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const apply = (data: { steps: number; sleep: number }, change: Partial<typeof data>) => ({
  ...data,
  ...change,
});

describe('useOptimisticSave', () => {
  it('updates immediately, rolls back one failed save while another stays pending, and retries', async () => {
    const daily = deferred();
    const sleep = deferred();
    const saveDaily = vi
      .fn()
      .mockReturnValueOnce(daily.promise)
      .mockResolvedValueOnce({ ok: true });
    const { result, rerender } = renderHook(
      ({ base }) => useOptimisticSave(base, 'member:day', apply),
      { initialProps: { base: { steps: 100, sleep: 6 } } }
    );
    const dailyRequest = {
      key: 'daily',
      label: 'Daily',
      change: { steps: 200 },
      data: new FormData(),
      save: saveDaily,
    };
    act(() => {
      void result.current.save(dailyRequest);
      void result.current.save({
        key: 'sleep',
        label: 'Sleep',
        change: { sleep: 8 },
        data: new FormData(),
        save: () => sleep.promise,
      });
    });
    expect(result.current.data).toEqual({ steps: 200, sleep: 8 });
    await act(async () => daily.resolve({ ok: false, error: 'Failed' }));
    expect(result.current.data).toEqual({ steps: 100, sleep: 8 });
    expect(result.current.statuses.find((entry) => entry.request.key === 'daily')?.error).toBe(
      'Failed'
    );
    await act(async () => {
      rerender({ base: { steps: 100, sleep: 8 } });
      sleep.resolve({ ok: true });
    });
    expect(result.current.data).toEqual({ steps: 100, sleep: 8 });
    await act(async () => {
      void result.current.save(dailyRequest);
      rerender({ base: { steps: 200, sleep: 8 } });
    });
    expect(saveDaily).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual({ steps: 200, sleep: 8 });
    expect(result.current.statuses).toHaveLength(0);
  });

  it('guards duplicate posts and keeps patches out of another member or date', async () => {
    const request = deferred();
    const save = vi.fn(() => request.promise);
    const { result, rerender } = renderHook(
      ({ scope }) => useOptimisticSave({ steps: 100, sleep: 6 }, scope, apply),
      { initialProps: { scope: 'member:today' } }
    );
    const change = {
      key: 'daily',
      label: 'Daily',
      change: { steps: 200 },
      data: new FormData(),
      save,
    };
    act(() => {
      void result.current.save(change);
      void result.current.save(change);
    });
    expect(save).toHaveBeenCalledOnce();
    expect(result.current.data.steps).toBe(200);
    rerender({ scope: 'member:yesterday' });
    expect(result.current.data.steps).toBe(100);
    expect(result.current.statuses).toHaveLength(0);
    await act(async () => request.resolve({ ok: false, error: 'Failed' }));
    expect(result.current.data.steps).toBe(100);
  });
});
