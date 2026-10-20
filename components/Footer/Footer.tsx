import Link from '@components/NavigationLink/NavigationLink';

import styles from './Footer.module.css';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <Link href="/" className={styles.footerLogo}>
        FitnessJourni
      </Link>
      <p className={styles.footerText}>© {currentYear} FitnessJourni. All rights reserved.</p>
    </footer>
  );
};
