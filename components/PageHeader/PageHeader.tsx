import { ArrowLeftIcon } from '@components/Icons/Icons';
import Link from 'next/link';

import styles from './PageHeader.module.css';

interface PageHeaderProps {
    animatedBack?: boolean;
    eyebrow: string;
    title: string;
}

export const PageHeader = ({ animatedBack = false, eyebrow, title }: PageHeaderProps) => (
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
            <h1 className={styles.title}>{title}</h1>
        </header>
    </>
);