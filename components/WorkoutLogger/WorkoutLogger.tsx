'use client';

import ui from '@/styles/ui.module.css';

import { BinIcon, CrossIcon, PlusIcon } from '@components/Icons/Icons';
import { workoutFocuses, workoutFocusLabels } from '@data/fitnessData';
import { useBackgroundSave, type SaveAction } from '@hooks/useBackgroundSave';
import { useActionState, useState } from 'react';
import { type ActionState, deleteWorkout, logWorkout } from '@/app/actions';
import type { Member, Workout, WorkoutFocus } from '@/types/fitness';

import styles from './WorkoutLogger.module.css';

interface WorkoutLoggerProps {
  member: Member;
  date: string;
  /** Today's workouts for this member, already filtered. */
  logged: Workout[];
  weekCount: number;
  /** False on someone else's tab, or for a visitor: the list stays, the form goes. */
  canEdit: boolean;
  isToday?: boolean;
  save?: SaveAction;
  remove?: (workout: Workout) => void;
}

const initial: ActionState = { ok: false };

const describe = (workout: Workout) =>
  workout.focuses.map((focus) => workoutFocusLabels[focus]).join(' + ');

const LoggedWorkout = ({
  workout,
  canEdit,
  remove,
}: {
  workout: Workout;
  canEdit: boolean;
  remove?: (workout: Workout) => void;
}) => {
  const [state, formAction, isPending] = useActionState(deleteWorkout, initial);

  return (
    <li className={styles.logged}>
      <span className={styles.loggedBody}>
        <span className={styles.loggedLabel}>{describe(workout)}</span>
        {workout.note && <span className={styles.loggedNote}>{workout.note}</span>}
        {state.error && (
          <span className={styles.error} role="alert">
            {state.error}
          </span>
        )}
      </span>

      {canEdit && (
        <form
          action={formAction}
          onSubmit={
            remove
              ? (event) => {
                  event.preventDefault();
                  remove(workout);
                }
              : undefined
          }
        >
          <input type="hidden" name="id" value={workout.id} />
          <button
            type="submit"
            className={styles.remove}
            disabled={isPending || workout.id.startsWith('optimistic:')}
            aria-label={`Remove ${describe(workout)} workout`}
          >
            <BinIcon size={12} />
          </button>
        </form>
      )}
    </li>
  );
};

export const WorkoutLogger = ({
  member,
  date,
  logged,
  weekCount,
  canEdit,
  isToday = true,
  save,
  remove,
}: WorkoutLoggerProps) => {
  const [picked, setPicked] = useState<WorkoutFocus[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [note, setNote] = useState('');
  const {
    state,
    pending: isPending,
    submit,
  } = useBackgroundSave(
    save ?? ((data) => logWorkout(initial, data)),
    () => setFormOpen(false),
    () => setFormOpen(true)
  );

  const target = member.targets.workoutsPerWeek;
  const trainedToday = logged.length > 0;
  const formTitle = trainedToday ? 'Log another session' : 'What did you train?';
  const formId = `workout-log-${member.id}`;

  const toggle = (focus: WorkoutFocus) =>
    setPicked((current) =>
      current.includes(focus) ? current.filter((item) => item !== focus) : [...current, focus]
    );

  return (
    <div className={styles.wrapper}>
      <div className={styles.status}>
        <span className={styles.badge} data-done={trainedToday}>
          {trainedToday
            ? isToday
              ? 'Trained today'
              : 'Trained on this day'
            : isToday
              ? 'Not logged today'
              : 'Not logged on this day'}
        </span>
        {/* Past the target, "6 of 4" would read as broken. The playbook's 4 is a
            recommendation, not a cap, so the phrasing changes rather than the
            number being clamped. */}
        <span className={styles.weekCount} data-met={weekCount >= target}>
          {weekCount >= target
            ? `${weekCount} this week · ${target} recommended`
            : `${weekCount} of ${target} this week`}
        </span>
      </div>

      {logged.length > 0 && (
        <ul className={styles.loggedList}>
          {logged.map((workout) => (
            <LoggedWorkout workout={workout} canEdit={canEdit} remove={remove} key={workout.id} />
          ))}
        </ul>
      )}

      {canEdit && (
        <div className={styles.disclosure}>
          <button
            type="button"
            className={`${styles.toggle} ${ui.disclosure}`}
            aria-expanded={formOpen}
            aria-controls={formId}
            disabled={isPending}
            onClick={() => {
              if (!formOpen && !state.error) {
                setPicked([]);
                setNote('');
              }
              setFormOpen((current) => !current);
            }}
          >
            <span>{formTitle}</span>
            {formOpen ? <CrossIcon /> : <PlusIcon />}
          </button>

          {formOpen && (
            <form className={styles.form} onSubmit={submit} id={formId}>
              <input type="hidden" name="memberId" value={member.id} />
              <input type="hidden" name="date" value={date} />

              <fieldset className={styles.fieldset}>
                <legend className={styles.hint}>Pick as many as apply</legend>

                <div className={styles.chips}>
                  {workoutFocuses.map((option) => (
                    <label className={styles.chip} key={option}>
                      <input
                        className={styles.control}
                        type="checkbox"
                        name="focus"
                        value={option}
                        checked={picked.includes(option)}
                        onChange={() => toggle(option)}
                      />
                      <span className={styles.chipInner}>{workoutFocusLabels[option]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className={styles.noteField}>
                <span className={styles.noteLabel}>Note (optional)</span>
                <input
                  type="text"
                  name="note"
                  maxLength={200}
                  placeholder="Felt strong on bench"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={`${styles.submit} ${ui.primaryButton}`}
                  disabled={isPending || picked.length === 0}
                >
                  {isPending ? 'Logging…' : 'Log workout'}
                </button>

                {picked.length > 0 && (
                  <span className={styles.picked}>{picked.length} selected</span>
                )}

                {state.error && (
                  <p className={styles.error} role="alert">
                    {state.error}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
