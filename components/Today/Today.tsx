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
import { type CSSProperties, useState } from 'react';
import { emptyLog } from '@/lib/data/logs';
import { workoutsForToday } from '@/lib/data/workouts';
import { formatCount, formatMl } from '@/lib/progress';
import type { DailyLog, Member, Workout, WorkoutTally } from '@/types/fitness';

import styles from './Today.module.css';

interface TodayProps {
  members: Member[];
  logs: Record<string, DailyLog>;
  workouts: Workout[];
  tallies: Record<string, WorkoutTally>;
  date: string;
  dateLabel: string;
}

const PANEL_ID = 'member-panel';
const TARGETS_ID = 'macro-targets';

export const Today = ({ members, logs, workouts, tallies, date, dateLabel }: TodayProps) => {
  const [activeId, setActiveId] = useState(members[0]?.id ?? '');
  const [addOpen, setAddOpen] = useState(false);
  const [editingTargets, setEditingTargets] = useState(false);

  // A deleted or renamed member shouldn't leave the panel pointing at nothing.
  const active = members.find((member) => member.id === activeId) ?? members[0];

  if (!active) {
    return (
      <section className={styles.empty}>
        <h2 className={styles.emptyTitle}>No one here yet</h2>
        <p className={styles.emptyBody}>
          Run <code>supabase/schema.sql</code> to add the starting members, or add someone below.
        </p>
        <AddMemberForm members={members} />
      </section>
    );
  }

  const log = logs[active.id] ?? emptyLog(active.id, date);
  const { targets } = active;
  const todaysWorkouts = workoutsForToday(workouts, active.id, date);
  const tally = tallies[active.id] ?? { today: 0, week: 0, month: 0 };

  return (
    <div className={styles.today}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Today</p>
        <h1 className={styles.date}>{dateLabel}</h1>
      </header>

      <MemberTabs
        members={members}
        activeId={active.id}
        onSelect={(id) => {
          setActiveId(id);
          setEditingTargets(false);
        }}
        onAdd={() => setAddOpen((open) => !open)}
        addOpen={addOpen}
        panelId={PANEL_ID}
      />

      {addOpen && <AddMemberForm members={members} />}

      <section
        className={styles.panel}
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`tab-${active.id}`}
        tabIndex={-1}
        style={{ '--member-accent': accentHex[active.accent] } as CSSProperties}
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
          </div>

          {editingTargets && (
            <EditTargets member={active} id={TARGETS_ID} onSaved={() => setEditingTargets(false)} />
          )}

          <MacroBars
            rows={[
              { label: 'Protein', value: log.proteinG, target: targets.protein },
              { label: 'Carbs', value: log.carbsG, target: targets.carbs },
              { label: 'Fat', value: log.fatG, target: targets.fat },
            ]}
          />
        </div>

        <QuickEntry member={active} log={log} date={date} />

        <div className={styles.workouts}>
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
          />
        </div>
      </section>

      <CompareStrip members={members} logs={logs} activeMemberId={active.id} />
    </div>
  );
};
