'use client';

import { Heartbeat } from '@components/Heartbeat/Heartbeat';
import {
  CalendarIcon,
  DumbbellIcon,
  HomeIcon,
  LogsIcon,
  MessageIcon,
  RunningIcon,
} from '@components/Icons/Icons';
import { IdentityDialog } from '@components/IdentityDialog/IdentityDialog';
import { LoginButton } from '@components/LoginButton/LoginButton';
import { accentHex } from '@data/fitnessData';
import { navigationData } from '@data/navigationData';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  hasUnreadMessages?: boolean;
}

const UNCHOSEN: Viewer = { memberId: null, chosen: false };

export const Header = ({
  locked = false,
  members = [],
  viewer = UNCHOSEN,
  hasUnreadMessages = false,
}: HeaderProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const pathname = usePathname();

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
  const navIcons = {
    '/': HomeIcon,
    '/workouts': DumbbellIcon,
    '/running': RunningIcon,
    '/logs': LogsIcon,
    '/sessions': CalendarIcon,
    '/messages': MessageIcon,
  };

  return (
    <header className={scrolled ? `${styles.container} ${styles.scrolled}` : styles.container}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoText}>FitnessJourni</span>
          <Heartbeat />
        </Link>

        {locked ? (
          <LoginButton />
        ) : (
          <>
            {/* The profile follows the desktop links and remains in the header
              while mobile navigation moves to the bottom of the viewport. */}
            <div className={styles.side}>
              <nav
                id="main-navigation"
                className={styles.nav}
                aria-label="Primary navigation"
              >
                {navigationData.map((item) => {
                  const Icon = navIcons[item.href as keyof typeof navIcons];
                  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={styles.link}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      {item.href === '/messages' && hasUnreadMessages && (
                        <span className={styles.unreadDot} aria-hidden="true" />
                      )}
                    </Link>
                  );
                })}
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
