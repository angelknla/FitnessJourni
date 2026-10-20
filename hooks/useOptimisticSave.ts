'use client';

import { useOptimistic, useRef, useState, useTransition } from 'react';
import type { ActionState } from '@/app/actions';
import type { SaveAction } from '@hooks/useBackgroundSave';

export interface SaveRequest<Change> {
  key: string;
  label: string;
  change: Change;
  data: FormData;
  save: SaveAction;
}

/** Keep independent patches over fresh server props and roll back only failed saves. */
export const useOptimisticSave = <Data, Change>(
  base: Data,
  scope: string,
  apply: (data: Data, change: Change) => Data
) => {
  const [statuses, setStatuses] = useState<
    {
      request: SaveRequest<Change>;
      scope: string;
      id: number;
      error?: string;
    }[]
  >([]);
  const sequence = useRef(0);
  const [optimistic, addOptimistic] = useOptimistic(
    {
      data: base,
      scope,
      active: new Set(statuses.filter((entry) => !entry.error).map((entry) => entry.id)),
    },
    (current, update: { change: Change; scope: string; id: number }) =>
      current.scope === update.scope && current.active.has(update.id)
        ? { ...current, data: apply(current.data, update.change) }
        : current
  );
  const inFlight = useRef(new Set<string>());
  const [, startTransition] = useTransition();

  const save = (request: SaveRequest<Change>): Promise<ActionState> => {
    const key = `${scope}:${request.key}`;
    if (inFlight.current.has(key))
      return Promise.resolve({ ok: false, error: 'This change is still saving.' });
    inFlight.current.add(key);
    const id = ++sequence.current;
    // Urgent state: the UI changes before the server request completes.
    setStatuses((current) => [
      ...current.filter((entry) => entry.scope !== scope || entry.request.key !== request.key),
      { request, scope, id },
    ]);
    return new Promise((resolve) => {
      startTransition(async () => {
        addOptimistic({ change: request.change, scope, id });
        let result: ActionState;
        try {
          result = await request.save(request.data);
        } catch {
          result = { ok: false, error: 'Check your connection and try again.' };
        }
        inFlight.current.delete(key);
        if (result.ok) {
          // Commit with the server tree, avoiding a flash of the old values.
          startTransition(() =>
            setStatuses((current) =>
              current.filter((entry) => entry.scope !== scope || entry.request.key !== request.key)
            )
          );
        } else {
          // Failure is urgent even if another save is still pending.
          setStatuses((current) =>
            current.map((entry) =>
              entry.scope === scope && entry.request.key === request.key
                ? { request, scope, id, error: result.error ?? 'Could not save this change.' }
                : entry
            )
          );
        }
        resolve(result);
      });
    });
  };

  const visible = statuses.filter((entry) => entry.scope === scope);
  return { data: optimistic.data, statuses: visible, save };
};
