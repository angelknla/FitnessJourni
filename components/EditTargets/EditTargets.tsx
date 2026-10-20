'use client';

import { useEffect, useState } from 'react';
import { useBackgroundSave, type SaveAction } from '@hooks/useBackgroundSave';
import { updateTargets } from '@/app/actions';
import {
  gramsFromPercents,
  kcalFromGrams,
  type MacroGrams,
  type MacroKey,
  type MacroPercents,
  macroKeys,
  percentsFromGrams,
  percentTotal,
} from '@/lib/macros';
import { formatCount } from '@/lib/progress';
import type { Member } from '@/types/fitness';

import styles from './EditTargets.module.css';

interface EditTargetsProps {
  member: Member;
  id: string;
  onSaved: () => void;
  section?: 'macros' | 'sleep';
  save?: SaveAction;
}

type Mode = 'grams' | 'percent';
type MacroDraft = Record<MacroKey, string>;


const LABELS: Record<MacroKey, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
};

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const toDraft = (values: MacroGrams | MacroPercents): MacroDraft => ({
  protein: String(values.protein),
  carbs: String(values.carbs),
  fat: String(values.fat),
});

const toNumbers = (draft: MacroDraft): MacroGrams => ({
  protein: toNumber(draft.protein),
  carbs: toNumber(draft.carbs),
  fat: toNumber(draft.fat),
});

export const EditTargets = ({
  member,
  id,
  onSaved,
  section = 'macros',
  save,
}: EditTargetsProps) => {
  const {
    state,
    submit: formAction,
    pending: isPending,
  } = useBackgroundSave(
    save ?? ((data) => updateTargets({ ok: false }, data)),
    () => {
      if (save) onSaved();
    },
    () => {}
  );
  const [mode, setMode] = useState<Mode>('grams');

  const startingGrams: MacroGrams = {
    protein: member.targets.protein,
    carbs: member.targets.carbs,
    fat: member.targets.fat,
  };

  // Grams are what you type in gram mode; calories + percents are what you type
  // in percent mode. Whichever side is not being edited is derived, so the two
  // can never drift apart on screen.
  const [grams, setGrams] = useState<MacroDraft>(toDraft(startingGrams));
  const [calories, setCalories] = useState(String(member.targets.calories));
  const [percents, setPercents] = useState<MacroDraft>(toDraft(percentsFromGrams(startingGrams)));

  useEffect(() => {
    if (state.ok && !save) {
      onSaved();
    }
  }, [state.ok, onSaved, save]);

  if (section === 'sleep') {
    return (
      <form className={styles.form} onSubmit={formAction} id={id}>
        <input type="hidden" name="memberId" value={member.id} />
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{member.name}&apos;s sleep target</legend>
          <label className={styles.caloriesField}>
            <span className={styles.fieldLabel}>Hours per night</span>
            <input
              type="number"
              name="sleepHours"
              inputMode="decimal"
              min={1}
              max={24}
              step={0.25}
              defaultValue={member.targets.sleepHours ?? 8}
              required
            />
          </label>
        </fieldset>
        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save sleep target'}
          </button>
          <button type="button" className={styles.cancel} onClick={onSaved}>
            Cancel
          </button>
          {state.error && (
            <p className={styles.error} role="alert">
              {state.error}
            </p>
          )}
        </div>
      </form>
    );
  }

  const caloriesNumber = toNumber(calories);
  const gramsNumbers = toNumbers(grams);
  const percentNumbers = toNumbers(percents);

  const effectiveGrams =
    mode === 'percent' ? gramsFromPercents(caloriesNumber, percentNumbers) : gramsNumbers;
  const effectiveCalories = caloriesNumber;
  const effectivePercents =
    mode === 'percent'
      ? percentNumbers
      : kcalFromGrams(gramsNumbers) > 0
        ? percentsFromGrams(gramsNumbers)
        : percentNumbers;

  /** What those grams add up to — may differ from the typed figure by rounding. */
  const gramsKcal = kcalFromGrams(effectiveGrams);
  const roundingGap = Math.abs(gramsKcal - effectiveCalories);

  /*
   * Calories is typeable in both modes. In grams mode, changing it rescales the
   * grams at the remembered split; changing a gram figure recomputes both the
   * calorie total and the split.
   *
   * The split is held in state rather than re-derived from the grams on demand,
   * because emptying the calorie field zeroes the grams — and a split computed
   * from all-zero grams is itself zero, which would destroy the ratio for good.
   */
  const changeCalories = (value: string) => {
    setCalories(value);

    if (mode === 'grams') {
      setGrams(toDraft(gramsFromPercents(toNumber(value), percentNumbers)));
    }
  };

  const changeGram = (key: MacroKey, value: string) => {
    const next = { ...grams, [key]: value };
    const nextNumbers = toNumbers(next);
    setGrams(next);
    setCalories(String(kcalFromGrams(nextNumbers)));

    // Only a non-empty set of grams describes a meaningful split.
    if (kcalFromGrams(nextNumbers) > 0) {
      setPercents(toDraft(percentsFromGrams(nextNumbers)));
    }
  };

  const split = percentTotal(percentNumbers);
  const splitOff = mode === 'percent' && split !== 100;

  // Switching mode carries the current numbers across rather than resetting.
  const switchMode = (next: Mode) => {
    if (next === mode) {
      return;
    }

    if (next === 'percent') {
      setPercents(toDraft(percentsFromGrams(gramsNumbers)));
    } else {
      setGrams(toDraft(gramsFromPercents(caloriesNumber, percentNumbers)));
    }

    setMode(next);
  };

  return (
    <form className={styles.form} onSubmit={formAction} id={id}>
      <input type="hidden" name="memberId" value={member.id} />
      {/* What actually gets saved, whichever way it was entered. */}
      <input type="hidden" name="calories" value={effectiveCalories} />
      {macroKeys.map((key) => (
        <input type="hidden" name={key} value={effectiveGrams[key]} key={key} />
      ))}

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>{member.name}'s targets</legend>

        <fieldset className={styles.modes}>
          <legend className="sr-only">Enter macros as</legend>
          {(['grams', 'percent'] as Mode[]).map((option) => (
            <button
              type="button"
              key={option}
              className={styles.mode}
              data-active={mode === option}
              aria-pressed={mode === option}
              onClick={() => switchMode(option)}
            >
              {option === 'grams' ? 'Grams' : 'Percent'}
            </button>
          ))}
        </fieldset>

        <label className={styles.caloriesField}>
          <span className={styles.fieldLabel}>
            Calories
            <span className={styles.derived}>
              {mode === 'grams' ? 'changing this rescales the grams' : 'split across the macros'}
            </span>
          </span>
          {/*
            step is any whole number: a 10 here made the browser reject 2,543,
            including totals the grams above had just derived.
          */}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20000}
            step={1}
            required
            value={calories}
            onChange={(event) => changeCalories(event.target.value)}
          />
        </label>

        <div className={styles.rows}>
          {macroKeys.map((key) => (
            <div className={styles.row} key={key}>
              <span className={styles.rowLabel}>{LABELS[key]}</span>

              {mode === 'grams' ? (
                <>
                  <label className={styles.inputCell}>
                    <span className="sr-only">{LABELS[key]} in grams</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={2000}
                      value={grams[key]}
                      onChange={(event) => changeGram(key, event.target.value)}
                    />
                  </label>
                  <span className={styles.unit}>g</span>
                  <span className={styles.derivedValue}>{effectivePercents[key]}%</span>
                </>
              ) : (
                <>
                  <label className={styles.inputCell}>
                    <span className="sr-only">{LABELS[key]} as a percentage</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={percents[key]}
                      onChange={(event) =>
                        setPercents((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <span className={styles.unit}>%</span>
                  <span className={styles.derivedValue}>{effectiveGrams[key]} g</span>
                </>
              )}
            </div>
          ))}
        </div>
      </fieldset>

      {mode === 'percent' && (
        <p className={styles.split} data-off={splitOff}>
          Split adds up to <strong>{split}%</strong>
          {splitOff ? ' — it needs to be 100%.' : '.'}
        </p>
      )}

      {mode === 'grams' && (
        <p className={styles.split}>
          {roundingGap === 0 ? (
            <>
              Those grams come to exactly <strong>{formatCount(gramsKcal)} kcal</strong>.
            </>
          ) : (
            <>
              Those grams come to <strong>{formatCount(gramsKcal)} kcal</strong> — {roundingGap} off
              the {formatCount(effectiveCalories)} saved, from rounding to whole grams.
            </>
          )}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={isPending || splitOff}>
          {isPending ? 'Saving…' : 'Save targets'}
        </button>
        <button type="button" className={styles.cancel} onClick={onSaved}>
          Cancel
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
