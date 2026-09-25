export const avatarOptions = [
  { path: '/avatars/tempo.svg', label: 'Tempo' },
  { path: '/avatars/summit.svg', label: 'Summit' },
  { path: '/avatars/ember.svg', label: 'Ember' },
  { path: '/avatars/orbit.svg', label: 'Orbit' },
  { path: '/avatars/sprint.svg', label: 'Sprint' },
  { path: '/avatars/pulse.svg', label: 'Pulse' },
] as const;

export const isAvatarPath = (value: string): boolean =>
  value === '' || avatarOptions.some((option) => option.path === value);
