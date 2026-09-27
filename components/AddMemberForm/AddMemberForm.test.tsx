import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/actions', () => ({
  linkMemberByUsername: vi.fn(async () => ({ ok: true, message: 'Angel linked.' })),
}));

import { AddMemberForm } from './AddMemberForm';

describe('AddMemberForm', () => {
  it('links an existing account by username', () => {
    render(<AddMemberForm viewerId="m1" />);

    expect(screen.getByRole('group', { name: 'Link a user' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Link user' })).toBeEnabled();
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
  });

  it('requires an authenticated member', () => {
    render(<AddMemberForm viewerId={null} />);

    expect(screen.getByRole('button', { name: 'Link user' })).toBeDisabled();
  });
});
