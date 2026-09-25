'use client';

import { Heartbeat } from '@components/Heartbeat/Heartbeat';
import { IdentityDialog } from '@components/IdentityDialog/IdentityDialog';
import { LoginButton } from '@components/LoginButton/LoginButton';
import { accentHex } from '@data/fitnessData';
import { navigationData } from '@data/navigationData';
import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import type { Viewer } from '@/lib/session';
import type { Member } from '@/types/fitness';

import styles from './Header.module.css';

interface HeaderProps {
  /** Locked visitors get a Log in button instead of nav that would go nowhere. */
  locked?: boolean;
  /** Empty while locked — the layout must not query members before the gate. */
  members?: Member[];
  viewer?: Viewer;
}

const UNCHOSEN: Viewer = { memberId: null, chosen: false };

export const Header = ({ locked = false, members = [], viewer = UNCHOSEN }: HeaderProps) => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  const closeMenu = () => setOpen(false);
  const closeIdentity = useCallback(() => setIdentityOpen(false), []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /*
   * Asking straight after the gate is what makes this the second step of logging
   * in. It keys on `chosen` rather than on there being no member, so picking
   * Visitor is remembered instead of being asked again on the next load. It also
   * covers a deploy with no APP_PASSCODE, where there is no login modal at all.
   */
  useEffect(() => {
    if (!locked && members.length > 0 && !viewer.chosen) {
      setIdentityOpen(true);
    }
  }, [locked, members.length, viewer.chosen]);

  const you = members.find((member) => member.id === viewer.memberId);
  const identityLabel = viewer.chosen ? (you?.name ?? 'Visitor') : 'Who are you?';
  const identityInitial = you?.name.charAt(0).toUpperCase() ?? (viewer.chosen ? 'V' : '?');

  return (
    <header className={scrolled ? `${styles.container} ${styles.scrolled}` : styles.container}>
      <div className={styles.inner}>
        <Link href="/" onClick={closeMenu} className={styles.logo}>
          <span className={styles.logoText}>FitnessJourni</span>
          <Heartbeat />
        </Link>

        {locked ? (
          <LoginButton />
        ) : (
          <>
            {/* One right-aligned group, so .inner's space-between keeps the menu
                hard right. The profile follows the desktop links and stays beside
                the burger on mobile, where the nav is a fixed overlay. */}
            <div className={styles.side}>
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

              {members.length > 0 && (
                <Link
                  href="/profile"
                  className={styles.identity}
                  data-visitor={viewer.chosen && !you}
                  style={
                    you ? ({ '--identity-accent': accentHex[you.accent] } as CSSProperties) : undefined
                  }
                  aria-label={`Open ${identityLabel} profile`}
                >
                  {identityInitial}
                </Link>
              )}

              <button
                type="button"
                aria-expanded={open}
                aria-controls="main-navigation"
                aria-label={open ? 'Close menu' : 'Open menu'}
                className={open ? `${styles.menu} ${styles.active}` : styles.menu}
                onClick={() => setOpen((prev) => !prev)}
              />

              {members.length > 0 && (
                <IdentityDialog
                  members={members}
                  viewerId={viewer.memberId}
                  open={identityOpen}
                  onClose={closeIdentity}
                />
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
};
