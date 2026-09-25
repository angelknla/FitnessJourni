import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/auth-actions', () => ({
  unlock: vi.fn(async () => ({})),
  signInAs: vi.fn(async () => ({})),
  lock: vi.fn(async () => undefined),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import type { Member, MemberTargets } from '@/types/fitness';
import { Header } from './Header';

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
];

beforeAll(() => {
  // jsdom does not implement the modal side of <dialog>.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  }
});

describe('Header', () => {
  it('renders the brand link', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'FitnessJourni' })).toHaveAttribute('href', '/');
  });

  it('starts with the mobile menu collapsed', () => {
    render(<Header />);

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('toggles the mobile menu open and closed', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    const closeButton = screen.getByRole('button', { name: 'Close menu' });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');

    await user.click(closeButton);
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('closes the menu when a nav link is clicked', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('link', { name: 'Sessions' }));

    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('offers a way in but no navigation when locked', () => {
    render(<Header locked />);

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sessions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
  });

  it('links to the signed-in person’s profile using their initial', () => {
    render(<Header members={members} viewer={{ memberId: 'm2', chosen: true }} />);

    const profile = screen.getByRole('link', { name: 'Open Angel profile' });
    expect(profile).toHaveAttribute('href', '/profile');
    expect(profile).toHaveTextContent('A');
    expect(profile).toHaveStyle({ '--identity-accent': '#d95926' });
  });

  it('uses a visitor initial for someone looking around', () => {
    render(<Header members={members} viewer={{ memberId: null, chosen: true }} />);

    expect(screen.getByRole('link', { name: 'Open Visitor profile' })).toHaveTextContent('V');
  });

  /* The second half of logging in: the passcode says you may be here, this asks
     who you are. Picking Visitor counts as an answer, so it is not asked again. */
  it('asks who you are when nobody has chosen yet', () => {
    render(<Header members={members} viewer={{ memberId: null, chosen: false }} />);

    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('open');
  });

  it('does not ask again once someone has chosen', () => {
    render(<Header members={members} viewer={{ memberId: 'm1', chosen: true }} />);

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('offers no picker before there is anyone to be', () => {
    render(<Header members={[]} viewer={{ memberId: null, chosen: false }} />);

    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
  });

  it('keeps logout out of navigation because it lives at the bottom of Profile', () => {
    render(<Header members={members} viewer={{ memberId: 'm1', chosen: true }} />);

    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });
});
