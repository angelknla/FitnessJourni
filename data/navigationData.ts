export interface NavItem {
  label: string;
  href: string;
}

export const navigationData: NavItem[] = [
  { label: 'Today', href: '/' },
  { label: 'Sessions', href: '/sessions' },
];
