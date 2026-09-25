import { describe, expect, it } from 'vitest';
import { ADMIN_MEMBER_NAME, canEditMember, canRemoveMembers } from './ownership';
import type { Viewer } from './session';

const signedIn: Viewer = { memberId: 'm1', chosen: true };
const visitor: Viewer = { memberId: null, chosen: true };
const unchosen: Viewer = { memberId: null, chosen: false };

describe('canEditMember', () => {
  it('lets someone edit their own rows', () => {
    expect(canEditMember(signedIn, 'm1')).toBe(true);
  });

  it('refuses someone else’s rows', () => {
    expect(canEditMember(signedIn, 'm2')).toBe(false);
  });

  it('refuses a visitor everything', () => {
    expect(canEditMember(visitor, 'm1')).toBe(false);
  });

  it('refuses before anyone has chosen', () => {
    expect(canEditMember(unchosen, 'm1')).toBe(false);
  });

  // Both sides null must not read as a match, which is what a bare === would do.
  it('refuses an empty member id, even for a visitor', () => {
    expect(canEditMember(visitor, '')).toBe(false);
  });
});

describe('canRemoveMembers', () => {
  const members = [
    { id: 'm1', name: 'Dillon' },
    { id: 'm2', name: ADMIN_MEMBER_NAME },
    { id: 'm3', name: 'Bradley' },
  ];

  it('lets the admin member remove people', () => {
    expect(canRemoveMembers({ memberId: 'm2', chosen: true }, members)).toBe(true);
  });

  it('refuses everyone else', () => {
    expect(canRemoveMembers({ memberId: 'm1', chosen: true }, members)).toBe(false);
    expect(canRemoveMembers({ memberId: 'm3', chosen: true }, members)).toBe(false);
  });

  it('refuses a visitor', () => {
    expect(canRemoveMembers({ memberId: null, chosen: true }, members)).toBe(false);
  });

  /* The cookie holds an id, so a member removed since it was set must not keep
     whatever powers that id had. */
  it('refuses an id that matches nobody', () => {
    expect(canRemoveMembers({ memberId: 'gone', chosen: true }, members)).toBe(false);
  });

  it('ignores case and stray spaces in the stored name', () => {
    const scruffy = [{ id: 'm2', name: `  ${ADMIN_MEMBER_NAME.toUpperCase()} ` }];

    expect(canRemoveMembers({ memberId: 'm2', chosen: true }, scruffy)).toBe(true);
  });
});
