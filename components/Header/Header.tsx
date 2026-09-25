'use client';

import { LoginButton } from '@components/LoginButton/LoginButton';
import { navigationData } from '@data/navigationData';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import styles from './Header.module.css';

interface HeaderProps {
  /** Locked visitors get a Log in button instead of nav that would go nowhere. */
  locked?: boolean;
}

export const Header = ({ locked = false }: HeaderProps) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const closeMenu = () => setOpen(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={scrolled ? `${styles.container} ${styles.scrolled}` : styles.container}>
      <div className={styles.inner}>
        <Link href="/" onClick={closeMenu} className={styles.logo}>
          FitnessJourni
        </Link>

        {locked ? (
          <LoginButton />
        ) : (
          <>
            <nav
              id="main-navigation"
              className={open ? `${styles.nav} ${styles.active}` : styles.nav}
              onClick={closeMenu}
              onKeyDown={(e) => e.key === 'Enter' && closeMenu()}
            >
              {navigationData.map((item) => (
                <Link key={item.href} href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              aria-expanded={open}
              aria-controls="main-navigation"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className={open ? `${styles.menu} ${styles.active}` : styles.menu}
              onClick={() => setOpen((prev) => !prev)}
            />
          </>
        )}
      </div>
    </header>
  );
};
