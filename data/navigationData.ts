export interface NavItem {
  label: string;
  href: string;
}

export const navigationData: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Workouts', href: '/workouts' },
  { label: 'Running', href: '/running' },
  { label: 'Logs', href: '/logs' },
  { label: 'Sessions', href: '/sessions' },
];
