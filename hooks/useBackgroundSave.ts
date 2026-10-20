'use client';

import { type FormEvent, useRef, useState, useTransition } from 'react';
import type { ActionState } from '@/app/actions';

export type SaveAction = (data: FormData) => Promise<ActionState>;

/** Close the editor immediately, preserving its draft if the save fails. */
export const useBackgroundSave = (save: SaveAction, onStart: () => void, onFailure: () => void) => {
  const [state, setState] = useState<ActionState>({ ok: false });
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving.current) return;
    const data = new FormData(event.currentTarget);
    saving.current = true;
    setPending(true);
    setState({ ok: false });
    onStart();
    // Start the optimistic save in the event before awaiting it in a transition.
    let operation: Promise<ActionState>;
    try {
      operation = save(data);
    } catch {
      operation = Promise.resolve({
        ok: false,
        error: 'Could not save. Check your connection and try again.',
      });
    }
    startTransition(async () => {
      let result: ActionState;
      try {
        result = await operation;
      } catch {
        result = { ok: false, error: 'Could not save. Check your connection and try again.' };
      }
      setState(result);
      setPending(false);
      saving.current = false;
      if (!result.ok) onFailure();
    });
  };

  return { state, pending, submit };
};
