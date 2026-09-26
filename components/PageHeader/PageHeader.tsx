import { ArrowLeftIcon } from '@components/Icons/Icons';
import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './PageHeader.module.css';

interface PageHeaderProps {
    actions?: ReactNode;
    animatedBack?: boolean;
    eyebrow: string;
    title: string;
}

export const PageHeader = ({ actions, animatedBack = false, eyebrow, title }: PageHeaderProps) => (
    <>
        <Link
            href="/"
            className={animatedBack ? `${styles.back} ${styles.animatedBack}` : styles.back}
        >
            <ArrowLeftIcon />
            Home
        </Link>

        <header className={styles.head}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <div className={styles.titleRow}>
                <h1 className={styles.title}>{title}</h1>
                {actions}
            </div>
        </header>
    </>
);