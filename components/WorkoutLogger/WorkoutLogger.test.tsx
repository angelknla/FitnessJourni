import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Member, Workout } from '@/types/fitness';

vi.mock('@/app/actions', () => ({
  logWorkout: vi.fn(async () => ({ ok: true, bookedAt: Date.now() })),
  deleteWorkout: vi.fn(async () => ({ ok: false })),
}));

import { WorkoutLogger } from './WorkoutLogger';

const member: Member = {
  id: 'm1',
  name: 'Dillon',
  accent: 'blue',
  sortOrder: 0,
  targets: {
    calories: 2500,
    protein: 156,
    carbs: 313,
    fat: 69,
    steps: 10000,
    stepsMin: 8000,
    waterMl: 2500,
    workoutsPerWeek: 4,
  },
};

const workout = (id: string, focuses: Workout['focuses'], note: string | null = null): Workout => ({
  id,
  memberId: 'm1',
  date: '2026-09-25',
  focuses,
  note,
});

const setup = (logged: Workout[] = [], weekCount = 0, canEdit = true) =>
  render(
    <WorkoutLogger
      member={member}
      date="2026-09-25"
      logged={logged}
      weekCount={weekCount}
      canEdit={canEdit}
    />
  );

const openForm = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(screen.getByRole('button', { name }));
};

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }) as MediaQueryList)
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('WorkoutLogger', () => {
  it.each([
    'toggle',
    'save',
  ])('centres the mobile form and restores the previous scroll after closing by %s', async (closeBy) => {
    const user = userEvent.setup();
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    vi.stubGlobal('scrollY', 360);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setup();
    const toggle = screen.getByRole('button', { name: 'What did you train?' });
    const scrollIntoView = vi.fn();
    Object.defineProperty(toggle.parentElement, 'scrollIntoView', { value: scrollIntoView });

    await user.click(toggle);
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });

    vi.stubGlobal('scrollY', 700);
    if (closeBy === 'save') {
      await user.click(screen.getByRole('checkbox', { name: 'Legs' }));
      await user.click(screen.getByRole('button', { name: 'Log workout' }));
    } else {
      await user.click(toggle);
    }

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({ top: 360, behavior: 'smooth' });
    });
  });

  it('keeps the desktop scroll position when toggling the form', async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    setup();
    const toggle = screen.getByRole('button', { name: 'What did you train?' });
    const scrollIntoView = vi.fn();
    Object.defineProperty(toggle.parentElement, 'scrollIntoView', { value: scrollIntoView });

    await user.click(toggle);
    await user.click(toggle);

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('says nothing is logged when the day is empty', () => {
    setup();

    expect(screen.getByText('Not logged today')).toBeInTheDocument();
  });

  it('confirms training once something is logged', () => {
    setup([workout('w1', ['push'])]);

    expect(screen.getByText('Trained today')).toBeInTheDocument();
  });

  it('counts toward the recommended weekly figure', () => {
    setup([], 2);

    expect(screen.getByText('2 of 4 this week')).toBeInTheDocument();
  });

  it('reframes rather than showing a nonsense "6 of 4" once past the recommendation', () => {
    setup([], 6);

    expect(screen.queryByText('6 of 4 this week')).not.toBeInTheDocument();
    expect(screen.getByText('6 this week · 4 recommended')).toBeInTheDocument();
  });

  it('treats hitting the recommendation exactly as met', () => {
    setup([], 4);

    expect(screen.getByText('4 this week · 4 recommended')).toBeInTheDocument();
  });

  it('lets several areas be picked for one session', async () => {
    const user = userEvent.setup();
    setup();
    await openForm(user, /What did you train/);

    await user.click(screen.getByRole('checkbox', { name: 'Push' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cardio' }));

    expect(screen.getByRole('checkbox', { name: 'Push' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cardio' })).toBeChecked();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('cannot submit until something is picked', async () => {
    const user = userEvent.setup();
    setup();
    await openForm(user, /What did you train/);

    const submit = screen.getByRole('button', { name: 'Log workout' });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'Legs' }));
    expect(submit).toBeEnabled();
  });

  it('closes the form after a workout is saved', async () => {
    const user = userEvent.setup();
    setup();
    await openForm(user, /What did you train/);

    await user.click(screen.getByRole('checkbox', { name: 'Legs' }));
    await user.click(screen.getByRole('button', { name: 'Log workout' }));

    expect(await screen.findByRole('button', { name: 'What did you train?' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('checkbox', { name: 'Legs' })).not.toBeInTheDocument();
  });

  it('shows a multi-focus session as one entry', () => {
    setup([workout('w1', ['push', 'cardio'])]);

    expect(screen.getByText('Push + Cardio')).toBeInTheDocument();
  });

  it('lists two sessions on the same day separately', () => {
    setup([workout('w1', ['push']), workout('w2', ['cardio'])], 2);

    expect(screen.getByRole('button', { name: 'Remove Push workout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Cardio workout' })).toBeInTheDocument();
  });

  it('invites another session once one is logged', () => {
    setup([workout('w1', ['push'])]);

    expect(screen.getByRole('button', { name: 'Log another session' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('checkbox', { name: 'Push' })).not.toBeInTheDocument();
  });
});
