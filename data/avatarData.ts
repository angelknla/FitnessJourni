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
