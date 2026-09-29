export const avatarOptions = [
  { path: '/avatars/tempo.svg', label: 'Tempo' },
  { path: '/avatars/summit.svg', label: 'Summit' },
  { path: '/avatars/ember.svg', label: 'Ember' },
  { path: '/avatars/orbit.svg', label: 'Orbit' },
  { path: '/avatars/sprint.svg', label: 'Sprint' },
  { path: '/avatars/pulse.svg', label: 'Pulse' },
] as const;

export const AVATAR_UPLOAD_BUCKET = 'profile-avatars';
export const AVATAR_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const avatarUploadTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const avatarObjectPath = (memberId: string): string => `${memberId}/profile`;

export const isAvatarPath = (value: string): boolean =>
  value === '' || avatarOptions.some((option) => option.path === value);

/**
 * Group pictures. A separate bucket from profile avatars so a group's image and a
 * person's cannot collide, and so the two can be governed independently.
 *
 * There is no preset list on purpose: the six avatars above exist because a new
 * member needs *something* before they have a photo, whereas a group with no
 * picture has a perfectly good default already — the two-figure icon the badge
 * uses. So this is upload or nothing.
 */
export const GROUP_IMAGE_BUCKET = 'group-images';

/** One deterministic object per group, so uploading again replaces rather than piles up. */
export const groupImageObjectPath = (groupId: string): string => `${groupId}/cover`;
