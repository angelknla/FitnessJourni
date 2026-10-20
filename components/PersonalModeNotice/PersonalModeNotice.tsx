import ui from '@/styles/ui.module.css';
import Link from '@components/NavigationLink/NavigationLink';

import styles from './PersonalModeNotice.module.css';

interface PersonalModeNoticeProps {
  /** What is unavailable, named so the notice explains this page specifically. */
  title: string;
  description: string;
}

/**
 * Shown where a page needs a group and the viewer has none. Personal mode is a
 * legitimate state, not an error: logging still works, so this explains what is
 * empty and links to the one place that changes it.
 */
export const PersonalModeNotice = ({ title, description }: PersonalModeNoticeProps) => (
  <section className={`${styles.notice} ${ui.card}`} aria-labelledby="personal-mode-heading">
    <p className={styles.eyebrow}>Personal</p>
    <h2 id="personal-mode-heading">{title}</h2>
    <p className={styles.description}>{description}</p>
    <Link href="/groups" className={styles.action}>
      Join or create a group
    </Link>
  </section>
);
