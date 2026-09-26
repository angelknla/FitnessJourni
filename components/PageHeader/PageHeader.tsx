import type { ReactNode } from 'react';

import styles from './PageHeader.module.css';

interface PageHeaderProps {
    actions?: ReactNode;
    eyebrow: string;
    title: string;
}

export const PageHeader = ({ actions, eyebrow, title }: PageHeaderProps) => (
    <header className={styles.head}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {actions}
        </div>
    </header>
);