'use client';

import { Heartbeat } from '@components/Heartbeat/Heartbeat';
import { IdentityDialog } from '@components/IdentityDialog/IdentityDialog';
import { LoginButton } from '@components/LoginButton/LoginButton';
import { navigationData } from '@data/navigationData';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { lock } from '@/app/auth-actions';
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
  const [signingOut, startSignOut] = useTransition();
  const router = useRouter();

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

  const signOut = () =>
    startSignOut(async () => {
      await lock();
      router.refresh();
    });

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
                hard right as it was. The chip sits before the nav, which puts it
                left of the links on desktop and beside the burger on mobile,
                where the nav itself is a fixed overlay and out of the row. */}
            <div className={styles.side}>
              {/* Nothing to pick from before Supabase is connected, and a chip
                  that opens an empty list is just a dead end. */}
              {members.length > 0 && (
                <button
                  type="button"
                  className={styles.identity}
                  onClick={() => setIdentityOpen(true)}
                  data-visitor={viewer.chosen && !you}
                  aria-label={`Signed in as ${identityLabel} — change person`}
                >
                  {identityLabel}
                </button>
              )}

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

                {/* Part of the menu on both sizes: inline after the links on
                    desktop, inside the overlay on mobile. */}
                <button
                  type="button"
                  className={styles.logout}
                  onClick={signOut}
                  disabled={signingOut}
                >
                  {signingOut ? 'Logging out…' : 'Log out'}
                </button>
              </nav>

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
