import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/auth-actions', () => ({
  loginWithCredentials: vi.fn(async () => ({})),
  unlockEnrollment: vi.fn(async () => ({})),
  claimLegacyAccount: vi.fn(async () => ({})),
  lock: vi.fn(async () => undefined),
}));
vi.mock('@/app/actions', () => ({ addMember: vi.fn(async () => ({ ok: false })) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/workouts',
}));

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

  it('renders every primary route without a burger control', () => {
    render(<Header />);

    for (const route of ['Home', 'Workouts', 'Running', 'Logs', 'Sessions', 'Chat']) {
      expect(screen.getByRole('link', { name: route })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
  });

  it('shows a subtle marker when messages are unread', () => {
    const { container, rerender } = render(<Header hasUnreadMessages />);

    expect(container.querySelector('[class*="unreadDot"]')).toBeInTheDocument();

    rerender(<Header hasUnreadMessages={false} />);
    expect(container.querySelector('[class*="unreadDot"]')).not.toBeInTheDocument();
  });

  it('shows a subtle marker when sessions are unread', () => {
    const { container } = render(<Header hasUnreadSessions />);

    expect(container.querySelector('[class*="unreadDot"]')).toBeInTheDocument();
  });

  it('marks the current route', () => {
    render(<Header />);

    expect(screen.getByRole('link', { name: 'Workouts' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('offers a way in but no navigation when locked', () => {
    render(<Header locked />);

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sessions' })).not.toBeInTheDocument();
  });

  it('links to the signed-in person’s profile using their initial', () => {
    render(<Header members={members} viewer={{ memberId: 'm2', chosen: true }} />);

    const profile = screen.getByRole('link', { name: 'Open Angel profile' });
    expect(profile).toHaveAttribute('href', '/profile');
    expect(profile).toHaveTextContent('A');
    expect(profile).toHaveStyle({ '--identity-accent': '#d95926' });
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  });

  it('starts the reload animation immediately after clicking resync', async () => {
    const user = userEvent.setup();
    render(<Header members={members} viewer={{ memberId: 'm2', chosen: true }} />);

    const resync = screen.getByRole('button', { name: 'Reload page' });
    await user.click(resync);

    expect(resync).toHaveAttribute('aria-busy', 'true');
    expect(resync).toBeDisabled();
  });

  it('shows the selected avatar instead of the initial', () => {
    const withAvatar = [{ ...members[1], avatarPath: '/avatars/tempo.svg' }];
    render(<Header members={withAvatar} viewer={{ memberId: 'm2', chosen: true }} />);

    const profile = screen.getByRole('link', { name: 'Open Angel profile' });
    expect(profile.querySelector('img')).toHaveAttribute('src', '/avatars/tempo.svg');
    expect(profile).not.toHaveTextContent('A');
  });

  it('uses a neutral profile fallback when account data is unavailable', () => {
    render(<Header members={members} viewer={{ memberId: null, chosen: true }} />);

    expect(screen.getByRole('link', { name: 'Open Profile profile' })).toHaveTextContent('?');
  });

  it('does not offer identity switching', () => {
    render(<Header members={members} viewer={{ memberId: null, chosen: false }} />);

    expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Visitor')).not.toBeInTheDocument();
  });

  it('keeps logout out of navigation because it lives at the bottom of Profile', () => {
    render(<Header members={members} viewer={{ memberId: 'm1', chosen: true }} />);

    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });
});
