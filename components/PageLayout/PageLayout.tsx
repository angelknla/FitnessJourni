import type { HTMLAttributes, ReactNode } from 'react';

import styles from './PageLayout.module.css';

interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

export const PageLayout = ({ children, className, ...props }: PageLayoutProps) => (
    <div className={className ? `${styles.page} ${className}` : styles.page} {...props}>
        {children}
    </div>
);