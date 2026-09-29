import { describe, expect, it } from 'vitest';
import {
  type GroupInvitationRow,
  type GroupJoinRequestRow,
  type GroupMemberRow,
  type GroupRow,
  getActiveGroup,
  getGroupRole,
  getInvitationsForMember,
  getMemberships,
  mapGroup,
  mapGroupMember,
  mapInvitation,
  mapJoinRequest,
} from './groups';

const groupRow: GroupRow = {
  id: 'g1',
  name: 'Nine Elms',
  description: '  The originals  ',
  join_code: 'N7K4-P2Q9',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

describe('mapGroup', () => {
  it('takes the member count as an argument, because it is counted not stored', () => {
    expect(mapGroup(groupRow, 4).memberCount).toBe(4);
    expect(mapGroup(groupRow, 0).memberCount).toBe(0);
  });

  it('trims a description and treats an empty one as absent', () => {
    expect(mapGroup(groupRow, 1).description).toBe('The originals');
    expect(mapGroup({ ...groupRow, description: '   ' }, 1).description).toBeNull();
    expect(mapGroup({ ...groupRow, description: null }, 1).description).toBeNull();
  });

  it('keeps the code and timestamps as they are', () => {
    const group = mapGroup(groupRow, 1);
    expect(group.joinCode).toBe('N7K4-P2Q9');
    expect(group.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(group.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('mapGroupMember', () => {
  it('maps the role and join time', () => {
    const row: GroupMemberRow = {
      member_id: 'm1',
      role: 'admin',
      joined_at: '2026-01-03T00:00:00.000Z',
    };

    expect(mapGroupMember(row)).toEqual({
      memberId: 'm1',
      role: 'admin',
      joinedAt: '2026-01-03T00:00:00.000Z',
    });
  });
});

describe('mapInvitation', () => {
  const row: GroupInvitationRow = {
    id: 'i1',
    group_id: 'g1',
    member_id: 'm1',
    invited_by: 'm2',
    status: 'pending',
    created_at: '2026-03-01T00:00:00.000Z',
    groups: { name: 'Nine Elms' },
  };

  it('lifts the group name out of the embedded row', () => {
    expect(mapInvitation(row).groupName).toBe('Nine Elms');
  });

  it('falls back rather than rendering "undefined" when the embed is missing', () => {
    expect(mapInvitation({ ...row, groups: null }).groupName).toBe('A group');
  });
});

describe('mapJoinRequest', () => {
  it('carries the status through for the Profile listing', () => {
    const row: GroupJoinRequestRow = {
      id: 'r1',
      group_id: 'g1',
      member_id: 'm1',
      status: 'rejected',
      created_at: '2026-03-01T00:00:00.000Z',
      groups: { name: 'Nine Elms' },
    };

    expect(mapJoinRequest(row)).toEqual({
      id: 'r1',
      groupId: 'g1',
      groupName: 'Nine Elms',
      memberId: 'm1',
      status: 'rejected',
      createdAt: '2026-03-01T00:00:00.000Z',
    });
  });
});

/**
 * No Supabase credentials are set in the test environment, so these follow the
 * unconfigured path — the same one the setup notice depends on. A group read must
 * degrade to "no groups", never to a throw that takes a page down.
 */
describe('reads without a configured client', () => {
  it('reports no memberships, no active group and no role', async () => {
    await expect(getMemberships('m1')).resolves.toEqual([]);
    await expect(getActiveGroup('m1')).resolves.toBeNull();
    await expect(getGroupRole('g1', 'm1')).resolves.toBeNull();
    await expect(getInvitationsForMember('m1')).resolves.toEqual([]);
  });

  it('treats no active group as Personal mode rather than as an error', async () => {
    // Which is the whole reason it returns null instead of throwing: a member with
    // no groups is a supported state, not a failure.
    await expect(getActiveGroup('nobody')).resolves.toBeNull();
  });
});
