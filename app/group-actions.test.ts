import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock, type SupabaseMock } from '@/lib/testing/supabaseMock';

/*
 * The action's own decisions are what matter here: who it refuses, in what order
 * it checks things, and which single call it makes for the operations that have to
 * be atomic. Everything the database enforces is asserted in supabase/schema.test.ts.
 */

const state = {
  unlocked: true,
  memberId: 'viewer' as string | null,
  role: null as string | null,
  memberships: [] as { group: { id: string; name: string }; role: string }[],
  account: null as { memberId: string; username: string } | null,
  /** Role lookups keyed by member, so a target's role can differ from the actor's. */
  rolesByMember: {} as Record<string, string | null>,
};

let supabase: SupabaseMock;

vi.mock('@/lib/session', () => ({
  isUnlocked: vi.fn(async () => state.unlocked),
  readViewer: vi.fn(async () => ({ memberId: state.memberId, chosen: true })),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabase: () => supabase.client,
}));

const getGroupRole = vi.fn(async (_groupId: string, memberId: string) =>
  memberId in state.rolesByMember ? state.rolesByMember[memberId] : state.role
);

vi.mock('@/lib/data/groups', () => ({
  getGroupRole: (groupId: string, memberId: string) => getGroupRole(groupId, memberId),
  getMemberships: async () => state.memberships,
  getActiveGroup: async () =>
    state.memberships[0]
      ? { id: state.memberships[0].group.id, name: state.memberships[0].group.name, role: 'member' }
      : null,
}));

const findAccountByUsername = vi.fn(async () => state.account);
vi.mock('@/lib/data/accounts', () => ({
  findAccountByUsername: () => findAccountByUsername(),
}));

vi.mock('@/lib/data/members', () => ({
  getMembers: async () => [
    { id: 'viewer', name: 'Angel' },
    { id: 'target', name: 'Pani' },
  ],
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));

import {
  createGroup,
  deleteGroup,
  inviteMemberByUsername,
  leaveGroup,
  removeGroupMember,
  requestGroupAccess,
  respondToInvitation,
  switchActiveGroup,
  transferGroupOwnership,
  updateGroupDetails,
} from './group-actions';

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
};

const initial = { ok: false };

beforeEach(() => {
  state.unlocked = true;
  state.memberId = 'viewer';
  state.role = null;
  state.memberships = [];
  state.account = null;
  state.rolesByMember = {};
  supabase = createSupabaseMock();
  getGroupRole.mockClear();
  findAccountByUsername.mockClear();
});

describe('being signed in', () => {
  it('refuses every group mutation to a locked browser', async () => {
    state.unlocked = false;

    const result = await createGroup(initial, form({ name: 'Nine Elms' }));

    expect(result.ok).toBe(false);
    expect(supabase.calls).toHaveLength(0);
  });

  it('refuses a visitor with no member session', async () => {
    state.memberId = null;

    const result = await createGroup(initial, form({ name: 'Nine Elms' }));

    expect(result.error).toMatch(/log in/i);
  });
});

describe('createGroup', () => {
  it('validates the name before writing anything', async () => {
    const result = await createGroup(initial, form({ name: 'N' }));

    expect(result.ok).toBe(false);
    expect(supabase.rpcs).toHaveLength(0);
  });

  it('creates the group in one call, which is what makes ownership automatic', async () => {
    supabase = createSupabaseMock(
      {},
      {
        create_group: { data: [{ group_id: 'g1', join_code: 'N7K4-P2Q9' }] },
      }
    );

    const result = await createGroup(initial, form({ name: 'Nine Elms', description: 'Us' }));

    expect(result.ok).toBe(true);
    expect(supabase.rpcs).toEqual([
      {
        name: 'create_group',
        args: { p_name: 'Nine Elms', p_description: 'Us', p_owner_id: 'viewer' },
      },
    ]);
    expect(result.joinCode).toBe('N7K4-P2Q9');
  });
});

describe('switchActiveGroup', () => {
  it('refuses a group the viewer is not a member of', async () => {
    state.role = null;

    const result = await switchActiveGroup(initial, form({ groupId: 'someone-elses' }));

    expect(result.ok).toBe(false);
    expect(supabase.used('member_active_groups', 'upsert')).toBe(false);
  });

  it('persists the choice once membership is confirmed', async () => {
    state.role = 'member';
    state.memberships = [{ group: { id: 'g1', name: 'Nine Elms' }, role: 'member' }];

    const result = await switchActiveGroup(initial, form({ groupId: 'g1' }));

    expect(result.ok).toBe(true);
    const [row] = supabase.argsFor('member_active_groups', 'upsert') as [
      { member_id: string; group_id: string },
    ];
    expect(row).toMatchObject({ member_id: 'viewer', group_id: 'g1' });
  });
});

describe('editing group details', () => {
  it('refuses a plain member', async () => {
    state.role = 'member';

    const result = await updateGroupDetails(initial, form({ groupId: 'g1', name: 'Renamed' }));

    expect(result.ok).toBe(false);
    expect(supabase.used('groups', 'update')).toBe(false);
  });

  it('allows an admin', async () => {
    state.role = 'admin';

    const result = await updateGroupDetails(
      initial,
      form({ groupId: 'g1', name: 'Renamed', description: 'New' })
    );

    expect(result.ok).toBe(true);
    expect(supabase.used('groups', 'update')).toBe(true);
  });
});

describe('inviting by username', () => {
  it('checks the role before looking a username up, so it cannot be used to probe', async () => {
    state.role = 'member';
    state.account = { memberId: 'target', username: 'pani' };

    const result = await inviteMemberByUsername(initial, form({ groupId: 'g1', username: 'pani' }));

    expect(result.ok).toBe(false);
    expect(findAccountByUsername).not.toHaveBeenCalled();
  });

  it('refuses someone who is already in the group', async () => {
    state.role = 'owner';
    state.account = { memberId: 'target', username: 'pani' };
    state.rolesByMember = { viewer: 'owner', target: 'member' };

    const result = await inviteMemberByUsername(initial, form({ groupId: 'g1', username: 'pani' }));

    expect(result.error).toMatch(/already in this group/i);
    expect(supabase.used('group_invitations', 'insert')).toBe(false);
  });

  it('refuses a second invitation while one is still open', async () => {
    state.role = 'owner';
    state.account = { memberId: 'target', username: 'pani' };
    state.rolesByMember = { viewer: 'owner', target: null };
    supabase = createSupabaseMock({
      group_invitations: { data: { id: 'existing' } },
      group_join_requests: { data: null },
    });

    const result = await inviteMemberByUsername(initial, form({ groupId: 'g1', username: 'pani' }));

    expect(result.error).toMatch(/already been invited/i);
    expect(supabase.used('group_invitations', 'insert')).toBe(false);
  });

  it('points at the pending request instead when they already asked', async () => {
    state.role = 'admin';
    state.account = { memberId: 'target', username: 'pani' };
    state.rolesByMember = { viewer: 'admin', target: null };
    supabase = createSupabaseMock({
      group_invitations: { data: null },
      group_join_requests: { data: { id: 'asked' } },
    });

    const result = await inviteMemberByUsername(initial, form({ groupId: 'g1', username: 'pani' }));

    expect(result.error).toMatch(/approve their request/i);
  });

  it('creates a pending invitation rather than adding them outright', async () => {
    state.role = 'owner';
    state.account = { memberId: 'target', username: 'pani' };
    state.rolesByMember = { viewer: 'owner', target: null };

    const result = await inviteMemberByUsername(initial, form({ groupId: 'g1', username: 'pani' }));

    expect(result.ok).toBe(true);
    expect(supabase.used('group_members', 'insert')).toBe(false);
    const [row] = supabase.argsFor('group_invitations', 'insert') as [
      { group_id: string; member_id: string; invited_by: string },
    ];
    expect(row).toEqual({ group_id: 'g1', member_id: 'target', invited_by: 'viewer' });
  });
});

describe('joining with a code', () => {
  it('rejects something that could not be a code without querying', async () => {
    const result = await requestGroupAccess(initial, form({ joinCode: 'nope' }));

    expect(result.error).toMatch(/N7K4-P2Q9/);
    expect(supabase.calls).toHaveLength(0);
  });

  it('normalises what was typed before looking it up', async () => {
    supabase = createSupabaseMock({ groups: { data: { id: 'g1', name: 'Nine Elms' } } });
    state.rolesByMember = { viewer: null };

    await requestGroupAccess(initial, form({ joinCode: ' n7k4p2q9 ' }));

    const lookup = supabase.callsTo('groups')[0];
    expect(lookup.ops).toEqual(expect.arrayContaining([['eq', 'join_code', 'N7K4-P2Q9']]));
  });

  it('creates a request for approval, never a membership', async () => {
    supabase = createSupabaseMock({ groups: { data: { id: 'g1', name: 'Nine Elms' } } });
    state.rolesByMember = { viewer: null };

    const result = await requestGroupAccess(initial, form({ joinCode: 'N7K4-P2Q9' }));

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/approve/i);
    expect(supabase.used('group_members', 'insert')).toBe(false);
    expect(supabase.used('group_join_requests', 'insert')).toBe(true);
  });

  it('refuses a second request while one is still open', async () => {
    supabase = createSupabaseMock({
      groups: { data: { id: 'g1', name: 'Nine Elms' } },
      group_join_requests: { data: { id: 'asked' } },
    });
    state.rolesByMember = { viewer: null };

    const result = await requestGroupAccess(initial, form({ joinCode: 'N7K4-P2Q9' }));

    expect(result.error).toMatch(/already asked/i);
  });

  it('treats a unique-violation race as the same duplicate', async () => {
    supabase = createSupabaseMock({
      groups: { data: { id: 'g1', name: 'Nine Elms' } },
      group_join_requests: (call) =>
        call.ops.some(([name]) => name === 'insert')
          ? { error: { message: 'duplicate key', code: '23505' } }
          : { data: null },
    });
    state.rolesByMember = { viewer: null };

    const result = await requestGroupAccess(initial, form({ joinCode: 'N7K4-P2Q9' }));

    expect(result.error).toMatch(/already asked/i);
  });

  it('refuses when they are already in that group', async () => {
    supabase = createSupabaseMock({ groups: { data: { id: 'g1', name: 'Nine Elms' } } });
    state.rolesByMember = { viewer: 'member' };

    const result = await requestGroupAccess(initial, form({ joinCode: 'N7K4-P2Q9' }));

    expect(result.error).toMatch(/already in Nine Elms/i);
  });
});

describe('answering an invitation', () => {
  it('accepts through the transactional function, not a bare insert', async () => {
    const result = await respondToInvitation(
      initial,
      form({ invitationId: 'i1', decision: 'accept' })
    );

    expect(result.ok).toBe(true);
    expect(supabase.rpcs).toEqual([
      { name: 'accept_group_invitation', args: { p_invitation_id: 'i1', p_member_id: 'viewer' } },
    ]);
    expect(supabase.used('group_members', 'insert')).toBe(false);
  });

  it('scopes a decline to the viewer’s own pending row', async () => {
    supabase = createSupabaseMock({ group_invitations: { data: [{ id: 'i1' }] } });

    const result = await respondToInvitation(
      initial,
      form({ invitationId: 'i1', decision: 'decline' })
    );

    expect(result.ok).toBe(true);
    const update = supabase.callsTo('group_invitations')[0];
    expect(update.ops).toEqual(
      expect.arrayContaining([
        ['eq', 'id', 'i1'],
        ['eq', 'member_id', 'viewer'],
        ['eq', 'status', 'pending'],
      ])
    );
  });

  it('reports an already-answered invitation as gone', async () => {
    supabase = createSupabaseMock({ group_invitations: { data: [] } });

    const result = await respondToInvitation(
      initial,
      form({ invitationId: 'i1', decision: 'decline' })
    );

    expect(result.ok).toBe(false);
  });
});

describe('ownership', () => {
  it('refuses a transfer from anyone but the owner', async () => {
    state.role = 'admin';

    const result = await transferGroupOwnership(
      initial,
      form({ groupId: 'g1', memberId: 'target' })
    );

    expect(result.ok).toBe(false);
    expect(supabase.rpcs).toHaveLength(0);
  });

  it('hands over in a single transaction, because two owners is briefly invalid', async () => {
    state.role = 'owner';

    const result = await transferGroupOwnership(
      initial,
      form({ groupId: 'g1', memberId: 'target' })
    );

    expect(result.ok).toBe(true);
    expect(supabase.rpcs).toEqual([
      {
        name: 'transfer_group_ownership',
        args: { p_group_id: 'g1', p_owner_id: 'viewer', p_member_id: 'target' },
      },
    ]);
  });

  it('will not let the owner leave — a group must always have one', async () => {
    state.role = 'owner';

    const result = await leaveGroup(initial, form({ groupId: 'g1' }));

    expect(result.error).toMatch(/hand the group over/i);
    expect(supabase.rpcs).toHaveLength(0);
  });

  it('lets an admin leave', async () => {
    state.role = 'admin';

    const result = await leaveGroup(initial, form({ groupId: 'g1' }));

    expect(result.ok).toBe(true);
    expect(supabase.rpcs[0]?.name).toBe('leave_group');
  });
});

describe('removing a member', () => {
  it('refuses a plain member', async () => {
    state.role = 'member';

    const result = await removeGroupMember(initial, form({ groupId: 'g1', memberId: 'target' }));

    expect(result.ok).toBe(false);
    expect(supabase.rpcs).toHaveLength(0);
  });

  it('defers the role comparison to the transactional function', async () => {
    state.role = 'admin';

    const result = await removeGroupMember(initial, form({ groupId: 'g1', memberId: 'target' }));

    expect(result.ok).toBe(true);
    expect(supabase.rpcs).toEqual([
      {
        name: 'remove_group_member',
        args: { p_group_id: 'g1', p_actor_id: 'viewer', p_member_id: 'target' },
      },
    ]);
  });

  it('surfaces the function’s refusal of an admin removing an admin', async () => {
    state.role = 'admin';
    supabase = createSupabaseMock({}, { remove_group_member: { data: 'forbidden' } });

    const result = await removeGroupMember(initial, form({ groupId: 'g1', memberId: 'target' }));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/permission/i);
  });
});

describe('deleting a group', () => {
  beforeEach(() => {
    state.role = 'owner';
    state.memberships = [{ group: { id: 'g1', name: 'Nine Elms' }, role: 'owner' }];
  });

  it('requires the name typed back, and does nothing without it', async () => {
    const result = await deleteGroup(initial, form({ groupId: 'g1', confirm: '' }));

    expect(result.error).toMatch(/type the group name/i);
    expect(supabase.rpcs).toHaveLength(0);
  });

  it('rejects a confirmation that does not match', async () => {
    const result = await deleteGroup(initial, form({ groupId: 'g1', confirm: 'Nine Elm' }));

    expect(result.ok).toBe(false);
    expect(supabase.rpcs).toHaveLength(0);
  });

  it('deletes once confirmed, case-insensitively', async () => {
    const result = await deleteGroup(initial, form({ groupId: 'g1', confirm: 'nine elms' }));

    expect(result.ok).toBe(true);
    expect(supabase.rpcs).toEqual([
      { name: 'delete_group', args: { p_group_id: 'g1', p_actor_id: 'viewer' } },
    ]);
  });

  it('refuses an admin outright', async () => {
    state.role = 'admin';

    const result = await deleteGroup(initial, form({ groupId: 'g1', confirm: 'Nine Elms' }));

    expect(result.ok).toBe(false);
    expect(supabase.rpcs).toHaveLength(0);
  });
});

describe('the field names a form posts', () => {
  /*
   * Netlify's edge rejects any POST carrying a form field called `response` with a
   * bare 403, before it reaches the app — which broke accepting an invitation in
   * production while every other action worked. This pins the name so it cannot
   * drift back.
   */
  it('does not read a field called "response"', async () => {
    const data = new FormData();
    data.set('invitationId', 'i1');
    data.set('response', 'accept');

    const result = await respondToInvitation(initial, data);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/accept or decline/i);
  });

  it('reads "decision" instead', async () => {
    const result = await respondToInvitation(
      initial,
      form({ invitationId: 'i1', decision: 'accept' })
    );

    expect(result.ok).toBe(true);
  });
});
