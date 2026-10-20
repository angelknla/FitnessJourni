'use client';

import { BinIcon, CrossIcon, PencilIcon, PlusIcon } from '@components/Icons/Icons';
import { MemberAvatar } from '@components/MemberAvatar/MemberAvatar';
import { accentHex } from '@data/fitnessData';
import { fromISODate, startOfMonth, startOfWeek } from '@utils/date';
import { type CSSProperties, useActionState, useEffect, useState } from 'react';
import { type ActionState, deleteRun, editRun, logRun } from '@/app/actions';
import { formatRunDuration, formatRunPace } from '@/lib/data/runs';
import { viewerFirst } from '@/lib/ownership';
import ui from '@/styles/ui.module.css';
import type { GroupRun, Member, RunTally } from '@/types/fitness';

import styles from './RunningDashboard.module.css';

interface RunningDashboardProps {
  members: Member[];
  runs: GroupRun[];
  latestRuns: GroupRun[];
  tallies: Record<string, RunTally>;
  viewerId: string | null;
  today: string;
}

const initial: ActionState = { ok: false };

const runDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const RunForm = ({
  members,
  viewerId,
  today,
  run,
  onSaved,
}: {
  members: Member[];
  viewerId: string;
  today: string;
  run?: GroupRun;
  onSaved?: () => void;
}) => {
  const [state, formAction, isPending] = useActionState(run ? editRun : logRun, initial);
  const [hours, setHours] = useState(String(run ? Math.floor(run.durationMinutes / 60) : 0));
  const [minutes, setMinutes] = useState(String(run ? run.durationMinutes % 60 : 30));
  const [distance, setDistance] = useState(String(run?.distanceKm ?? 5));
  const [paceMinutes, setPaceMinutes] = useState(
    run?.paceSecondsPerKm ? String(Math.floor(run.paceSecondsPerKm / 60)) : ''
  );
  const [paceSeconds, setPaceSeconds] = useState(
    run?.paceSecondsPerKm ? String(run.paceSecondsPerKm % 60) : ''
  );
  const durationMinutes = Number(hours || 0) * 60 + Number(minutes || 0);
  const distanceKm = Number(distance);
  const hasManualPace = paceMinutes !== '' || paceSeconds !== '';
  const manualPaceSeconds = Number(paceMinutes || 0) * 60 + Number(paceSeconds || 0);
  const valid = durationMinutes > 0 && distanceKm > 0 && (!hasManualPace || manualPaceSeconds > 0);

  useEffect(() => {
    if (state.ok && state.bookedAt) {
      onSaved?.();
    }
  }, [onSaved, state.bookedAt, state.ok]);

  return (
    <form className={`${styles.form} ${ui.card} ${run ? styles.editForm : ''}`} action={formAction}>
      {run ? (
        <input type="hidden" name="id" value={run.id} />
      ) : (
        <input type="hidden" name="createdBy" value={viewerId} />
      )}

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Date</span>
          <input type="date" name="date" defaultValue={run?.date ?? today} max={today} required />
        </label>

        <fieldset className={styles.timeField}>
          <legend>Time</legend>
          <label>
            <input
              type="number"
              name="hours"
              min={0}
              max={24}
              inputMode="numeric"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
            <span>hr</span>
          </label>
          <label>
            <input
              type="number"
              name="minutes"
              min={0}
              max={59.9}
              step={0.1}
              inputMode="decimal"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
            <span>min</span>
          </label>
        </fieldset>

        <label className={styles.field}>
          <span>Distance</span>
          <span className={styles.inputUnit}>
            <input
              type="number"
              name="distanceKm"
              min={0.01}
              max={1000}
              step={0.01}
              inputMode="decimal"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              required
            />
            <span>km</span>
          </span>
        </label>

        <fieldset className={styles.timeField}>
          <legend>Pace (optional)</legend>
          <label>
            <input
              type="number"
              name="paceMinutes"
              min={0}
              max={120}
              inputMode="numeric"
              value={paceMinutes}
              placeholder="Auto"
              onChange={(event) => setPaceMinutes(event.target.value)}
            />
            <span>min/km</span>
          </label>
          <label>
            <input
              type="number"
              name="paceSeconds"
              min={0}
              max={59}
              inputMode="numeric"
              value={paceSeconds}
              placeholder="00"
              onChange={(event) => setPaceSeconds(event.target.value)}
            />
            <span>sec/km</span>
          </label>
        </fieldset>
      </div>

      <div className={styles.pacePreview}>
        <span>{hasManualPace ? 'Manual pace' : 'Calculated pace'}</span>
        <strong>
          {valid
            ? formatRunPace(durationMinutes, distanceKm, hasManualPace ? manualPaceSeconds : null)
            : '—'}
        </strong>
      </div>

      <fieldset className={styles.attendees}>
        <legend>Who ran?</legend>
        <div className={styles.people}>
          {members.map((member) => (
            <label
              className={styles.person}
              key={member.id}
              style={{ '--person-accent': accentHex[member.accent] } as CSSProperties}
            >
              <input
                type="checkbox"
                name="attendee"
                value={member.id}
                defaultChecked={run ? run.attendeeIds.includes(member.id) : member.id === viewerId}
                disabled={member.id === (run?.createdBy ?? viewerId)}
              />
              <span className={styles.personLabel}>
                <MemberAvatar member={member} size="1rem" />
                <span className={styles.personName}>{member.name}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.formActions}>
        <button
          type="submit"
          className={`${styles.submit} ${ui.primaryButton}`}
          disabled={isPending || !valid}
        >
          {isPending ? (run ? 'Saving…' : 'Logging…') : run ? 'Save changes' : 'Log run'}
        </button>
        {run && (
          <button type="button" onClick={onSaved} disabled={isPending}>
            Cancel
          </button>
        )}
        {state.error && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
};

const RunCard = ({
  run,
  members,
  viewerId,
  today,
}: {
  run: GroupRun;
  members: Member[];
  viewerId: string | null;
  today: string;
}) => {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(deleteRun, initial);
  const attendees = members.filter((member) => run.attendeeIds.includes(member.id));

  return (
    <li className={`${styles.runCard} ${ui.card}`}>
      <div className={styles.runLead}>
        <span className={styles.runDate}>{runDate.format(fromISODate(run.date))}</span>
        <strong>{run.distanceKm.toFixed(2)}</strong>
        <span>kilometres</span>
      </div>

      <dl className={styles.runMetrics}>
        <div>
          <dt>Pace</dt>
          <dd>{formatRunPace(run.durationMinutes, run.distanceKm, run.paceSecondsPerKm)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{formatRunDuration(run.durationMinutes)}</dd>
        </div>
      </dl>

      <div className={styles.ranWith}>
        <span>Ran with</span>
        <span className={styles.attendeeNames}>
          {attendees.map((member) => (
            <span
              className={styles.attendee}
              key={member.id}
              style={{ '--person-accent': accentHex[member.accent] } as CSSProperties}
            >
              <MemberAvatar member={member} size="1.1rem" />
              {member.name}
            </span>
          ))}
        </span>
      </div>

      {run.createdBy === viewerId && (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.cardAction}
            aria-label={`Edit ${run.distanceKm.toFixed(2)} kilometre run`}
            aria-expanded={editing}
            aria-controls={`edit-run-${run.id}`}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? <CrossIcon size={13} /> : <PencilIcon size={13} />}
          </button>
          <form action={formAction}>
            <input type="hidden" name="id" value={run.id} />
            <button
              type="submit"
              className={`${styles.cardAction} ${styles.remove}`}
              disabled={isPending}
              aria-label={`Remove ${run.distanceKm.toFixed(2)} kilometre run`}
            >
              <BinIcon size={13} />
            </button>
          </form>
        </div>
      )}

      {editing && viewerId && (
        <div className={styles.editPanel} id={`edit-run-${run.id}`}>
          <RunForm
            members={members}
            viewerId={viewerId}
            today={today}
            run={run}
            onSaved={() => setEditing(false)}
          />
        </div>
      )}

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </li>
  );
};

export const RunningDashboard = ({
  members,
  runs,
  latestRuns,
  tallies,
  viewerId,
  today,
}: RunningDashboardProps) => {
  const [runFormOpen, setRunFormOpen] = useState(false);
  const [runFilter, setRunFilter] = useState<'latest' | 'week' | 'month'>('latest');
  const orderedMembers = viewerFirst(members, viewerId);
  const monthStart = startOfMonth(today);
  const weekStart = startOfWeek(today);
  const monthRuns = runs.filter((run) => run.date >= monthStart && run.date <= today);
  const weekRuns = runs.filter((run) => run.date >= weekStart && run.date <= today);
  const todayRuns = runs.filter((run) => run.date === today);
  const monthDistance = monthRuns.reduce((total, run) => total + run.distanceKm, 0);
  const weekDistance = weekRuns.reduce((total, run) => total + run.distanceKm, 0);
  const todayRunnerCount = new Set(todayRuns.flatMap((run) => run.attendeeIds)).size;
  const todayDistance = todayRuns.reduce((total, run) => total + run.distanceKm, 0);
  const todayDuration = todayRuns.reduce((total, run) => total + run.durationMinutes, 0);
  const visibleRuns =
    runFilter === 'latest' ? latestRuns.slice(0, 3) : runFilter === 'week' ? weekRuns : monthRuns;
  const emptyRunMessage =
    runFilter === 'latest' ? 'No runs logged yet.' : `No runs logged this ${runFilter} yet.`;
  const maxWeek = Math.max(1, ...members.map((member) => tallies[member.id]?.week ?? 0));
  const maxMonth = Math.max(1, ...members.map((member) => tallies[member.id]?.month ?? 0));

  return (
    <div className={styles.dashboard}>
      <section className={`${styles.highlights} ${ui.card}`} aria-label="Running highlights">
        <div className={styles.primaryHighlight}>
          <span>This month</span>
          <strong>{monthDistance.toFixed(1)} km</strong>
          <small>across {monthRuns.length} group runs</small>
        </div>
        <div className={styles.miniHighlight}>
          <strong>{weekDistance.toFixed(1)} km</strong>
          <span>
            this week · {weekRuns.length} {weekRuns.length === 1 ? 'run' : 'runs'}
          </span>
        </div>
        <div className={styles.miniHighlight}>
          <strong>{todayRunnerCount}</strong>
          <span>
            {todayRunnerCount === 1 ? 'person showed up today' : 'people showed up today'}
          </span>
          <span>
            {todayDistance.toFixed(1)} km · {formatRunDuration(todayDuration)}
          </span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="run-tallies-heading">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.kicker}>Consistency</p>
            <h2 id="run-tallies-heading">Runs by person</h2>
          </div>
          <span className={styles.legend}>Week / month</span>
        </div>

        <ul className={styles.tallies}>
          {orderedMembers.map((member) => {
            const tally = tallies[member.id] ?? { week: 0, month: 0 };
            return (
              <li
                className={`${styles.tally} ${ui.card}`}
                key={member.id}
                style={{ '--person-accent': accentHex[member.accent] } as CSSProperties}
              >
                <div className={styles.tallyName}>
                  <MemberAvatar member={member} />
                  <strong>{member.name}</strong>
                </div>
                <div className={styles.rails}>
                  <span className={styles.rail}>
                    <span style={{ width: `${(tally.week / maxWeek) * 100}%` }} />
                  </span>
                  <span className={styles.rail}>
                    <span style={{ width: `${(tally.month / maxMonth) * 100}%` }} />
                  </span>
                </div>
                <div className={styles.tallyNumbers}>
                  <strong>{tally.week}</strong>
                  <span>/</span>
                  <strong>{tally.month}</strong>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {viewerId && (
        <section className={styles.section} aria-labelledby="log-run-heading">
          <button
            type="button"
            className={`${styles.sectionHead} ${styles.runToggle}`}
            aria-expanded={runFormOpen}
            aria-controls="log-run-form"
            onClick={() => setRunFormOpen((current) => !current)}
          >
            <div>
              <p className={styles.kicker}>Add effort</p>
              <h2 id="log-run-heading">Log a run</h2>
            </div>
            {runFormOpen ? <CrossIcon /> : <PlusIcon />}
          </button>
          {runFormOpen && (
            <div id="log-run-form">
              <RunForm
                members={orderedMembers}
                viewerId={viewerId}
                today={today}
                key={runs.length}
              />
            </div>
          )}
        </section>
      )}

      <section className={styles.section} aria-labelledby="recent-runs-heading">
        <div className={`${styles.sectionHead} ${styles.recentHeader}`}>
          <div>
            <p className={styles.kicker}>The route behind you</p>
            <h2 id="recent-runs-heading">Recent runs</h2>
          </div>
          <fieldset className={styles.runFilters}>
            <legend className={styles.visuallyHidden}>Filter recent runs</legend>
            {(['latest', 'week', 'month'] as const).map((filter) => (
              <button
                type="button"
                className={styles.runFilter}
                aria-pressed={runFilter === filter}
                onClick={() => setRunFilter(filter)}
                key={filter}
              >
                {filter === 'latest' ? 'Latest' : `This ${filter}`}
              </button>
            ))}
          </fieldset>
        </div>

        {visibleRuns.length === 0 ? (
          <p className={styles.empty}>{emptyRunMessage}</p>
        ) : (
          <ul className={styles.runList}>
            {visibleRuns.map((run) => (
              <RunCard
                run={run}
                members={orderedMembers}
                viewerId={viewerId}
                today={today}
                key={run.id}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
