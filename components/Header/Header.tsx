'use client';

import { Heartbeat } from '@components/Heartbeat/Heartbeat';
import {
  CalendarIcon,
  DumbbellIcon,
  HomeIcon,
  LogsIcon,
  MessageIcon,
  ResyncIcon,
  RunningIcon,
} from '@components/Icons/Icons';
import { LoginButton } from '@components/LoginButton/LoginButton';
import { accentHex } from '@data/fitnessData';
import { navigationData } from '@data/navigationData';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type CSSProperties, useEffect, useState } from 'react';
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
  hasUnreadSessions?: boolean;
}

const UNCHOSEN: Viewer = { memberId: null, chosen: false };

export const Header = ({
  locked = false,
  members = [],
  viewer = UNCHOSEN,
  hasUnreadMessages = false,
  hasUnreadSessions = false,
}: HeaderProps) => {
  const [scrolled, setScrolled] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const you = members.find((member) => member.id === viewer.memberId);
  const identityLabel = you?.name ?? 'Profile';
  const identityInitial = you?.name.charAt(0).toUpperCase() ?? '?';
  const handleResync = () => {
    if (resyncing) return;
    setResyncing(true);
    window.setTimeout(() => window.location.reload(), 500);
  };
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
                      {((item.href === '/messages' && hasUnreadMessages) ||
                        (item.href === '/sessions' && hasUnreadSessions)) && (
                          <span className={styles.unreadDot} aria-hidden="true" />
                        )}
                    </Link>
                  );
                })}
              </nav>

              {members.length > 0 && (
                <>
                  <button
                    type="button"
                    className={styles.resync}
                    aria-label="Reload page"
                    aria-busy={resyncing}
                    title="Reload page"
                    disabled={resyncing}
                    onClick={handleResync}
                  >
                    <ResyncIcon />
                  </button>
                  <Link
                    href="/profile"
                    className={styles.identity}
                    style={
                      you ? ({ '--identity-accent': accentHex[you.accent] } as CSSProperties) : undefined
                    }
                    aria-label={`Open ${identityLabel} profile`}
                  >
                    {you?.avatarPath ? (
                      <Image
                        src={you.avatarPath}
                        alt=""
                        width={32}
                        height={32}
                        unoptimized={you.avatarPath.startsWith('http://')}
                      />
                    ) : (
                      identityInitial
                    )}
                  </Link>
                </>
              )}

            </div>
          </>
        )}
      </div>
    </header>
  );
};
