'use client';

import ui from '@/styles/ui.module.css';

import { AddMemberForm } from '@components/AddMemberForm/AddMemberForm';
import { CompareStrip } from '@components/CompareStrip/CompareStrip';
import { EditTargets } from '@components/EditTargets/EditTargets';
import { GroupBadge } from '@components/GroupBadge/GroupBadge';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CrossIcon,
  DumbbellIcon,
  PencilIcon,
} from '@components/Icons/Icons';
import { MomentumBanner } from '@components/MomentumBanner/MomentumBanner';
import { MacroBars } from '@components/MacroBars/MacroBars';
import { MedalLeaderboard } from '@components/MedalLeaderboard/MedalLeaderboard';
import { MemberTabs } from '@components/MemberTabs/MemberTabs';
import { PersonalModeNotice } from '@components/PersonalModeNotice/PersonalModeNotice';
import { ProgressRing } from '@components/ProgressRing/ProgressRing';
import { QuickEntry } from '@components/QuickEntry/QuickEntry';
import { SleepLogger } from '@components/SleepLogger/SleepLogger';
import { WorkoutLogger } from '@components/WorkoutLogger/WorkoutLogger';
import { accentHex } from '@data/fitnessData';
import { useStepCaloriesPreference } from '@hooks/useStepCaloriesPreference';
import type { SaveAction } from '@hooks/useBackgroundSave';
import { fromISODate, toISODate } from '@utils/date';
import Link from '@components/NavigationLink/NavigationLink';
import { useRouter } from 'next/navigation';
import {
  type CSSProperties,
  type TouchEvent,
  type TransitionEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { emptyLog } from '@/lib/data/logs';
import { tallyWorkouts, workoutsForToday } from '@/lib/data/workouts';
import { buildMedalBoards, type MedalBoard } from '@/lib/medals';
import { deleteWorkout, logWorkout, saveDailyLog, saveSleep, updateTargets } from '@/app/actions';
import { caloriesBurnedFromSteps, formatCount, formatMl } from '@/lib/progress';
import type {
  DailyLog,
  Member,
  MemberTargets,
  Workout,
  WorkoutFocus,
  WorkoutTally,
} from '@/types/fitness';
import { useHomeUpdates } from './useHomeUpdates';

import styles from './Home.module.css';

interface HomeProps {
  members: Member[];
  logs: Record<string, DailyLog>;
  workouts: Workout[];
  tallies: Record<string, WorkoutTally>;
  medalBoards?: MedalBoard[];
  medalLogs?: DailyLog[];
  medalDate?: string;
  date: string;
  today: string;
  datePickerLabel: string;
  dateLabel: string;
  /** Who this browser is acting as; null for a visitor, who edits nothing. */
  viewerId: string | null;
  /**
   * True when the viewer belongs to no group. Their own rings and quick entry
   * still work; the parts that compare people have nobody to compare with.
   */
  personalMode?: boolean;
  /** The active group's name, or null in Personal mode. */
  activeGroupName?: string | null;
  activeGroupId?: string | null;
  /** The active group's picture, if it has one. */
  activeGroupImage?: string | null;
  /** Group invitations and join requests waiting on this person. */
  pendingGroupCount?: number;
}

const PANEL_ID = 'member-panel';
const TARGETS_ID = 'macro-targets';
const SLEEP_TARGET_ID = 'sleep-target';
type SwipePhase = 'idle' | 'dragging' | 'exiting' | 'positioning' | 'resetting';

const adjacentDate = (date: string, offset: number) => {
  const adjacent = fromISODate(date);
  adjacent.setDate(adjacent.getDate() + offset);
  return toISODate(adjacent);
};

interface MemberSummaryProps {
  member: Member;
  log: DailyLog;
  date: string;
  viewerId: string | null;
  editingTargets: boolean;
  includeStepCalories: boolean;
  preview?: boolean;
  onToggleTargets: () => void;
  onTargetsSaved: () => void;
  saveLog?: SaveAction;
  saveTargets?: SaveAction;
}

const MemberSummary = ({
  member,
  log,
  date,
  viewerId,
  editingTargets,
  includeStepCalories,
  preview = false,
  onToggleTargets,
  onTargetsSaved,
  saveLog,
  saveTargets,
}: MemberSummaryProps) => {
  const { targets } = member;
  const caloriesBurned = caloriesBurnedFromSteps(log.steps);
  const adjustedCalorieTarget = targets.calories + (includeStepCalories ? caloriesBurned : 0);
  const canEdit = !preview && member.id === viewerId;

  return (
    <section
      className={`${styles.panel} ${ui.card}`}
      aria-hidden={preview || undefined}
      inert={preview || undefined}
      style={{ '--member-accent': accentHex[member.accent] } as CSSProperties}
    >
      <header className={styles.summaryHeader}>
        <h2 className={styles.summaryTitle}>Daily progress</h2>
        {canEdit && (
          <Link href="/profile#log-weight" className={`${styles.momentumLink} ${styles.weightCta}`}>
            <span>Log your weight</span>
            <ChevronRightIcon size={14} />
          </Link>
        )}
      </header>
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
          targetAdjustmentDisplay={includeStepCalories ? formatCount(caloriesBurned) : undefined}
          value={log.calories}
          target={adjustedCalorieTarget}
          overIsBad
        />
      </div>

      <div className={styles.macros}>
        <p className={styles.caloriesBurned}>
          <strong>{formatCount(caloriesBurned)} kcal</strong> burned from steps
        </p>
        <div className={styles.macrosHead}>
          <h2 className={ui.sectionTitle}>Macros</h2>
          {canEdit && (
            <button
              type="button"
              className={styles.editButton}
              onClick={onToggleTargets}
              aria-expanded={editingTargets}
              aria-controls={TARGETS_ID}
              aria-label={
                editingTargets
                  ? 'Stop editing macro targets'
                  : `Edit ${member.name}'s macro targets`
              }
            >
              {editingTargets ? <CrossIcon /> : <PencilIcon />}
            </button>
          )}
        </div>

        {editingTargets && canEdit && (
          <EditTargets
            member={member}
            id={TARGETS_ID}
            onSaved={onTargetsSaved}
            save={saveTargets}
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
        <QuickEntry
          key={`${member.id}-${date}`}
          member={member}
          log={log}
          date={date}
          save={saveLog}
        />
      ) : !viewerId && !preview ? (
        <p className={styles.readOnly}>
          You&apos;re looking around as a visitor. Pick yourself in the header to log a day.
        </p>
      ) : null}
    </section>
  );
};

export const Home = ({
  members: serverMembers,
  logs: serverLogs,
  workouts: serverWorkouts,
  tallies: serverTallies,
  medalBoards = [],
  medalLogs,
  date,
  medalDate = date,
  today,
  datePickerLabel,
  dateLabel,
  viewerId,
  personalMode = false,
  activeGroupName = null,
  activeGroupId = null,
  activeGroupImage = null,
  pendingGroupCount = 0,
}: HomeProps) => {
  const updates = useHomeUpdates(
    {
      members: serverMembers,
      logs: serverLogs,
      workouts: serverWorkouts,
      medalLogs: medalLogs ?? Object.values(serverLogs),
    },
    `${viewerId}:${activeGroupId ?? activeGroupName}:${date}`
  );
  const { members, logs, workouts } = updates.data;
  const tallies = updates.statuses.some(
    (entry) =>
      !entry.error &&
      (entry.request.change.type === 'addWorkout' || entry.request.change.type === 'deleteWorkout')
  )
    ? tallyWorkouts(workouts, date)
    : serverTallies;
  const boards = medalLogs
    ? buildMedalBoards(
        updates.data.medalLogs,
        workouts,
        medalDate,
        Object.fromEntries(members.map((member) => [member.id, member.targets])),
        today
      )
    : medalBoards;
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(date);
  const [knownDate, setKnownDate] = useState(date);
  const dateInput = useRef<HTMLInputElement>(null);

  if (date !== knownDate) {
    setKnownDate(date);
    setSelectedDate(date);
  }

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
  const [editingSleepTarget, setEditingSleepTarget] = useState(false);
  const saveLog: SaveAction = (data) =>
    updates.save({
      key: `daily:${activeId}`,
      label: 'Daily numbers',
      data,
      change: {
        type: 'log',
        memberId: activeId,
        date,
        patch: Object.fromEntries(
          ['steps', 'waterMl', 'calories', 'proteinG', 'carbsG', 'fatG'].map((field) => [
            field,
            Math.round(Number(data.get(field)) || 0),
          ])
        ),
      },
      save: (form) => saveDailyLog({ ok: false }, form),
    });
  const saveSleepHours: SaveAction = (data) =>
    updates.save({
      key: `sleep:${activeId}`,
      label: 'Sleep',
      data,
      change: {
        type: 'log',
        memberId: activeId,
        date,
        patch: { sleepHours: Math.round(Number(data.get('sleepHours')) * 10) / 10 },
      },
      save: (form) => saveSleep({ ok: false }, form),
    });
  const saveTargets: SaveAction = (data) => {
    setEditingTargets(false);
    setEditingSleepTarget(false);
    return updates.save({
      key: `targets:${activeId}`,
      label: 'Targets',
      data,
      change: {
        type: 'targets',
        memberId: activeId,
        patch: Object.fromEntries(
          [...data.entries()]
            .filter(([field]) => field !== 'memberId')
            .map(([field, value]) => [
              field,
              field === 'sleepHours' ? Number(value) : Math.round(Number(value)),
            ])
        ) as Partial<MemberTargets>,
      },
      save: (form) => updateTargets({ ok: false }, form),
    });
  };
  const saveWorkout: SaveAction = (data) =>
    updates.save({
      key: `workout:${activeId}`,
      label: 'Workout',
      data,
      change: {
        type: 'addWorkout',
        existingIds: workouts.map((workout) => workout.id),
        workout: {
          id: `optimistic:${crypto.randomUUID()}`,
          memberId: activeId,
          date,
          focuses: data.getAll('focus') as WorkoutFocus[],
          note: String(data.get('note') ?? '').trim() || null,
        },
      },
      save: (form) => logWorkout({ ok: false }, form),
    });
  const removeWorkout = (workout: Workout) => {
    const data = new FormData();
    data.set('id', workout.id);
    void updates.save({
      key: `delete:${workout.id}`,
      label: 'Workout removal',
      data,
      change: { type: 'deleteWorkout', id: workout.id },
      save: (form) => deleteWorkout({ ok: false }, form),
    });
  };
  const [includeStepCalories] = useStepCaloriesPreference();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const pendingMemberId = useRef<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipePhase, setSwipePhase] = useState<SwipePhase>('idle');

  useEffect(() => {
    if (swipePhase !== 'positioning') {
      return;
    }

    const frame = requestAnimationFrame(() => setSwipePhase('idle'));
    return () => cancelAnimationFrame(frame);
  }, [swipePhase]);

  const openDatePicker = () => {
    const input = dateInput.current;
    if (!input) {
      return;
    }

    try {
      input.showPicker();
    } catch {
      input.click();
    }
  };

  const navigateToDate = (nextDate: string) => {
    if (nextDate > today) {
      return;
    }

    setSelectedDate(nextDate);
    router.push(nextDate === today ? '/' : `/?date=${nextDate}`);
  };

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
    pendingMemberId.current = null;
    setSwipeOffset(0);
    setSwipePhase('idle');
    setActiveId(id);
    setEditingTargets(false);
    setEditingSleepTarget(false);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest('button, input, select, textarea')
    ) {
      touchStart.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    if (touch) {
      setSwipePhase('dragging');
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const touch = event.touches[0];
    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    setSwipeOffset(deltaX);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const touch = event.changedTouches[0];
    touchStart.current = null;

    if (!start || !touch || tabOrder.length < 2) {
      setSwipeOffset(0);
      setSwipePhase('resetting');
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      setSwipeOffset(0);
      setSwipePhase('resetting');
      return;
    }

    const index = tabOrder.findIndex((member) => member.id === active.id);
    const offset = deltaX < 0 ? 1 : -1;
    const next = tabOrder[(index + offset + tabOrder.length) % tabOrder.length];
    if (next) {
      const direction = deltaX < 0 ? -1 : 1;
      const slide = carouselRef.current?.querySelector<HTMLElement>('[data-carousel-slide]');
      const width = slide?.clientWidth || carouselRef.current?.clientWidth || window.innerWidth;
      pendingMemberId.current = next.id;
      setSwipePhase('exiting');
      setSwipeOffset(direction * (width + 10));
    }
  };

  const handleSwipeTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (swipePhase === 'exiting') {
      const nextId = pendingMemberId.current;
      if (!nextId) {
        setSwipePhase('idle');
        setSwipeOffset(0);
        return;
      }

      pendingMemberId.current = null;
      setActiveId(nextId);
      setEditingTargets(false);
      setEditingSleepTarget(false);
      setSwipePhase('positioning');
      setSwipeOffset(0);
      return;
    }

    if (swipePhase === 'resetting') {
      setSwipePhase('idle');
    }
  };

  if (!active) {
    return (
      <section className={styles.empty}>
        <h2 className={styles.emptyTitle}>No one here yet</h2>
        <p className={styles.emptyBody}>
          Run <code>supabase/schema.sql</code> to add the starting members, or add someone below.
        </p>
        <AddMemberForm viewerId={viewerId} />
      </section>
    );
  }

  /*
   * Presentation only. The same decision is remade server-side in the actions,
   * because a hidden memberId can be edited by hand — see refuseUnlessOwn there.
   */
  const canEdit = active.id === viewerId;
  const isToday = date === today;

  const log = logs[active.id] ?? emptyLog(active.id, date);
  const todaysWorkouts = workoutsForToday(workouts, active.id, date);
  const tally = tallies[active.id] ?? { today: 0, week: 0, month: 0 };
  const activeIndex = tabOrder.findIndex((member) => member.id === active.id);
  const previousMember = tabOrder[(activeIndex - 1 + tabOrder.length) % tabOrder.length] ?? active;
  const nextMember = tabOrder[(activeIndex + 1) % tabOrder.length] ?? active;

  return (
    <div className={styles.home}>
      <header className={styles.head}>
        <div className={styles.topRow}>
          <div className={styles.dateNavigation}>
            <button
              type="button"
              className={styles.dateStep}
              aria-label="Previous day"
              onClick={() => navigateToDate(adjacentDate(selectedDate, -1))}
            >
              <ChevronLeftIcon />
            </button>
            <div className={styles.dateControl}>
              <button
                type="button"
                className={styles.datePicker}
                aria-label={`Choose dashboard date, ${datePickerLabel}`}
                onClick={openDatePicker}
              >
                <CalendarIcon size={14} />
                <span>{datePickerLabel}</span>
              </button>
              <input
                ref={dateInput}
                className={styles.dateInput}
                type="date"
                value={selectedDate}
                max={today}
                aria-label="Dashboard date value"
                tabIndex={-1}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  if (nextDate) {
                    navigateToDate(nextDate);
                  }
                }}
              />
            </div>
            {!isToday && (
              <button
                type="button"
                className={styles.dateStep}
                aria-label="Next day"
                onClick={() => navigateToDate(adjacentDate(selectedDate, 1))}
              >
                <ChevronRightIcon />
              </button>
            )}
          </div>

          {/* Phone only; on desktop the same badge sits with the member tabs. */}
          <div className={styles.badgeSlot}>
            <GroupBadge
              groupName={activeGroupName}
              imagePath={activeGroupImage}
              pendingCount={pendingGroupCount}
            />
          </div>
        </div>
        <h1 className={styles.date}>{dateLabel}</h1>
        <MomentumBanner
          heading="h2"
          eyebrow={isToday ? 'Your pace. Your progress.' : 'Every day adds up.'}
          title={isToday ? 'Build your momentum.' : 'See how far you’ve come.'}
          description="Small steps. Stronger days. Keep showing up for yourself."
          mobileDescription="Small steps. Stronger days."
          mobileSingleLine
          actions={
            <Link href="/workouts" className={styles.momentumLink}>
              <DumbbellIcon size={18} /> Find your next workout <ChevronRightIcon size={16} />
            </Link>
          }
        />
      </header>

      {updates.statuses.length > 0 && (
        <div className={styles.saveStatus}>
          {updates.statuses.map(({ request, error }) => (
            <p key={request.key} role={error ? 'alert' : 'status'}>
              {error ? `${request.label} wasn’t saved. ${error}` : `${request.label} saving…`}
              {error && (
                <button
                  type="button"
                  onClick={() => {
                    void updates.save(request);
                  }}
                >
                  Retry
                </button>
              )}
            </p>
          ))}
        </div>
      )}

      <MemberTabs
        members={tabOrder}
        activeId={active.id}
        onSelect={selectMember}
        onAdd={() => setAddOpen((open) => !open)}
        addOpen={addOpen}
        panelId={PANEL_ID}
        activeGroupName={activeGroupName}
        activeGroupImage={activeGroupImage}
        pendingGroupCount={pendingGroupCount}
      />

      {addOpen && <AddMemberForm viewerId={viewerId} />}

      <div
        className={styles.panels}
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`tab-${active.id}`}
        tabIndex={-1}
        style={{ '--member-accent': accentHex[active.accent] } as CSSProperties}
      >
        <div
          ref={carouselRef}
          className={styles.carousel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchStart.current = null;
            setSwipeOffset(0);
            setSwipePhase('resetting');
          }}
        >
          <div
            className={styles.carouselTrack}
            data-swipe-phase={swipePhase}
            style={{ '--swipe-offset': `${swipeOffset}px` } as CSSProperties}
            onTransitionEnd={handleSwipeTransitionEnd}
          >
            <div className={styles.carouselSlide} data-carousel-slide>
              <MemberSummary
                member={previousMember}
                log={logs[previousMember.id] ?? emptyLog(previousMember.id, date)}
                date={date}
                viewerId={viewerId}
                editingTargets={false}
                includeStepCalories={includeStepCalories}
                preview
                onToggleTargets={() => {}}
                onTargetsSaved={() => {}}
              />
            </div>
            <div className={styles.carouselSlide}>
              <MemberSummary
                member={active}
                log={log}
                date={date}
                viewerId={viewerId}
                editingTargets={editingTargets}
                includeStepCalories={includeStepCalories}
                onToggleTargets={() => {
                  setEditingSleepTarget(false);
                  setEditingTargets((open) => !open);
                }}
                onTargetsSaved={() => setEditingTargets(false)}
                saveLog={saveLog}
                saveTargets={saveTargets}
              />
            </div>
            <div className={styles.carouselSlide}>
              <MemberSummary
                member={nextMember}
                log={logs[nextMember.id] ?? emptyLog(nextMember.id, date)}
                date={date}
                viewerId={viewerId}
                editingTargets={false}
                includeStepCalories={includeStepCalories}
                preview
                onToggleTargets={() => {}}
                onTargetsSaved={() => {}}
              />
            </div>
          </div>
        </div>

        <section className={`${styles.panel} ${ui.card}`}>
          <div className={styles.workoutsHead}>
            <h2 className={ui.sectionTitle}>Workouts</h2>
            <Link href="/workouts" className={styles.planLink}>
              See the split
            </Link>
          </div>
          <WorkoutLogger
            key={`${active.id}-${date}`}
            member={active}
            date={date}
            logged={todaysWorkouts}
            weekCount={tally.week}
            canEdit={canEdit}
            isToday={isToday}
            save={saveWorkout}
            remove={removeWorkout}
          />
        </section>

        <section className={`${styles.panel} ${ui.card}`}>
          <div className={styles.workoutsHead}>
            <h2 className={ui.sectionTitle}>Sleep</h2>
            <div className={styles.sleepActions}>
              {canEdit && (
                <button
                  type="button"
                  className={styles.editButton}
                  aria-expanded={editingSleepTarget}
                  aria-controls={SLEEP_TARGET_ID}
                  aria-label={
                    editingSleepTarget
                      ? 'Stop editing sleep target'
                      : `Edit ${active.name}'s sleep target`
                  }
                  onClick={() => {
                    setEditingTargets(false);
                    setEditingSleepTarget((open) => !open);
                  }}
                >
                  {editingSleepTarget ? <CrossIcon /> : <PencilIcon />}
                </button>
              )}
              <Link href="/logs?period=week" className={styles.planLink}>
                See sleep logs
              </Link>
            </div>
          </div>
          {editingSleepTarget && canEdit && (
            <EditTargets
              member={active}
              id={SLEEP_TARGET_ID}
              section="sleep"
              onSaved={() => setEditingSleepTarget(false)}
              save={saveTargets}
            />
          )}
          <SleepLogger
            key={`${active.id}-${date}`}
            member={active}
            date={date}
            sleepHours={log.sleepHours}
            canEdit={canEdit}
            isToday={isToday}
            save={saveSleepHours}
          />
        </section>
      </div>

      {/* Medals and the comparison strip both rank people against each other, so
          both are replaced rather than shown empty when there is nobody to rank. */}
      {personalMode ? (
        <PersonalModeNotice
          title="Medals need a group"
          description="Your own numbers are all here. Medals and side-by-side comparisons start once you are in a group with other people."
        />
      ) : (
        <>
          <section className={`${styles.panel} ${ui.card} ${styles.medalPanel}`}>
            <MedalLeaderboard
              members={tabOrder}
              boards={boards}
              medalDate={medalDate}
              today={today}
            />
          </section>

          <CompareStrip
            members={tabOrder}
            logs={logs}
            activeMemberId={active.id}
            heading={isToday ? 'Everyone today' : 'Everyone on this day'}
          />
        </>
      )}
    </div>
  );
};
