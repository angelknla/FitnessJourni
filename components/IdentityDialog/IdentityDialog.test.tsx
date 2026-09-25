import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/auth-actions', () => ({
  unlock: vi.fn(async () => ({})),
  signInAs: vi.fn(async () => ({})),
  lock: vi.fn(async () => undefined),
}));
vi.mock('@/app/actions', () => ({
  addMember: vi.fn(async (_state, formData: FormData) => ({
    ok: true,
    newMemberId: 'm4',
    newMemberName: String(formData.get('name')),
    newMemberAccent: String(formData.get('accent')),
  })),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { IdentityDialog, type IdentityOption } from './IdentityDialog';

const members: IdentityOption[] = [
  { id: 'm1', name: 'Dillon', accent: 'blue' },
  { id: 'm2', name: 'Angel', accent: 'orange' },
  { id: 'm3', name: 'Bradley', accent: 'aqua' },
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

const setup = (props: Partial<Parameters<typeof IdentityDialog>[0]> = {}) =>
  render(<IdentityDialog members={members} viewerId={null} open onClose={vi.fn()} {...props} />);

const radio = (name: string) => screen.getByRole('radio', { name: new RegExp(name) });

describe('IdentityDialog', () => {
  it('offers everyone plus a visitor option', () => {
    setup();

    for (const name of ['Dillon', 'Angel', 'Bradley', 'Visitor']) {
      expect(radio(name)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /New user/ })).toBeInTheDocument();
  });

  it('creates a new user in the modal and offers to sign in as them', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: /New user/ }));
    await user.type(screen.getByLabelText('Name'), 'Casey');
    await user.click(screen.getByRole('button', { name: 'Add person' }));

    expect(await screen.findByRole('heading', { name: 'Casey is in' })).toBeInTheDocument();
    expect(radio('Casey')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Log in as Casey' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stay visitor' })).toBeInTheDocument();
  });

  it('stays shut until told to open', () => {
    setup({ open: false });

    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  /* Nobody picked yet, so the safe default is the option that writes nothing
     rather than whoever happens to be first in the list. */
  it('preselects visitor when nobody is signed in', () => {
    setup();

    expect(radio('Visitor')).toBeChecked();
    expect(radio('Dillon')).not.toBeChecked();
  });

  it('preselects the current person and marks them as signed in', () => {
    setup({ viewerId: 'm2' });

    expect(radio('Angel')).toBeChecked();
    expect(screen.getByText('signed in')).toBeInTheDocument();
  });

  it('preselects a preset over the current person, for someone just added', () => {
    setup({ viewerId: 'm1', presetId: 'm3' });

    expect(radio('Bradley')).toBeChecked();
    expect(radio('Dillon')).not.toBeChecked();
  });

  it('submits the chosen id', async () => {
    const user = userEvent.setup();
    const { container } = setup();

    await user.click(radio('Angel'));

    // What the form would actually post, rather than which radio looks checked.
    expect(container.querySelector('form')).toHaveFormValues({ memberId: 'm2' });
  });

  it('dismisses without choosing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    setup({ onClose, dismissLabel: 'Stay as I am' });

    await user.click(screen.getByRole('button', { name: 'Stay as I am' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('takes the labels the add-person prompt needs', () => {
    setup({ title: 'Bradley is in', submitLabel: 'Log in as Bradley' });

    expect(screen.getByRole('heading', { name: 'Bradley is in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in as Bradley' })).toBeInTheDocument();
  });
});
