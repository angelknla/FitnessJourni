'use client';

import { AddMemberForm } from '@components/AddMemberForm/AddMemberForm';
import { CompareStrip } from '@components/CompareStrip/CompareStrip';
import { MacroBars } from '@components/MacroBars/MacroBars';
import { MemberTabs } from '@components/MemberTabs/MemberTabs';
import { ProgressRing } from '@components/ProgressRing/ProgressRing';
import { QuickEntry } from '@components/QuickEntry/QuickEntry';
import { accentHex } from '@data/fitnessData';
import { type CSSProperties, useState } from 'react';
import { emptyLog } from '@/lib/data/logs';
import { formatCount, formatMl } from '@/lib/progress';
import type { DailyLog, Member } from '@/types/fitness';

import styles from './Today.module.css';

interface TodayProps {
  members: Member[];
  logs: Record<string, DailyLog>;
  date: string;
  dateLabel: string;
}

const PANEL_ID = 'member-panel';

export const Today = ({ members, logs, date, dateLabel }: TodayProps) => {
  const [activeId, setActiveId] = useState(members[0]?.id ?? '');
  const [addOpen, setAddOpen] = useState(false);

  // A deleted or renamed member shouldn't leave the panel pointing at nothing.
  const active = members.find((member) => member.id === activeId) ?? members[0];

  if (!active) {
    return (
      <section className={styles.empty}>
        <h2 className={styles.emptyTitle}>No one here yet</h2>
        <p className={styles.emptyBody}>
          Run <code>supabase/schema.sql</code> to add Dillon, Angel and Bradley, or add someone
          below.
        </p>
        <AddMemberForm members={members} />
      </section>
    );
  }

  const log = logs[active.id] ?? emptyLog(active.id, date);
  const { targets } = active;

  return (
    <div className={styles.today}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Today</p>
        <h1 className={styles.date}>{dateLabel}</h1>
      </header>

      <MemberTabs
        members={members}
        activeId={active.id}
        onSelect={setActiveId}
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
          <h2 className={styles.sectionHeading}>Macros</h2>
          <MacroBars
            rows={[
              { label: 'Protein', value: log.proteinG, target: targets.protein },
              { label: 'Carbs', value: log.carbsG, target: targets.carbs },
              { label: 'Fat', value: log.fatG, target: targets.fat },
            ]}
          />
        </div>

        <QuickEntry member={active} log={log} date={date} />
      </section>

      <CompareStrip members={members} logs={logs} activeMemberId={active.id} />
    </div>
  );
};
