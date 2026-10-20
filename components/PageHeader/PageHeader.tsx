import { MomentumBanner } from '@components/MomentumBanner/MomentumBanner';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  actions?: ReactNode;
  eyebrow: string;
  title: string;
}

export const PageHeader = (props: PageHeaderProps) => (
  <header>
    <MomentumBanner {...props} compact />
  </header>
);
