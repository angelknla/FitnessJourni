/**
 * Percent of a target, uncapped — going over 2,500 kcal is information worth
 * showing, not something to silently clamp away.
 */
export const percentOfTarget = (value: number, target: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) {
    return 0;
  }
  return Math.max(0, (value / target) * 100);
};

/** The same figure capped at 100, for anything that physically fills (rings, bars). */
export const fillPercent = (value: number, target: number) =>
  Math.min(100, percentOfTarget(value, target));

export const formatMl = (ml: number) => `${(ml / 1000).toFixed(1)} L`;

export const formatCount = (value: number) => value.toLocaleString('en-GB');

const KCAL_PER_STEP = 0.04;

export const caloriesBurnedFromSteps = (steps: number) => {
  if (!Number.isFinite(steps) || steps <= 0) {
    return 0;
  }

  return Math.round(steps * KCAL_PER_STEP);
};
