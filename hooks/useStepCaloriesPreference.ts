'use client';

import { useEffect, useState } from 'react';

export const STEP_CALORIES_PREFERENCE_KEY = 'fitnessjourni-count-burned-kcal';

export const useStepCaloriesPreference = () => {
  const [includeStepCalories, setIncludeStepCaloriesState] = useState(false);

  useEffect(() => {
    try {
      setIncludeStepCaloriesState(
        window.localStorage.getItem(STEP_CALORIES_PREFERENCE_KEY) === 'true'
      );
    } catch {
      setIncludeStepCaloriesState(false);
    }
  }, []);

  const setIncludeStepCalories = (include: boolean) => {
    setIncludeStepCaloriesState(include);
    try {
      window.localStorage.setItem(STEP_CALORIES_PREFERENCE_KEY, String(include));
    } catch {
      // Keep the preference usable for this visit when storage is unavailable.
    }
  };

  return [includeStepCalories, setIncludeStepCalories] as const;
};
