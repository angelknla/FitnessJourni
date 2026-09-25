'use client';

import { CrossIcon, PlusIcon } from '@components/Icons/Icons';
import { accentHex } from '@data/fitnessData';
import { type CSSProperties, type KeyboardEvent, useRef } from 'react';
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
}

export const MemberTabs = ({
  members,
  activeId,
  onSelect,
  onAdd,
  addOpen,
  panelId,
}: MemberTabsProps) => {
  const listRef = useRef<HTMLDivElement>(null);

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
              <span className={styles.dot} aria-hidden="true" />
              {member.name}
            </button>
          );
        })}
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
