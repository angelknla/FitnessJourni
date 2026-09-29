import { describe, expect, it } from 'vitest';
import {
  canDeleteGroup,
  canDemoteToMember,
  canEditGroupDetails,
  canInviteMembers,
  canLeaveGroup,
  canPromoteToAdmin,
  canRegenerateJoinCode,
  canRemoveGroupMember,
  canReviewJoinRequests,
  canTransferOwnership,
  compareByRole,
  generateJoinCode,
  isValidGroupDescription,
  isValidGroupName,
  isValidJoinCode,
  JOIN_CODE_ALPHABET,
  normalizeJoinCode,
} from './groups';

describe('generateJoinCode', () => {
  it('produces the hyphenated four-and-four shape', () => {
    expect(generateJoinCode(() => 0)).toBe('AAAA-AAAA');
    expect(isValidJoinCode(generateJoinCode())).toBe(true);
  });

  it('only ever uses the unambiguous alphabet', () => {
    // Every draw, so a character outside the set cannot slip in unnoticed.
    for (let index = 0; index < JOIN_CODE_ALPHABET.length; index += 1) {
      const code = generateJoinCode(() => index / JOIN_CODE_ALPHABET.length);
      expect(code.replace('-', '')).toMatch(new RegExp(`^[${JOIN_CODE_ALPHABET}]+$`));
    }
  });

  it('leaves out the characters people misread', () => {
    for (const ambiguous of ['I', 'L', 'O', '0', '1']) {
      expect(JOIN_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });
});

describe('normalizeJoinCode', () => {
  it('accepts the spellings people actually type', () => {
    expect(normalizeJoinCode('N7K4-P2Q9')).toBe('N7K4-P2Q9');
    expect(normalizeJoinCode('n7k4p2q9')).toBe('N7K4-P2Q9');
    expect(normalizeJoinCode(' n7k4 - p2q9 ')).toBe('N7K4-P2Q9');
    expect(normalizeJoinCode('N7K-4P2Q9')).toBe('N7K4-P2Q9');
  });

  it('rejects anything that could not be a code', () => {
    expect(normalizeJoinCode('')).toBe('');
    expect(normalizeJoinCode('N7K4')).toBe('');
    expect(normalizeJoinCode('N7K4-P2Q99')).toBe('');
    // Characters the alphabet deliberately excludes are not silently mapped.
    expect(normalizeJoinCode('I7K4-P2Q9')).toBe('');
    expect(normalizeJoinCode('N7K4-P2Q0')).toBe('');
  });
});

describe('group name and description limits', () => {
  it('matches the database constraints', () => {
    expect(isValidGroupName('Nine Elms')).toBe(true);
    expect(isValidGroupName(' N ')).toBe(false);
    expect(isValidGroupName('x'.repeat(40))).toBe(true);
    expect(isValidGroupName('x'.repeat(41))).toBe(false);
    expect(isValidGroupDescription('')).toBe(true);
    expect(isValidGroupDescription('x'.repeat(200))).toBe(true);
    expect(isValidGroupDescription('x'.repeat(201))).toBe(false);
  });
});

describe('owner permissions', () => {
  it('covers every action the owner is allowed', () => {
    expect(canEditGroupDetails('owner')).toBe(true);
    expect(canInviteMembers('owner')).toBe(true);
    expect(canReviewJoinRequests('owner')).toBe(true);
    expect(canRemoveGroupMember('owner', 'member')).toBe(true);
    expect(canRemoveGroupMember('owner', 'admin')).toBe(true);
    expect(canPromoteToAdmin('owner', 'member')).toBe(true);
    expect(canDemoteToMember('owner', 'admin')).toBe(true);
    expect(canTransferOwnership('owner')).toBe(true);
    expect(canRegenerateJoinCode('owner')).toBe(true);
    expect(canDeleteGroup('owner')).toBe(true);
  });

  it('cannot leave until ownership has been handed over', () => {
    expect(canLeaveGroup('owner')).toBe(false);
  });
});

describe('admin permissions', () => {
  it('can run the group day to day', () => {
    expect(canEditGroupDetails('admin')).toBe(true);
    expect(canInviteMembers('admin')).toBe(true);
    expect(canReviewJoinRequests('admin')).toBe(true);
    expect(canRemoveGroupMember('admin', 'member')).toBe(true);
    expect(canLeaveGroup('admin')).toBe(true);
  });

  it('cannot manage the owner or other admins', () => {
    expect(canRemoveGroupMember('admin', 'owner')).toBe(false);
    expect(canRemoveGroupMember('admin', 'admin')).toBe(false);
    expect(canPromoteToAdmin('admin', 'member')).toBe(false);
    expect(canDemoteToMember('admin', 'admin')).toBe(false);
    expect(canTransferOwnership('admin')).toBe(false);
    expect(canRegenerateJoinCode('admin')).toBe(false);
    expect(canDeleteGroup('admin')).toBe(false);
  });
});

describe('member permissions', () => {
  it('may only leave', () => {
    expect(canLeaveGroup('member')).toBe(true);
    expect(canEditGroupDetails('member')).toBe(false);
    expect(canInviteMembers('member')).toBe(false);
    expect(canReviewJoinRequests('member')).toBe(false);
    expect(canRemoveGroupMember('member', 'member')).toBe(false);
    expect(canDeleteGroup('member')).toBe(false);
  });
});

describe('non-members', () => {
  it('are refused everything — a null role is never a permission', () => {
    expect(canEditGroupDetails(null)).toBe(false);
    expect(canInviteMembers(null)).toBe(false);
    expect(canReviewJoinRequests(null)).toBe(false);
    expect(canRemoveGroupMember(null, 'member')).toBe(false);
    expect(canPromoteToAdmin(null, 'member')).toBe(false);
    expect(canTransferOwnership(null)).toBe(false);
    expect(canDeleteGroup(null)).toBe(false);
    expect(canLeaveGroup(null)).toBe(false);
  });
});

describe('the owner is never removable', () => {
  it('refuses every actor, including another owner claim', () => {
    expect(canRemoveGroupMember('owner', 'owner')).toBe(false);
    expect(canRemoveGroupMember('admin', 'owner')).toBe(false);
    expect(canRemoveGroupMember('member', 'owner')).toBe(false);
  });

  it('routes self-removal to leaving instead', () => {
    expect(canRemoveGroupMember('admin', 'admin', true)).toBe(false);
    expect(canRemoveGroupMember('owner', 'member', true)).toBe(false);
  });
});

describe('compareByRole', () => {
  it('lists the owner, then admins, then members alphabetically', () => {
    const people = [
      { role: 'member' as const, name: 'Pani' },
      { role: 'owner' as const, name: 'Angel' },
      { role: 'member' as const, name: 'Bradley' },
      { role: 'admin' as const, name: 'Dillon' },
    ];

    expect([...people].sort(compareByRole).map((person) => person.name)).toEqual([
      'Angel',
      'Dillon',
      'Bradley',
      'Pani',
    ]);
  });
});
