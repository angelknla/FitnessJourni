/**
 * Macros and calories are one budget expressed two ways, so editing either side
 * has to move the other. The rules:
 *
 *  - In percent mode, calories are what you set and grams are derived, so raising
 *    calories raises every gram figure while the split stays put.
 *  - In gram mode, grams are what you set and calories are derived from them.
 *
 * Rounding to whole grams means a percent-mode split rarely multiplies back to
 * exactly the calorie figure — 50/25/25 of 2,500 gives 313/156/69, which is
 * 2,497 kcal. That drift is real and shown rather than hidden.
 */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export type MacroKey = keyof typeof KCAL_PER_GRAM;

export const macroKeys: MacroKey[] = ['protein', 'carbs', 'fat'];

export type MacroGrams = Record<MacroKey, number>;
export type MacroPercents = Record<MacroKey, number>;

export const kcalFromGrams = (grams: MacroGrams): number =>
  macroKeys.reduce((total, key) => total + Math.max(0, grams[key]) * KCAL_PER_GRAM[key], 0);

/** Grams implied by a calorie budget split by percentage. */
export const gramsFromPercents = (calories: number, percents: MacroPercents): MacroGrams => {
  const safeCalories = Number.isFinite(calories) && calories > 0 ? calories : 0;

  return {
    protein: Math.round(
      (safeCalories * clampPercent(percents.protein)) / 100 / KCAL_PER_GRAM.protein
    ),
    carbs: Math.round((safeCalories * clampPercent(percents.carbs)) / 100 / KCAL_PER_GRAM.carbs),
    fat: Math.round((safeCalories * clampPercent(percents.fat)) / 100 / KCAL_PER_GRAM.fat),
  };
};

/** The split those grams represent, as whole percentages of their own total. */
export const percentsFromGrams = (grams: MacroGrams): MacroPercents => {
  const total = kcalFromGrams(grams);

  if (total <= 0) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  return {
    protein: Math.round((grams.protein * KCAL_PER_GRAM.protein * 100) / total),
    carbs: Math.round((grams.carbs * KCAL_PER_GRAM.carbs * 100) / total),
    fat: Math.round((grams.fat * KCAL_PER_GRAM.fat * 100) / total),
  };
};

export const percentTotal = (percents: MacroPercents): number =>
  macroKeys.reduce((total, key) => total + clampPercent(percents[key]), 0);

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.min(100, value);
}
