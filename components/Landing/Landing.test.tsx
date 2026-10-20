import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/auth-actions', () => ({
  loginWithCredentials: vi.fn(async () => ({})),
  unlockEnrollment: vi.fn(async () => ({})),
}));
vi.mock('@/app/actions', () => ({ addMember: vi.fn(async () => ({ ok: false })) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { Landing } from './Landing';

describe('Landing', () => {
  it('leads with the product, not a bare password box', () => {
    render(<Landing />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Stronger days\.\s*Together\./);
    expect(screen.getByText(/shared with the people who keep you going/)).toBeInTheDocument();
  });

  it('explains what it does in three points', () => {
    render(<Landing />);

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });

  it('offers a way in', () => {
    render(<Landing />);

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('does not hard-code who the group is, so new people can join', () => {
    const { container } = render(<Landing />);

    for (const name of ['Dillon', 'Angel', 'Bradley']) {
      expect(container.textContent).not.toContain(name);
    }
  });

  it('leaks no logged values to someone who has not signed in', () => {
    // The copy mentions steps and calories as concepts; what must never appear
    // before unlocking is an actual figure.
    const { container } = render(<Landing />);

    expect(container.textContent).not.toMatch(/\d/);
  });
});
