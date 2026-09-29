import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  GroupInvitation,
  GroupJoinRequest,
  GroupMemberRole,
  GroupMembership,
  GroupRole,
  Member,
} from '@/types/fitness';

vi.mock('@/app/group-actions', () => ({
  createGroup: vi.fn(async () => ({ ok: true })),
  switchActiveGroup: vi.fn(async () => ({ ok: true })),
  updateGroupDetails: vi.fn(async () => ({ ok: true })),
  inviteMemberByUsername: vi.fn(async () => ({ ok: true })),
  respondToInvitation: vi.fn(async () => ({ ok: true })),
  requestGroupAccess: vi.fn(async () => ({ ok: true })),
  reviewJoinRequest: vi.fn(async () => ({ ok: true })),
  changeGroupMemberRole: vi.fn(async () => ({ ok: true })),
  transferGroupOwnership: vi.fn(async () => ({ ok: true })),
  removeGroupMember: vi.fn(async () => ({ ok: true })),
  leaveGroup: vi.fn(async () => ({ ok: true })),
  regenerateGroupCode: vi.fn(async () => ({ ok: true })),
  saveGroupImage: vi.fn(async () => ({ ok: true })),
  deleteGroup: vi.fn(async () => ({ ok: true })),
}));

import { GroupsPanel } from './GroupsPanel';

const targets = {
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
  { id: 'angel', name: 'Angel', accent: 'orange', sortOrder: 0, targets },
  { id: 'dillon', name: 'Dillon', accent: 'blue', sortOrder: 1, targets },
  { id: 'pani', name: 'Pani', accent: 'aqua', sortOrder: 2, targets },
];

const group = {
  id: 'g1',
  name: 'Nine Elms',
  description: 'The originals',
  joinCode: 'N7K4-P2Q9',
  imagePath: null,
  memberCount: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const membership = (role: GroupRole): GroupMembership => ({
  group,
  role,
  joinedAt: '2026-01-01T00:00:00.000Z',
});

const groupMembers: GroupMemberRole[] = [
  { memberId: 'angel', role: 'owner', joinedAt: '2026-01-01T00:00:00.000Z' },
  { memberId: 'dillon', role: 'admin', joinedAt: '2026-01-02T00:00:00.000Z' },
  { memberId: 'pani', role: 'member', joinedAt: '2026-01-03T00:00:00.000Z' },
];

interface Options {
  role?: GroupRole;
  viewerId?: string;
  memberships?: GroupMembership[];
  activeGroupId?: string | null;
  invitations?: GroupInvitation[];
  requests?: GroupJoinRequest[];
  pendingRequests?: GroupJoinRequest[];
}

const renderPanel = ({
  role = 'owner',
  viewerId = 'angel',
  memberships,
  activeGroupId = 'g1',
  invitations = [],
  requests = [],
  pendingRequests = [],
}: Options = {}) => {
  const list = memberships ?? [membership(role)];

  return render(
    <GroupsPanel
      groups={list.map((item) => ({
        membership: item,
        members: item.group.id === 'g1' ? groupMembers : [],
        pendingRequests: pendingRequests.filter((request) => request.groupId === item.group.id),
      }))}
      activeGroupId={activeGroupId}
      invitations={invitations}
      requests={requests}
      members={members}
      viewerId={viewerId}
    />
  );
};

/* userEvent.setup() installs its own clipboard stub, which is what the copy
 * button writes to — so the assertion reads the value back out of it. */

describe('Personal mode', () => {
  it('explains the state instead of showing an empty group', () => {
    renderPanel({ memberships: [], activeGroupId: null });

    expect(screen.getByRole('heading', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByText(/logging privately/i)).toBeInTheDocument();
    expect(screen.queryByText('Group code')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
  });

  it('still offers the two ways into a group', () => {
    renderPanel({ memberships: [], activeGroupId: null });

    expect(screen.getByRole('button', { name: 'Create a group' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join a group' })).toBeInTheDocument();
  });
});

/** The disclosure button for one group, found by the name inside it. */
const groupToggle = (name: string) =>
  screen
    .getAllByRole('button', { expanded: undefined })
    .find(
      (button) =>
        button.getAttribute('aria-expanded') !== null && button.textContent?.includes(name)
    ) as HTMLElement;

describe('the current group', () => {
  it('names it with the member count, and nothing that would wrap on a phone', () => {
    renderPanel({ role: 'admin' });

    const toggle = groupToggle('Nine Elms');
    expect(toggle).toHaveTextContent('Nine Elms');
    expect(toggle).toHaveTextContent('3 members');
    // The viewer's own role is shown against their name inside, not repeated here.
    expect(toggle).not.toHaveTextContent('Admin');
    expect(screen.getByText('The originals')).toBeInTheDocument();
  });

  it('is expanded to begin with, and can be collapsed', async () => {
    const user = userEvent.setup();
    renderPanel();

    const toggle = groupToggle('Nine Elms');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Members' })).toBeVisible();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Collapsed with `hidden`, so it leaves the accessibility tree rather than
    // merely going invisible — a screen reader should not read a closed group.
    expect(screen.queryByRole('heading', { name: 'Members' })).not.toBeInTheDocument();
  });

  it('marks it as current', () => {
    renderPanel();

    expect(within(groupToggle('Nine Elms')).getByText('Current')).toBeInTheDocument();
  });

  it('shows the join code and copies it', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByText('N7K4-P2Q9')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await expect(navigator.clipboard.readText()).resolves.toBe('N7K4-P2Q9');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});

describe('the other groups', () => {
  const other: GroupMembership = {
    group: { ...group, id: 'g2', name: 'Battersea', memberCount: 2, description: null },
    role: 'member',
    joinedAt: '2026-02-01T00:00:00.000Z',
  };

  it('start collapsed, so only the current one is open', () => {
    renderPanel({ memberships: [membership('owner'), other] });

    expect(groupToggle('Nine Elms')).toHaveAttribute('aria-expanded', 'true');
    expect(groupToggle('Battersea')).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers a switch once opened, naming the group it switches to', async () => {
    const user = userEvent.setup();
    renderPanel({ memberships: [membership('owner'), other] });

    await user.click(groupToggle('Battersea'));

    expect(screen.getByRole('button', { name: 'Switch to Battersea' })).toBeInTheDocument();
    // The current group has no switch — it is already current.
    expect(screen.queryByRole('button', { name: 'Switch to Nine Elms' })).not.toBeInTheDocument();
  });

  it('shows its own member count on the header', () => {
    renderPanel({ memberships: [membership('owner'), other] });

    const toggle = groupToggle('Battersea');
    expect(toggle).toHaveTextContent('2 members');
    expect(within(toggle).queryByText('Current')).not.toBeInTheDocument();
  });
});

describe('invitations addressed to the viewer', () => {
  const invitation: GroupInvitation = {
    id: 'i1',
    groupId: 'g2',
    groupName: 'Battersea',
    memberId: 'angel',
    invitedBy: 'dillon',
    status: 'pending',
    createdAt: '2026-03-01T00:00:00.000Z',
  };

  it('offers accept and decline, naming who invited them', () => {
    renderPanel({ invitations: [invitation] });

    const row = screen
      .getAllByRole('listitem')
      .find((item) => item.textContent?.includes('Invited by Dillon')) as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });
});

describe('the viewer’s own requests', () => {
  it('reports where each one got to', () => {
    renderPanel({
      requests: [
        {
          id: 'r1',
          groupId: 'g3',
          groupName: 'Vauxhall',
          memberId: 'angel',
          status: 'pending',
          createdAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'r2',
          groupId: 'g4',
          groupName: 'Oval',
          memberId: 'angel',
          status: 'rejected',
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    });

    expect(screen.getByText('Waiting for approval')).toBeInTheDocument();
    expect(screen.getByText('Not approved')).toBeInTheDocument();
  });
});

describe('reviewing requests to join', () => {
  const request: GroupJoinRequest = {
    id: 'r1',
    groupId: 'g1',
    groupName: 'Nine Elms',
    memberId: 'pani',
    status: 'pending',
    createdAt: '2026-03-01T00:00:00.000Z',
  };

  it('is offered to an owner', () => {
    renderPanel({ role: 'owner', pendingRequests: [request] });

    expect(screen.getByRole('heading', { name: 'Requests to join' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('is offered to an admin', () => {
    renderPanel({ role: 'admin', pendingRequests: [request] });

    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('is hidden from a plain member', () => {
    renderPanel({ role: 'member', pendingRequests: [request] });

    expect(screen.queryByRole('heading', { name: 'Requests to join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });
});

describe('members and roles', () => {
  it('lists everyone with their role, owner first, and marks the viewer', () => {
    renderPanel({ role: 'owner', viewerId: 'angel' });

    const list = screen.getByRole('heading', { name: 'Members' }).nextElementSibling as HTMLElement;
    const rows = within(list).getAllByRole('listitem');

    // Owner first, then admins, then members.
    expect(rows.map((row) => within(row).getByRole('strong').textContent)).toEqual([
      'Angelyou',
      'Dillon',
      'Pani',
    ]);
    expect(rows.map((row) => row.querySelector('small')?.textContent)).toEqual([
      'Owner',
      'Admin',
      'Member',
    ]);
    // The viewer is marked as themselves, and only they are.
    expect(within(rows[0]).getByText('you')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('you')).not.toBeInTheDocument();
  });
});

describe('what an owner may do', () => {
  it('can promote a member, demote an admin, and hand the group over', () => {
    renderPanel({ role: 'owner', viewerId: 'angel' });

    expect(screen.getByRole('button', { name: 'Make admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove admin' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Make owner' })).toHaveLength(2);
    // The bin is labelled per person rather than a bare "Remove".
    expect(screen.getAllByRole('button', { name: /^Remove (Dillon|Pani)$/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'New code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Group settings' })).toBeInTheDocument();
  });

  it('cannot leave, and is told why', () => {
    renderPanel({ role: 'owner' });

    expect(screen.queryByRole('button', { name: /^Leave/ })).not.toBeInTheDocument();
    expect(screen.getByText(/owner you cannot leave/i)).toBeInTheDocument();
  });

  it('keeps delete disabled until the group name is typed exactly', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'owner' });

    const remove = screen.getByRole('button', { name: 'Delete group' });
    expect(remove).toBeDisabled();

    const confirm = screen.getByLabelText(/type .Nine Elms. to confirm/i);
    await user.type(confirm, 'Nine Elm');
    expect(remove).toBeDisabled();

    await user.type(confirm, 's');
    expect(remove).toBeEnabled();
  });

  it('asks again before replacing the join code', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'owner' });

    await user.click(screen.getByRole('button', { name: 'New code' }));

    expect(screen.getByRole('button', { name: 'Confirm new code' })).toBeInTheDocument();
  });
});

describe('what an admin may do', () => {
  it('can edit details and invite, but not change roles or delete', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'admin', viewerId: 'dillon' });

    await user.click(screen.getByRole('button', { name: 'Group settings' }));
    expect(screen.getByLabelText('Group name')).toBeInTheDocument();

    // Inviting is its own control beside settings, not buried inside it.
    await user.click(screen.getByRole('button', { name: 'Invite a user' }));
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    // Opening it closed the settings panel — one at a time.
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Make admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make owner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete group' })).not.toBeInTheDocument();
  });

  it('can remove a plain member but not the owner or another admin', () => {
    renderPanel({ role: 'admin', viewerId: 'dillon' });

    // Pani is the only removable person: not the owner, and not Dillon himself.
    const removes = screen.getAllByRole('button', { name: /^Remove (Angel|Dillon|Pani)$/ });
    expect(removes).toHaveLength(1);
    expect(removes[0]).toHaveAccessibleName('Remove Pani');
  });

  it('can leave', () => {
    renderPanel({ role: 'admin', viewerId: 'dillon' });

    expect(screen.getByRole('button', { name: 'Leave Nine Elms' })).toBeInTheDocument();
  });
});

describe('what a plain member may do', () => {
  it('sees the group and may leave, and nothing else', () => {
    renderPanel({ role: 'member', viewerId: 'pani' });

    expect(screen.getByRole('button', { name: 'Leave Nine Elms' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Group settings' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Remove (Angel|Dillon|Pani)$/ })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Make admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete group' })).not.toBeInTheDocument();
  });
});

describe('destructive actions', () => {
  it('confirm before removing someone', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'owner', viewerId: 'angel' });

    // Named after the person, so this cannot accidentally match "Remove admin".
    await user.click(screen.getByRole('button', { name: 'Remove Pani' }));

    // Named after the person, so a screen reader is not asked to confirm "Confirm".
    expect(screen.getByRole('button', { name: /^Confirm removing / })).toBeInTheDocument();
  });

  it('confirm before leaving', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'member', viewerId: 'pani' });

    await user.click(screen.getByRole('button', { name: 'Leave Nine Elms' }));

    expect(screen.getByRole('button', { name: 'Confirm leave Nine Elms' })).toBeInTheDocument();
  });

  it('confirm before handing over ownership', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'owner', viewerId: 'angel' });

    await user.click(screen.getAllByRole('button', { name: 'Make owner' })[0]);

    expect(screen.getByRole('button', { name: 'Confirm handover' })).toBeInTheDocument();
  });
});

describe('joining another group', () => {
  it('offers creating and joining below every group, not inside one', () => {
    renderPanel();

    const another = screen.getByRole('heading', { name: 'Another group' });
    const block = another.parentElement as HTMLElement;
    expect(within(block).getByRole('button', { name: 'Create a group' })).toBeInTheDocument();
    expect(within(block).getByRole('button', { name: 'Join a group' })).toBeInTheDocument();
    // Not nested inside a group's own section.
    expect(another.closest('li')).toBeNull();
  });

  it('asks for a code and says approval is needed', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Join a group' }));

    expect(screen.getByLabelText('Group code')).toHaveAttribute('placeholder', 'N7K4-P2Q9');
    expect(screen.getByText(/never joins you outright/i)).toBeInTheDocument();
  });
});

describe('managing a group', () => {
  it('offers settings and invite as two equal controls', () => {
    renderPanel({ role: 'owner' });

    const settings = screen.getByRole('button', { name: 'Group settings' });
    const invite = screen.getByRole('button', { name: 'Invite a user' });
    expect(settings).toHaveAttribute('aria-expanded', 'false');
    expect(invite).toHaveAttribute('aria-expanded', 'false');
    // Siblings in the same row, so neither is nested in the other's panel.
    expect(settings.parentElement).toBe(invite.parentElement);
  });

  it('hides both from a plain member', () => {
    renderPanel({ role: 'member', viewerId: 'pani' });

    expect(screen.queryByRole('button', { name: 'Group settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite a user' })).not.toBeInTheDocument();
  });

  it('lets each panel close itself', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'owner' });

    await user.click(screen.getByRole('button', { name: 'Invite a user' }));
    await user.click(screen.getByRole('button', { name: 'Close invite a user' }));
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Group settings' }));
    await user.click(screen.getByRole('button', { name: 'Close group settings' }));
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument();
  });
});

describe('the group picture', () => {
  it('falls back to the two-figure icon when there is none', () => {
    const { container } = renderPanel({ role: 'owner' });

    expect(container.querySelector('[class*="infoImage"] svg')).toBeInTheDocument();
    expect(container.querySelector('[class*="infoImage"] img')).not.toBeInTheDocument();
  });

  it('shows the picture beside the description once there is one', () => {
    const withPicture: GroupMembership = {
      ...membership('owner'),
      group: { ...group, imagePath: 'https://example.test/cover.png?v=1' },
    };
    const { container } = renderPanel({ memberships: [withPicture] });

    const image = container.querySelector('[class*="infoImage"] img');
    expect(image).toHaveAttribute('alt', 'Nine Elms group picture');
    expect(container.querySelector('[class*="infoImage"] svg')).not.toBeInTheDocument();
  });

  it('says so plainly when a group has no description', () => {
    const withoutDescription: GroupMembership = {
      ...membership('owner'),
      group: { ...group, description: null },
    };
    renderPanel({ memberships: [withoutDescription] });

    expect(screen.getByText('No description yet.')).toBeInTheDocument();
  });

  it('is choosable from group settings by an owner', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'owner' });

    await user.click(screen.getByRole('button', { name: 'Group settings' }));

    const field = screen.getByLabelText('Choose an image');
    expect(field).toHaveAttribute('type', 'file');
    expect(field).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(screen.getByRole('button', { name: 'Save picture' })).toBeInTheDocument();
  });

  it('is choosable by an admin too', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'admin', viewerId: 'dillon' });

    await user.click(screen.getByRole('button', { name: 'Group settings' }));

    expect(screen.getByLabelText('Choose an image')).toBeInTheDocument();
  });

  it('is not offered to a plain member at all', () => {
    renderPanel({ role: 'member', viewerId: 'pani' });

    expect(screen.queryByRole('button', { name: 'Group settings' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Choose an image')).not.toBeInTheDocument();
  });

  it('offers removal only when there is a picture to remove', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'owner' });
    await user.click(screen.getByRole('button', { name: 'Group settings' }));
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();

    const withPicture: GroupMembership = {
      ...membership('owner'),
      group: { ...group, imagePath: 'https://example.test/cover.png?v=1' },
    };
    renderPanel({ memberships: [withPicture] });
    await user.click(screen.getAllByRole('button', { name: 'Group settings' })[1]);

    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('is its own uploader — the picture opens a file dialog directly', () => {
    renderPanel({ role: 'owner' });

    const field = screen.getByLabelText('Change Nine Elms group picture');
    expect(field).toHaveAttribute('type', 'file');
    expect(field).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');

    // A label pointing at it, so a tap on the circle opens the dialog with no
    // script of ours, and the field stays keyboard reachable.
    const label = document.querySelector(`label[for="${field.id}"]`);
    expect(label).toBeInTheDocument();
    expect(label?.querySelector('svg, img')).toBeInTheDocument();
  });

  it('submits as soon as a file is chosen, with no separate save step', async () => {
    const user = userEvent.setup();
    renderPanel({ role: 'owner' });

    const field = screen.getByLabelText('Change Nine Elms group picture') as HTMLInputElement;
    const submit = vi.fn();
    // requestSubmit is what the change handler calls; jsdom does not implement it.
    (field.form as HTMLFormElement).requestSubmit = submit;

    await user.upload(field, new File(['x'], 'cover.png', { type: 'image/png' }));

    // The handler shrinks the file first, so the submit lands a microtask later.
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });

  it('is not a control at all for someone who cannot change it', () => {
    renderPanel({ role: 'member', viewerId: 'pani' });

    expect(screen.queryByRole('button', { name: /group picture$/ })).not.toBeInTheDocument();
  });

  it('marks the picture as editable with a decoration, not a second button', () => {
    const { container } = renderPanel({ role: 'admin', viewerId: 'dillon' });

    const pencil = container.querySelector('[class*="editPicture"]');
    expect(pencil).toBeInTheDocument();
    // aria-hidden, so the circle is the only thing announced for one action.
    expect(pencil).toHaveAttribute('aria-hidden', 'true');
    expect(pencil?.tagName).toBe('SPAN');
  });
});
