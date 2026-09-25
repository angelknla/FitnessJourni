import { fireEvent, render, screen } from '@testing-library/react';
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

const props = (viewerId: string | null, canRemove = false) => ({
  members,
  logs: { m1: log('m1'), m2: log('m2'), m3: log('m3') },
  workouts: [],
  tallies: {},
  date,
  dateLabel: 'Friday, 25 September',
  viewerId,
  canRemove,
});

const setup = (viewerId: string | null, canRemove = false) =>
  render(<Today {...props(viewerId, canRemove)} />);

const selectedTab = () =>
  screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true');

const quickEntry = () => screen.queryByRole('button', { name: /Log .*'s day/ });

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

  it('keeps daily inputs collapsed until its title is opened', async () => {
    const user = userEvent.setup();
    setup('m1');

    const toggle = screen.getByRole('button', { name: "Log Dillon's day" });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('spinbutton', { name: 'Steps' })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('spinbutton', { name: 'Steps' })).toBeInTheDocument();
  });

  it('only enables Save while daily inputs differ from their loaded values', async () => {
    const user = userEvent.setup();
    setup('m1');
    await user.click(screen.getByRole('button', { name: "Log Dillon's day" }));

    const steps = screen.getByRole('spinbutton', { name: 'Steps' });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await user.clear(steps);
    await user.type(steps, '9500');
    expect(save).toBeEnabled();

    await user.clear(steps);
    await user.type(steps, '9000');
    expect(save).toBeDisabled();
  });

  it('turns another person’s tab read-only without showing a redundant notice', async () => {
    const user = userEvent.setup();
    setup('m1');

    await user.click(screen.getByRole('tab', { name: 'Angel' }));

    expect(quickEntry()).not.toBeInTheDocument();
    expect(screen.queryByText(/signed in as someone else/)).not.toBeInTheDocument();
    // The point of the app is comparing, so their read-only figures must survive.
    expect(screen.getByText(/Protein: 150 of 156 grams/)).toBeInTheDocument();
  });

  it('moves between member tabs when the macros section is swiped', () => {
    setup('m1');
    const macros = screen.getByRole('heading', { name: 'Macros' }).parentElement?.parentElement;

    expect(macros).not.toBeNull();
    fireEvent.touchStart(macros!, { touches: [{ clientX: 180, clientY: 100 }] });
    fireEvent.touchEnd(macros!, { changedTouches: [{ clientX: 80, clientY: 105 }] });
    expect(selectedTab()).toHaveTextContent('Angel');

    fireEvent.touchStart(macros!, { touches: [{ clientX: 80, clientY: 100 }] });
    fireEvent.touchEnd(macros!, { changedTouches: [{ clientX: 180, clientY: 105 }] });
    expect(selectedTab()).toHaveTextContent('Dillon');
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

  /* Picking an identity refreshes the server tree without remounting this, so a
     mount-time initialiser alone left a fresh login on the first person's tab. */
  it('moves to your tab when you sign in without a remount', () => {
    const { rerender } = render(<Today {...props(null)} />);
    expect(selectedTab()).toHaveTextContent('Dillon');

    rerender(<Today {...props('m3')} />);

    expect(selectedTab()).toHaveTextContent('Bradley');
  });

  it('follows a switch from one person to another', () => {
    const { rerender } = render(<Today {...props('m1')} />);

    rerender(<Today {...props('m2')} />);

    expect(selectedTab()).toHaveTextContent('Angel');
  });

  /* Every save revalidates and re-renders with the same viewer; being thrown back
     to your own tab each time would make another person's day unreadable. */
  it('leaves the chosen tab alone when a refresh changes nothing about who you are', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Today {...props('m1')} />);

    await user.click(screen.getByRole('tab', { name: 'Bradley' }));
    expect(selectedTab()).toHaveTextContent('Bradley');

    rerender(<Today {...props('m1')} />);

    expect(selectedTab()).toHaveTextContent('Bradley');
  });

  it('leaves a visitor where they are, having nobody to move to', () => {
    const { rerender } = render(<Today {...props('m2')} />);

    rerender(<Today {...props(null)} />);

    expect(selectedTab()).toHaveTextContent('Angel');
  });

  it('puts you first in the strip, with everyone else in their usual order', () => {
    setup('m3');

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Bradley',
      'Dillon',
      'Angel',
    ]);
  });

  it('leaves the usual order alone for a visitor, who is nobody to hoist', () => {
    setup(null);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Dillon',
      'Angel',
      'Bradley',
    ]);
  });

  it('puts the signed-in person first in Everyone today', () => {
    setup('m3');

    const strip = screen.getByRole('region', { name: 'Everyone today' });
    expect(strip.textContent).toMatch(/Bradley[\s\S]*Dillon[\s\S]*Angel/);
  });

  it('keeps the usual Everyone today order for a visitor', () => {
    setup(null);

    const strip = screen.getByRole('region', { name: 'Everyone today' });
    expect(strip.textContent).toMatch(/Dillon[\s\S]*Angel[\s\S]*Bradley/);
  });

  it('reorders as soon as the identity changes, without a remount', () => {
    const { rerender } = render(<Today {...props('m1')} />);

    rerender(<Today {...props('m2')} />);

    expect(screen.getAllByRole('tab')[0]).toHaveTextContent('Angel');
  });
});
