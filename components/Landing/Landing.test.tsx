import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/auth-actions', () => ({ unlock: vi.fn(async () => ({})) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { Landing } from './Landing';

describe('Landing', () => {
  it('leads with the product, not a bare password box', () => {
    render(<Landing />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Own your fitness journey');
    expect(screen.getByText(/shared log for Dillon, Angel and Bradley/)).toBeInTheDocument();
  });

  it('explains what it does in three points', () => {
    render(<Landing />);

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });

  it('offers a way in', () => {
    render(<Landing />);

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('leaks no logged values to someone who has not signed in', () => {
    // The copy mentions steps and calories as concepts; what must never appear
    // before unlocking is an actual figure.
    const { container } = render(<Landing />);

    expect(container.textContent).not.toMatch(/\d/);
  });
});
