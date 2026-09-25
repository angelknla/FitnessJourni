import type { ReactNode } from 'react';

import styles from './PageLayout.module.css';

interface PageLayoutProps {
    children: ReactNode;
    className?: string;
}

export const PageLayout = ({ children, className }: PageLayoutProps) => (
    <div className={className ? `${styles.page} ${className}` : styles.page}>{children}</div>
);