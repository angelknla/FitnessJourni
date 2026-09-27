'use client';

import { activityLabels, activityTypes, bookingWindowDays, quickTimes } from '@data/fitnessData';
import { buildDays, minutesOfTime, toISODate } from '@utils/date';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { type ActionState, bookSession } from '@/app/actions';
import type { ActivityType, Member } from '@/types/fitness';

import styles from './SessionForm.module.css';

interface SessionFormProps {
  members: Member[];
  /** Preselects "booked by"; a visitor still gets Anyone. */
  viewerId: string | null;
}

const formatMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Not { ok: true }, so a successful booking is distinguishable from the start. */
const initial: ActionState = { ok: false };

export const SessionForm = ({ members, viewerId }: SessionFormProps) => {
  const [state, formAction, isPending] = useActionState(bookSession, initial);

  /**
   * "Today" is resolved after mount, so the prerendered HTML can never disagree
   * with the browser's clock and trigger a hydration mismatch.
   */
  const [todayISO, setTodayISO] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(0);
  const [activity, setActivity] = useState<ActivityType>('run');
  const [dateISO, setDateISO] = useState('');
  const [time, setTime] = useState('07:00');
  const [note, setNote] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const now = new Date();
    const iso = toISODate(now);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const nextQuickTime = quickTimes.find((option) => minutesOfTime(option) > minutes);
    const initialDate = nextQuickTime ? iso : buildDays(iso, 2)[1].iso;
    setTodayISO(iso);
    setNowMinutes(minutes);
    setDateISO((current) => current || initialDate);
    setTime(nextQuickTime ?? quickTimes[0]);
  }, []);

  /*
   * Clears what a second tap would otherwise resubmit verbatim. Keyed on
   * bookedAt — a primitive that changes per successful booking — so the body only
   * calls setters and needs nothing else in the dependency list.
   */
  useEffect(() => {
    if (!state.bookedAt) {
      return;
    }

    setNote('');
    setActivity('run');
    setTime('07:00');
    setDismissed(false);
  }, [state.bookedAt]);

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

      {state.message && !dismissed && (
        <p className={styles.confirmed} role="status">
          {state.message}
        </p>
      )}

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
                onChange={() => {
                  setActivity(option);
                  setDismissed(true);
                }}
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
                  onChange={() => {
                    setDateISO(day.iso);
                    if (day.iso === todayISO && minutesOfTime(time) <= nowMinutes) {
                      setTime(
                        quickTimes.find((option) => minutesOfTime(option) > nowMinutes) ?? time
                      );
                    }
                    setDismissed(true);
                  }}
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
            min={dateISO === todayISO ? formatMinutes(Math.min(nowMinutes + 1, 1439)) : undefined}
            required
            onChange={(event) => {
              setTime(event.target.value);
              setDismissed(true);
            }}
          />
        </label>

        <label className={styles.whoField}>
          <span className={styles.fieldLabel}>Booked by</span>
          {/* Bookings stay group-wide — anyone can book or remove one. This only
              saves picking your own name every time. */}
          <select name="createdBy" defaultValue={viewerId ?? ''}>
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
              disabled={dateISO === todayISO && minutesOfTime(option) <= nowMinutes}
              onClick={() => setTime(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <label className={styles.noteField}>
        <span className={styles.fieldLabel}>Note (optional)</span>
        <input
          type="text"
          name="note"
          maxLength={200}
          placeholder="Meet at the park gate"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setDismissed(true);
          }}
        />
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
