import { DiaryEntry, Macros, MealKey, Profile } from "../types/nutrition";

export const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

const ACTIVITY_MULTIPLIER: Record<Profile["activity"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

const GOAL_ADJUSTMENT: Record<Profile["goal"], number> = {
  lose: -500,
  maintain: 0,
  gain: 500,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getTodayKey(date = new Date()): string {
  return date.toISOString().split("T")[0];
}

export function calculateCalorieGoal(profile: Profile): number {
  const { age, weight, height, gender, goal, activity } = profile;
  const bmr =
    gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  const maintenance = bmr * ACTIVITY_MULTIPLIER[activity];
  const adjusted = maintenance + GOAL_ADJUSTMENT[goal];
  return Math.max(800, Math.round(adjusted));
}

export function calculateMacroTargets(profile: Profile, calorieGoal: number) {
  const proteinG = Math.round(1.8 * profile.weight);
  const fatG = Math.max(45, Math.round(0.8 * profile.weight));
  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const carbsG = Math.round(Math.max(0, calorieGoal - proteinKcal - fatKcal) / 4);

  return { carbsG, proteinG, fatG };
}

export function sumDiaryEntries(entries: DiaryEntry[]): Macros {
  return entries.reduce(
    (acc, item) => ({
      calories: acc.calories + (item.total?.calories || 0),
      carbs: acc.carbs + (item.total?.carbs || 0),
      protein: acc.protein + (item.total?.protein || 0),
      fat: acc.fat + (item.total?.fat || 0),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );
}

export function computeDiaryTotals(dayData: Record<MealKey, DiaryEntry[]>) {
  const perMeal = MEALS.reduce(
    (acc, meal) => ({
      ...acc,
      [meal]: sumDiaryEntries(dayData[meal] || []),
    }),
    {} as Record<MealKey, Macros>
  );

  const day = MEALS.reduce(
    (acc, meal) => ({
      calories: acc.calories + perMeal[meal].calories,
      carbs: acc.carbs + perMeal[meal].carbs,
      protein: acc.protein + perMeal[meal].protein,
      fat: acc.fat + perMeal[meal].fat,
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );

  return { perMeal, day };
}

export function prettyMealLabel(meal: MealKey): string {
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}
