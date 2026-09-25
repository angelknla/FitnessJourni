'use client';

import { AddMemberForm } from '@components/AddMemberForm/AddMemberForm';
import { CompareStrip } from '@components/CompareStrip/CompareStrip';
import { EditTargets } from '@components/EditTargets/EditTargets';
import { PencilIcon } from '@components/Icons/Icons';
import { MacroBars } from '@components/MacroBars/MacroBars';
import { MemberTabs } from '@components/MemberTabs/MemberTabs';
import { ProgressRing } from '@components/ProgressRing/ProgressRing';
import { QuickEntry } from '@components/QuickEntry/QuickEntry';
import { WorkoutLogger } from '@components/WorkoutLogger/WorkoutLogger';
import { accentHex } from '@data/fitnessData';
import Link from 'next/link';
import { type CSSProperties, type TouchEvent, useRef, useState } from 'react';
import { emptyLog } from '@/lib/data/logs';
import { workoutsForToday } from '@/lib/data/workouts';
import { formatCount, formatMl } from '@/lib/progress';
import type { DailyLog, Member, Workout, WorkoutTally } from '@/types/fitness';

import styles from './Home.module.css';

interface HomeProps {
  members: Member[];
  logs: Record<string, DailyLog>;
  workouts: Workout[];
  tallies: Record<string, WorkoutTally>;
  date: string;
  dateLabel: string;
  /** Who this browser is acting as; null for a visitor, who edits nothing. */
  viewerId: string | null;
}

const PANEL_ID = 'member-panel';
const TARGETS_ID = 'macro-targets';

export const Home = ({
  members,
  logs,
  workouts,
  tallies,
  date,
  dateLabel,
  viewerId,
}: HomeProps) => {
  /*
   * Open on whoever is signed in, rather than on whoever sorts first — landing on
   * someone else's day was how the wrong numbers got edited. A visitor has nobody
   * to open on, so they still start at the first person.
   */
  const [activeId, setActiveId] = useState(viewerId ?? members[0]?.id ?? '');
  const [knownViewer, setKnownViewer] = useState(viewerId);

  /*
   * Signing in sets the cookie and calls router.refresh(), which re-renders the
   * server tree but does NOT remount this component — so the initialiser above
   * has already run, with the viewer still null, and the tab would sit on the
   * first person until a hard reload. Following the change explicitly is what
   * makes a fresh login land on your own tab.
   *
   * Adjusted during render rather than in an effect so the old tab is never
   * painted first, and guarded by the last id seen so it only moves when the
   * identity actually changes — not on every revalidate after a save, which
   * would yank you off a tab you had deliberately switched to.
   */
  if (viewerId !== knownViewer) {
    setKnownViewer(viewerId);

    if (viewerId) {
      setActiveId(viewerId);
    }
  }
  const [addOpen, setAddOpen] = useState(false);
  const [editingTargets, setEditingTargets] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // A deleted or renamed member shouldn't leave the panel pointing at nothing.
  const active = members.find((member) => member.id === activeId) ?? members[0];

  /*
   * You lead the strip, everyone else keeps their usual order behind you. Only the
   * tabs are reordered, not `members` itself: the compare strip reads as a fixed
   * lineup, and AddMemberForm derives the next sort_order from this list.
   *
   * MemberTabs works out arrow-key neighbours from the list it is given, so
   * reordering here keeps keyboard order matching what is on screen.
   */
  const you = viewerId ? members.find((member) => member.id === viewerId) : undefined;
  const tabOrder = you ? [you, ...members.filter((member) => member.id !== you.id)] : members;

  const selectMember = (id: string) => {
    setActiveId(id);
    setEditingTargets(false);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('button, input, select, textarea')) {
      touchStart.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;

    if (!start || !touch || tabOrder.length < 2) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    const index = tabOrder.findIndex((member) => member.id === active.id);
    const offset = deltaX < 0 ? 1 : -1;
    const next = tabOrder[(index + offset + tabOrder.length) % tabOrder.length];
    if (next) {
      selectMember(next.id);
    }
  };

  if (!active) {
    return (
      <section className={styles.empty}>
        <h2 className={styles.emptyTitle}>No one here yet</h2>
        <p className={styles.emptyBody}>
          Run <code>supabase/schema.sql</code> to add the starting members, or add someone below.
        </p>
        <AddMemberForm members={members} viewerId={viewerId} />
      </section>
    );
  }

  /*
   * Presentation only. The same decision is remade server-side in the actions,
   * because a hidden memberId can be edited by hand — see refuseUnlessOwn there.
   */
  const canEdit = active.id === viewerId;

  const log = logs[active.id] ?? emptyLog(active.id, date);
  const { targets } = active;
  const todaysWorkouts = workoutsForToday(workouts, active.id, date);
  const tally = tallies[active.id] ?? { today: 0, week: 0, month: 0 };

  return (
    <div className={styles.home}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Today</p>
        <h1 className={styles.date}>{dateLabel}</h1>
      </header>

      <MemberTabs
        members={tabOrder}
        activeId={active.id}
        onSelect={selectMember}
        onAdd={() => setAddOpen((open) => !open)}
        addOpen={addOpen}
        panelId={PANEL_ID}
      />

      {addOpen && <AddMemberForm members={members} viewerId={viewerId} />}

      <div
        className={styles.panels}
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`tab-${active.id}`}
        tabIndex={-1}
        style={{ '--member-accent': accentHex[active.accent] } as CSSProperties}
      >
        <section
          className={`${styles.panel} ${styles.swipePanel}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchStart.current = null;
          }}
        >
          <div className={styles.rings}>
            <ProgressRing
              label="Steps"
              display={formatCount(log.steps)}
              targetDisplay={formatCount(targets.steps)}
              value={log.steps}
              target={targets.steps}
              floor={targets.stepsMin}
            />
            <ProgressRing
              label="Water"
              display={formatMl(log.waterMl)}
              targetDisplay={formatMl(targets.waterMl)}
              value={log.waterMl}
              target={targets.waterMl}
            />
            <ProgressRing
              label="Calories"
              display={formatCount(log.calories)}
              targetDisplay={formatCount(targets.calories)}
              value={log.calories}
              target={targets.calories}
              overIsBad
            />
          </div>

          <p className={styles.floorNote}>
            The tick on Steps marks {formatCount(targets.stepsMin)} — the minimum, inside the{' '}
            {formatCount(targets.steps)} goal.
          </p>

          <div className={styles.macros}>
            <div className={styles.macrosHead}>
              <h2 className={styles.sectionHeading}>Macros</h2>
              {canEdit && (
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setEditingTargets((open) => !open)}
                  aria-expanded={editingTargets}
                  aria-controls={TARGETS_ID}
                  aria-label={
                    editingTargets
                      ? 'Stop editing macro targets'
                      : `Edit ${active.name}'s macro targets`
                  }
                >
                  <PencilIcon />
                </button>
              )}
            </div>

            {editingTargets && canEdit && (
              <EditTargets
                member={active}
                id={TARGETS_ID}
                onSaved={() => setEditingTargets(false)}
              />
            )}

            <MacroBars
              rows={[
                { label: 'Protein', value: log.proteinG, target: targets.protein },
                { label: 'Carbs', value: log.carbsG, target: targets.carbs },
                { label: 'Fat', value: log.fatG, target: targets.fat },
              ]}
            />
          </div>

          {canEdit ? (
            <QuickEntry member={active} log={log} date={date} />
          ) : !viewerId ? (
            <p className={styles.readOnly}>
              You&apos;re looking around as a visitor. Pick yourself in the header to log a day.
            </p>
          ) : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.workoutsHead}>
            <h2 className={styles.sectionHeading}>Workouts</h2>
            <Link href="/workouts" className={styles.planLink}>
              See the split
            </Link>
          </div>
          <WorkoutLogger
            member={active}
            date={date}
            logged={todaysWorkouts}
            weekCount={tally.week}
            canEdit={canEdit}
          />
        </section>
      </div>

      <CompareStrip members={tabOrder} logs={logs} activeMemberId={active.id} />
    </div>
  );
};
