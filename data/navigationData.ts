export interface NavItem {
  label: string;
  href: string;
}

export const navigationData: NavItem[] = [
  { label: 'Today', href: '/' },
  { label: 'Workouts', href: '/workouts' },
  { label: 'Logs', href: '/logs' },
  { label: 'Sessions', href: '/sessions' },
];
