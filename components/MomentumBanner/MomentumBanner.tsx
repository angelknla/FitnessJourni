import type { ReactNode } from 'react';
import styles from './MomentumBanner.module.css';

interface MomentumBannerProps {
  eyebrow: string;
  title: string;
  description?: string;
  mobileDescription?: string;
  mobileSingleLine?: boolean;
  actions?: ReactNode;
  heading?: 'h1' | 'h2';
  compact?: boolean;
}

export const MomentumBanner = ({
  eyebrow,
  title,
  description,
  mobileDescription,
  mobileSingleLine = false,
  actions,
  heading: Heading = 'h1',
  compact = false,
}: MomentumBannerProps) => (
  <div
    className={styles.banner}
    data-compact={compact || undefined}
    data-mobile-single-line={mobileSingleLine || undefined}
  >
    <div className={styles.content}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <Heading className={styles.title}>{title}</Heading>
      {description && (
        <p className={styles.description} data-desktop-only={Boolean(mobileDescription) || undefined}>
          {description}
        </p>
      )}
      {mobileDescription && (
        <p className={`${styles.description} ${styles.mobileDescription}`}>{mobileDescription}</p>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
    <div className={styles.art} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  </div>
);
