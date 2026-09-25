'use client';

import { useActionState, useEffect, useState } from 'react';
import { type ActionState, updateTargets } from '@/app/actions';
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
}

type Mode = 'grams' | 'percent';

/** Deliberately not { ok: true }, so state.ok only becomes true after a real save. */
const initial: ActionState = { ok: false };

const LABELS: Record<MacroKey, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
};

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const EditTargets = ({ member, id, onSaved }: EditTargetsProps) => {
  const [state, formAction, isPending] = useActionState(updateTargets, initial);
  const [mode, setMode] = useState<Mode>('grams');

  const startingGrams: MacroGrams = {
    protein: member.targets.protein,
    carbs: member.targets.carbs,
    fat: member.targets.fat,
  };

  // Grams are what you type in gram mode; calories + percents are what you type
  // in percent mode. Whichever side is not being edited is derived, so the two
  // can never drift apart on screen.
  const [grams, setGrams] = useState<MacroGrams>(startingGrams);
  const [calories, setCalories] = useState(String(member.targets.calories));
  const [percents, setPercents] = useState<MacroPercents>(percentsFromGrams(startingGrams));

  useEffect(() => {
    if (state.ok) {
      onSaved();
    }
  }, [state.ok, onSaved]);

  const caloriesNumber = toNumber(calories);

  const effectiveGrams = mode === 'percent' ? gramsFromPercents(caloriesNumber, percents) : grams;
  const effectiveCalories = mode === 'percent' ? caloriesNumber : kcalFromGrams(grams);
  const effectivePercents = mode === 'percent' ? percents : percentsFromGrams(grams);

  const split = percentTotal(percents);
  const splitOff = mode === 'percent' && split !== 100;

  // Switching mode carries the current numbers across rather than resetting.
  const switchMode = (next: Mode) => {
    if (next === mode) {
      return;
    }

    if (next === 'percent') {
      setPercents(percentsFromGrams(grams));
      setCalories(String(kcalFromGrams(grams)));
    } else {
      setGrams(gramsFromPercents(caloriesNumber, percents));
    }

    setMode(next);
  };

  return (
    <form className={styles.form} action={formAction} id={id}>
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

        {mode === 'percent' ? (
          <label className={styles.caloriesField}>
            <span className={styles.fieldLabel}>Calories</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20000}
              step={10}
              required
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
            />
          </label>
        ) : (
          <div className={styles.caloriesField}>
            <span className={styles.fieldLabel}>
              Calories
              <span className={styles.derived}>from the grams below</span>
            </span>
            <output className={styles.caloriesOut} aria-label="Calories from the grams below">
              {formatCount(effectiveCalories)} kcal
            </output>
          </div>
        )}

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
                      onChange={(event) =>
                        setGrams((current) => ({ ...current, [key]: toNumber(event.target.value) }))
                      }
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
                          [key]: toNumber(event.target.value),
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
          Those grams come to <strong>{formatCount(effectiveCalories)} kcal</strong>, which is what
          gets saved as the calorie target.
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
