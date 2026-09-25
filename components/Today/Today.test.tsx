import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DailyLog, Member, MemberTargets } from '@/types/fitness';

// Mocked so the real modules (and next/cache with them) stay out of jsdom.
vi.mock('@/app/actions', () => ({
  saveDailyLog: vi.fn(async () => ({ ok: true })),
  updateTargets: vi.fn(async () => ({ ok: false })),
  logWorkout: vi.fn(async () => ({ ok: false })),
  deleteWorkout: vi.fn(async () => ({ ok: false })),
  addMember: vi.fn(async () => ({ ok: false })),
  removeMember: vi.fn(async () => ({ ok: false })),
}));
vi.mock('@/app/auth-actions', () => ({
  unlock: vi.fn(async () => ({})),
  signInAs: vi.fn(async () => ({})),
  lock: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { Today } from './Today';

const targets: MemberTargets = {
  calories: 2500,
  protein: 156,
  carbs: 313,
  fat: 69,
  steps: 10000,
  stepsMin: 8000,
  waterMl: 2500,
  workoutsPerWeek: 4,
};

const members: Member[] = [
  { id: 'm1', name: 'Dillon', accent: 'blue', sortOrder: 0, targets },
  { id: 'm2', name: 'Angel', accent: 'orange', sortOrder: 1, targets },
  { id: 'm3', name: 'Bradley', accent: 'aqua', sortOrder: 2, targets },
];

const date = '2026-09-25';

const log = (memberId: string): DailyLog => ({
  memberId,
  date,
  steps: 9000,
  waterMl: 2000,
  calories: 2400,
  proteinG: 150,
  carbsG: 300,
  fatG: 60,
});

const setup = (viewerId: string | null, canRemove = false) =>
  render(
    <Today
      members={members}
      logs={{ m1: log('m1'), m2: log('m2'), m3: log('m3') }}
      workouts={[]}
      tallies={{}}
      date={date}
      dateLabel="Friday, 25 September"
      viewerId={viewerId}
      canRemove={canRemove}
    />
  );

const selectedTab = () =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true');

/** Quick Entry is the tell for an editable tab; the note replaces it otherwise. */
const quickEntry = () => screen.queryByRole('group', { name: /Log .*'s day/ });

describe('Today', () => {
  it('opens on the signed-in person, not on whoever sorts first', () => {
    setup('m3');

    expect(selectedTab()).toHaveTextContent('Bradley');
  });

  it('still opens on the first person for a visitor, who has nobody to open on', () => {
    setup(null);

    expect(selectedTab()).toHaveTextContent('Dillon');
  });

  it('lets you edit your own day', () => {
    setup('m1');

    expect(quickEntry()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Edit Dillon's macro targets" })).toBeInTheDocument();
  });

  it('turns another person’s tab read-only, while still showing their numbers', async () => {
    const user = userEvent.setup();
    setup('m1');

    await user.click(screen.getByRole('tab', { name: 'Angel' }));

    expect(quickEntry()).not.toBeInTheDocument();
    expect(screen.getByText(/read-only here/)).toBeInTheDocument();
    // The point of the app is comparing, so their read-only figures must survive.
    expect(screen.getByText(/Protein: 150 of 156 grams/)).toBeInTheDocument();
  });

  it('hides the targets pencil on someone else’s tab', async () => {
    const user = userEvent.setup();
    setup('m1');

    await user.click(screen.getByRole('tab', { name: 'Angel' }));

    expect(screen.queryByRole('button', { name: /macro targets/ })).not.toBeInTheDocument();
  });

  it('gives a visitor no editing anywhere, and says how to fix that', () => {
    setup(null);

    expect(quickEntry()).not.toBeInTheDocument();
    expect(screen.getByText(/visitor/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /macro targets/ })).not.toBeInTheDocument();
  });

  it('gives the admin a bin on their own tab', () => {
    setup('m2', true);

    expect(screen.getByRole('button', { name: 'Remove a person' })).toBeInTheDocument();
  });

  /* It is a global action, but shown next to someone else's name it reads as
     being aimed at them. */
  it('hides the bin once the admin looks at someone else', async () => {
    const user = userEvent.setup();
    setup('m2', true);

    await user.click(screen.getByRole('tab', { name: 'Dillon' }));

    expect(screen.queryByRole('button', { name: 'Remove a person' })).not.toBeInTheDocument();
  });

  it('gives nobody else a bin', () => {
    setup('m1', false);

    expect(screen.queryByRole('button', { name: 'Remove a person' })).not.toBeInTheDocument();
  });
});
