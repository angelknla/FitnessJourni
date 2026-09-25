'use client';

import { activityLabels, activityTypes, bookingWindowDays, quickTimes } from '@data/fitnessData';
import { buildDays, toISODate } from '@utils/date';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { type ActionState, bookSession } from '@/app/actions';
import type { ActivityType, Member } from '@/types/fitness';

import styles from './SessionForm.module.css';

interface SessionFormProps {
  members: Member[];
}

const initial: ActionState = { ok: true };

export const SessionForm = ({ members }: SessionFormProps) => {
  const [state, formAction, isPending] = useActionState(bookSession, initial);

  /**
   * "Today" is resolved after mount, so the prerendered HTML can never disagree
   * with the browser's clock and trigger a hydration mismatch.
   */
  const [todayISO, setTodayISO] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityType>('run');
  const [dateISO, setDateISO] = useState('');
  const [time, setTime] = useState('07:00');

  useEffect(() => {
    const iso = toISODate(new Date());
    setTodayISO(iso);
    setDateISO((current) => current || iso);
  }, []);

  const days = useMemo(() => (todayISO ? buildDays(todayISO, bookingWindowDays) : []), [todayISO]);

  const formats = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }),
      month: new Intl.DateTimeFormat('en-GB', { month: 'short' }),
      full: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    }),
    []
  );

  const dayLabel = (offset: number, date: Date) => {
    if (offset === 0) {
      return 'Today';
    }
    if (offset === 1) {
      return 'Tomorrow';
    }
    return formats.weekday.format(date);
  };

  return (
    <form className={styles.form} action={formAction}>
      <input type="hidden" name="activity" value={activity} />
      <input type="hidden" name="date" value={dateISO} />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Activity</legend>
        <div className={styles.chips}>
          {activityTypes.map((option) => (
            <label className={styles.chip} key={option}>
              {/* Hidden but focusable radio: keyboard arrows and group semantics
                  come free from the browser, styling hangs off :checked. */}
              <input
                className={styles.control}
                type="radio"
                name="activityChoice"
                value={option}
                checked={activity === option}
                onChange={() => setActivity(option)}
              />
              <span className={styles.chipInner}>{activityLabels[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Day</legend>
        {days.length === 0 ? (
          <p className={styles.loading}>Loading days…</p>
        ) : (
          <div className={styles.rail}>
            {days.map((day) => (
              <label className={styles.dateCard} key={day.iso}>
                <input
                  className={styles.control}
                  type="radio"
                  name="dateChoice"
                  value={day.iso}
                  checked={dateISO === day.iso}
                  aria-label={formats.full.format(day.date)}
                  onChange={() => setDateISO(day.iso)}
                />
                <span className={styles.dateCardInner}>
                  <span className={styles.dateWeekday}>{dayLabel(day.offset, day.date)}</span>
                  <span className={styles.dateNumber}>{day.date.getDate()}</span>
                  <span className={styles.dateMonth}>{formats.month.format(day.date)}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className={styles.row}>
        <label className={styles.timeField}>
          <span className={styles.fieldLabel}>Time</span>
          <input
            type="time"
            name="time"
            value={time}
            required
            onChange={(event) => setTime(event.target.value)}
          />
        </label>

        <label className={styles.whoField}>
          <span className={styles.fieldLabel}>Booked by</span>
          <select name="createdBy" defaultValue="">
            <option value="">Anyone</option>
            {members.map((member) => (
              <option value={member.id} key={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.quick}>
        <span className={styles.fieldLabel}>Quick times</span>
        <div className={styles.chips}>
          {quickTimes.map((option) => (
            <button
              type="button"
              key={option}
              className={styles.quickChip}
              data-active={time === option}
              onClick={() => setTime(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.noteField}>
        <span className={styles.fieldLabel}>Note (optional)</span>
        <input type="text" name="note" maxLength={200} placeholder="Meet at the park gate" />
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isPending || !dateISO}>
          {isPending ? 'Booking…' : 'Book it'}
        </button>

        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
};
