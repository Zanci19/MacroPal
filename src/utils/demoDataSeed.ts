/**
 * Demo Data Seeder
 * Initializes sample food, workout, and weight data for demo mode
 */

import { demoFirestore } from "./demoFirestore";
import type { DayDiaryDoc, WorkoutDayDoc, WorkoutEntry } from "../types";
import { toDateKey } from "./date";

const DEMO_USER_ID = "demo-user-id";
const DEMO_SEED_VERSION = 2;
const DEMO_SEED_VERSION_KEY = "demo_seed_version";
const TOTAL_DEMO_DAYS = 30;

type FoodTemplate = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// Get date key in YYYY-MM-DD format
function getDateKey(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateKey(date);
}

function getTimestampForDay(daysAgo: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function getStoredSeedVersion(): number | null {
  try {
    const raw = localStorage.getItem(DEMO_SEED_VERSION_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storeSeedVersion(version: number): void {
  try {
    localStorage.setItem(DEMO_SEED_VERSION_KEY, String(version));
  } catch {
    // no-op
  }
}

// Sample food entry with structure from AddFood.tsx
const createSampleFoodEntry = (
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  addedAt: string
) => ({
  fdcId: 0, // Dummy ID for demo data
  name,
  brand: null,
  code: "",
  dataSource: "demo",
  base: { amount: 1, unit: "serving", label: "1 serving" },
  selection: {
    mode: "serving" as const,
    note: "1 serving",
    servingsQty: 1,
    weightQty: null,
  },
  perBase: { calories, protein, carbs, fat },
  total: { calories, protein, carbs, fat },
  addedAt,
});

const BREAKFAST_TEMPLATES: FoodTemplate[] = [
  { name: "Greek Yogurt Bowl", calories: 220, protein: 20, carbs: 22, fat: 6 },
  { name: "Protein Oatmeal", calories: 320, protein: 18, carbs: 44, fat: 8 },
  { name: "Avocado Toast", calories: 280, protein: 8, carbs: 30, fat: 14 },
  { name: "Scrambled Eggs", calories: 190, protein: 14, carbs: 2, fat: 14 },
  { name: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0 },
  { name: "Coffee", calories: 2, protein: 0, carbs: 0, fat: 0 },
  { name: "Orange Juice", calories: 112, protein: 2, carbs: 26, fat: 0 },
  { name: "Whole Grain Cereal", calories: 210, protein: 6, carbs: 38, fat: 4 },
];

const LUNCH_TEMPLATES: FoodTemplate[] = [
  { name: "Chicken Burrito Bowl", calories: 540, protein: 38, carbs: 58, fat: 16 },
  { name: "Turkey Sandwich", calories: 410, protein: 30, carbs: 39, fat: 14 },
  { name: "Tuna Salad", calories: 360, protein: 34, carbs: 12, fat: 19 },
  { name: "Brown Rice", calories: 215, protein: 5, carbs: 45, fat: 2 },
  { name: "Mixed Vegetables", calories: 80, protein: 3, carbs: 15, fat: 0 },
  { name: "Grilled Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 4 },
  { name: "Apple", calories: 95, protein: 0, carbs: 25, fat: 0 },
  { name: "Olive Oil Dressing", calories: 120, protein: 0, carbs: 1, fat: 14 },
];

const DINNER_TEMPLATES: FoodTemplate[] = [
  { name: "Salmon Fillet", calories: 280, protein: 25, carbs: 0, fat: 18 },
  { name: "Lean Beef Stir Fry", calories: 430, protein: 36, carbs: 28, fat: 18 },
  { name: "Chicken Pasta", calories: 520, protein: 34, carbs: 62, fat: 14 },
  { name: "Sweet Potato", calories: 112, protein: 2, carbs: 26, fat: 0 },
  { name: "Broccoli", calories: 55, protein: 4, carbs: 11, fat: 0 },
  { name: "Quinoa", calories: 222, protein: 8, carbs: 39, fat: 3 },
  { name: "Side Salad", calories: 72, protein: 2, carbs: 8, fat: 3 },
  { name: "Baked Cod", calories: 190, protein: 38, carbs: 0, fat: 4 },
];

const SNACK_TEMPLATES: FoodTemplate[] = [
  { name: "Greek Yogurt", calories: 100, protein: 17, carbs: 6, fat: 0 },
  { name: "Almonds", calories: 160, protein: 6, carbs: 6, fat: 14 },
  { name: "Protein Shake", calories: 170, protein: 26, carbs: 7, fat: 3 },
  { name: "Trail Mix", calories: 210, protein: 6, carbs: 18, fat: 13 },
  { name: "Rice Cakes", calories: 70, protein: 1, carbs: 15, fat: 0 },
  { name: "Peanut Butter", calories: 95, protein: 4, carbs: 3, fat: 8 },
  { name: "Cottage Cheese", calories: 110, protein: 14, carbs: 4, fat: 4 },
  { name: "Blueberries", calories: 84, protein: 1, carbs: 21, fat: 0 },
];

const WORKOUT_TEMPLATES: Array<{
  title: string;
  durationMinutes: number;
  intensity: WorkoutEntry["intensity"];
  baseCalories: number;
  variation: number;
}> = [
  { title: "Brisk Walk", durationMinutes: 35, intensity: "easy", baseCalories: 190, variation: 25 },
  { title: "Strength Training", durationMinutes: 45, intensity: "moderate", baseCalories: 280, variation: 35 },
  { title: "Cycling", durationMinutes: 40, intensity: "moderate", baseCalories: 300, variation: 40 },
  { title: "HIIT Session", durationMinutes: 25, intensity: "hard", baseCalories: 260, variation: 45 },
  { title: "Jogging", durationMinutes: 32, intensity: "moderate", baseCalories: 250, variation: 30 },
  { title: "Mobility + Core", durationMinutes: 22, intensity: "easy", baseCalories: 120, variation: 20 },
];

const buildMealEntries = (
  templates: FoodTemplate[],
  count: number,
  dayOffset: number,
  startHour: number
) => {
  return Array.from({ length: count }, (_, index) => {
    const template = templates[(dayOffset + index) % templates.length];
    const minute = (dayOffset * 7 + index * 11) % 60;
    return createSampleFoodEntry(
      template.name,
      template.calories,
      template.protein,
      template.carbs,
      template.fat,
      getTimestampForDay(dayOffset, startHour, minute)
    );
  });
};

const buildDayFoodDoc = (daysAgo: number): DayDiaryDoc => {
  const breakfastCount = 2 + (daysAgo % 2);
  const lunchCount = 3 + (daysAgo % 3 === 0 ? 1 : 0);
  const dinnerCount = 3 + (daysAgo % 4 === 0 ? 1 : 0);
  const snackCount = 1 + (daysAgo % 2);

  return {
    breakfast: buildMealEntries(BREAKFAST_TEMPLATES, breakfastCount, daysAgo, 8),
    lunch: buildMealEntries(LUNCH_TEMPLATES, lunchCount, daysAgo + 2, 12),
    dinner: buildMealEntries(DINNER_TEMPLATES, dinnerCount, daysAgo + 4, 19),
    snacks: buildMealEntries(SNACK_TEMPLATES, snackCount, daysAgo + 1, 16),
  };
};

const buildDayWorkoutDoc = (daysAgo: number): WorkoutDayDoc => {
  // Keep some recovery days so charts look realistic.
  if (daysAgo % 5 === 0) {
    return { activities: [] };
  }

  const count = daysAgo % 3 === 0 ? 2 : 1;
  const activities: WorkoutEntry[] = Array.from({ length: count }, (_, index) => {
    const template = WORKOUT_TEMPLATES[(daysAgo + index) % WORKOUT_TEMPLATES.length];
    const calories = Math.round(
      template.baseCalories + Math.sin((daysAgo + index) / 3) * template.variation
    );
    return {
      title: template.title,
      calories: Math.max(90, calories),
      durationMinutes: template.durationMinutes + ((daysAgo + index) % 2 === 0 ? 5 : 0),
      intensity: template.intensity,
      note: "Demo session",
      addedAt: getTimestampForDay(daysAgo, 18 + index, 10 + index * 14),
    };
  });

  return { activities };
};

/**
 * Seeds demo data if not already present
 * Creates realistic logs for the past month
 */
export function seedDemoData(): void {
  const storedVersion = getStoredSeedVersion();
  const todayKey = getDateKey(0);
  const todayPath = `users/${DEMO_USER_ID}/foods/${todayKey}`;
  const existingData = demoFirestore.getData(todayPath);

  const alreadySeeded =
    storedVersion === DEMO_SEED_VERSION &&
    !!existingData &&
    typeof existingData === "object" &&
    Object.keys(existingData).length > 0;

  if (alreadySeeded) {
    console.log("Demo data already seeded");
    return;
  }

  // Ensure we don't carry over partial/old demo datasets from previous versions.
  demoFirestore.clear();

  console.log("Seeding demo data for full month...");

  // Seed food and workout data for the past 30 days.
  for (let daysAgo = 0; daysAgo < TOTAL_DEMO_DAYS; daysAgo++) {
    const dateKey = getDateKey(daysAgo);
    const foodsPath = `users/${DEMO_USER_ID}/foods/${dateKey}`;
    const workoutsPath = `users/${DEMO_USER_ID}/workouts/${dateKey}`;

    const dayData = buildDayFoodDoc(daysAgo);
    const workoutData = buildDayWorkoutDoc(daysAgo);

    demoFirestore.setData(foodsPath, dayData, { merge: false });
    demoFirestore.setData(workoutsPath, workoutData, { merge: false });
  }

  // Seed daily weight entries for the past month with natural trend/variation.
  const BASE_WEIGHT_KG = 70.4;
  const TREND_KG_PER_DAY = 0.015;
  const VARIATION_PERIOD_DAYS = 4.5;
  const VARIATION_AMPLITUDE_KG = 0.35;

  for (let daysAgo = 0; daysAgo < TOTAL_DEMO_DAYS; daysAgo++) {
    const dateKey = getDateKey(daysAgo);
    const weightPath = `users/${DEMO_USER_ID}/weighins/${dateKey}`;

    const weight =
      BASE_WEIGHT_KG -
      daysAgo * TREND_KG_PER_DAY +
      Math.sin(daysAgo / VARIATION_PERIOD_DAYS) * VARIATION_AMPLITUDE_KG;

    demoFirestore.setData(
      weightPath,
      {
        weight: Number(weight.toFixed(1)),
        date: dateKey,
        timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
      },
      { merge: false }
    );
  }

  storeSeedVersion(DEMO_SEED_VERSION);
  console.log("Demo data seeded successfully");
}

/**
 * Checks if demo mode is active and seeds data if needed
 */
export function initializeDemoData(): void {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  
  if (isDemoMode) {
    seedDemoData();
  }
}
