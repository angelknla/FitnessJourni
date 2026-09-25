export interface NavItem {
  label: string;
  href: string;
}

export const navigationData: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Workouts', href: '/workouts' },
  { label: 'Logs', href: '/logs' },
  { label: 'Running', href: '/running' },
  { label: 'Sessions', href: '/sessions' },
  { label: 'Chat', href: '/messages' },
];
