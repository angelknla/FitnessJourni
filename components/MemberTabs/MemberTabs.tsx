'use client';

import { GroupBadge } from '@components/GroupBadge/GroupBadge';
import { CrossIcon, PlusIcon } from '@components/Icons/Icons';
import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { accentHex } from '@data/fitnessData';
import { type CSSProperties, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { Member } from '@/types/fitness';

import styles from './MemberTabs.module.css';

interface MemberTabsProps {
  members: Member[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  addOpen: boolean;
  /** Id of the panel these tabs control, for aria-controls. */
  panelId: string;
  /** The active group, or null for someone who belongs to none yet. */
  activeGroupName?: string | null;
  /** The active group's picture, if it has one. */
  activeGroupImage?: string | null;
  /** Invitations plus join requests waiting on this person. */
  pendingGroupCount?: number;
}

export const MemberTabs = ({
  members,
  activeId,
  onSelect,
  onAdd,
  addOpen,
  panelId,
  activeGroupName = null,
  activeGroupImage = null,
  pendingGroupCount = 0,
}: MemberTabsProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false });
  const memberCount = members.length;

  useEffect(() => {
    const list = listRef.current;
    if (!list || memberCount === 0) {
      setScrollEdges({ left: false, right: false });
      return;
    }

    const updateEdges = () => {
      const remaining = list.scrollWidth - list.clientWidth - list.scrollLeft;
      setScrollEdges({ left: list.scrollLeft > 1, right: remaining > 1 });
    };

    updateEdges();
    list.addEventListener('scroll', updateEdges, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges);
    observer?.observe(list);
    for (const tab of list.children) {
      observer?.observe(tab);
    }

    return () => {
      list.removeEventListener('scroll', updateEdges);
      observer?.disconnect();
    };
  }, [memberCount]);

  useEffect(() => {
    const list = listRef.current;
    const activeTab = list?.querySelector<HTMLButtonElement>(`[data-tab-id="${activeId}"]`);
    if (!list || !activeTab) {
      return;
    }

    const listBounds = list.getBoundingClientRect();
    const tabBounds = activeTab.getBoundingClientRect();
    if (tabBounds.left < listBounds.left || tabBounds.right > listBounds.right) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeId]);

  /**
   * Roving tabindex: one stop for the whole tablist, arrows move between tabs.
   * This is the part the portfolio's tabs are missing.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }

    event.preventDefault();
    const index = members.findIndex((member) => member.id === activeId);

    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % members.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + members.length) % members.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else {
      nextIndex = members.length - 1;
    }

    const next = members[nextIndex];
    if (!next) {
      return;
    }

    onSelect(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)?.focus();
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.tabViewport}
        data-scroll-left={scrollEdges.left || undefined}
        data-scroll-right={scrollEdges.right || undefined}
      >
        <div className={styles.tabs} ref={listRef} role="tablist" aria-label="People">
          {members.map((member) => {
            const selected = member.id === activeId;

            return (
              <button
                type="button"
                key={member.id}
                data-tab-id={member.id}
                id={`tab-${member.id}`}
                className={styles.tab}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(member.id)}
                onKeyDown={handleKeyDown}
                style={{ '--member-accent': accentHex[member.accent] } as CSSProperties}
              >
                <MemberAvatar member={member} />
                {member.name}
              </button>
            );
          })}
        </div>
      </div>

      {/*
       * Desktop only: the badge labels these tabs, so it sits with them rather
       * than in the page header. On a phone there is no room beside a scrolling
       * tab strip, so Home shows it on the date row instead — see .groupSlot.
       */}
      <div className={styles.groupSlot}>
        <GroupBadge
          groupName={activeGroupName}
          imagePath={activeGroupImage}
          pendingCount={pendingGroupCount}
        />
      </div>

      <button
        type="button"
        className={styles.add}
        onClick={onAdd}
        aria-expanded={addOpen}
        aria-label={addOpen ? 'Cancel adding a person' : 'Add a person'}
      >
        {addOpen ? <CrossIcon /> : <PlusIcon />}
      </button>
    </div>
  );
};
