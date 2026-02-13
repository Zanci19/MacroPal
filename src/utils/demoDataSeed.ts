/**
 * Demo Data Seeder
 * Initializes sample food and weight data for demo mode
 */

import { demoFirestore } from "./demoFirestore";
import type { DayDiaryDoc } from "../types";

const DEMO_USER_ID = "demo-user-id";

// Get date key in YYYY-MM-DD format
function getDateKey(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
}

// Sample food entries for a realistic demo
// Using the structure from AddFood.tsx
const createSampleFoodEntry = (
  name: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number
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
  addedAt: new Date().toISOString(),
});

/**
 * Seeds demo data if not already present
 * Creates realistic food logs for the past week
 */
export function seedDemoData(): void {
  // Check if demo data already exists
  const todayKey = getDateKey(0);
  const todayPath = `users/${DEMO_USER_ID}/foods/${todayKey}`;
  const existingData = demoFirestore.getData(todayPath);
  
  // If today's data exists, assume demo is already seeded
  if (existingData && typeof existingData === "object" && Object.keys(existingData).length > 0) {
    console.log("Demo data already seeded");
    return;
  }

  console.log("Seeding demo data...");

  // Seed food data for the past 7 days
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const dateKey = getDateKey(daysAgo);
    const foodsPath = `users/${DEMO_USER_ID}/foods/${dateKey}`;

    // Create varied meals for each day
    const dayData: DayDiaryDoc = {
      breakfast: [
        createSampleFoodEntry("Oatmeal", 150, 5, 27, 3),
        createSampleFoodEntry("Banana", 105, 1, 27, 0),
        createSampleFoodEntry("Coffee", 2, 0, 0, 0),
      ],
      lunch: [
        createSampleFoodEntry("Grilled Chicken Breast", 165, 31, 0, 4),
        createSampleFoodEntry("Brown Rice", 215, 5, 45, 2),
        createSampleFoodEntry("Mixed Vegetables", 80, 3, 15, 0),
      ],
      dinner: [
        createSampleFoodEntry("Salmon Fillet", 280, 25, 0, 18),
        createSampleFoodEntry("Sweet Potato", 112, 2, 26, 0),
        createSampleFoodEntry("Broccoli", 55, 4, 11, 0),
      ],
      snacks: [
        createSampleFoodEntry("Greek Yogurt", 100, 17, 6, 0),
        createSampleFoodEntry("Almonds", 160, 6, 6, 14),
      ],
    };

    demoFirestore.setData(foodsPath, dayData, { merge: false });
  }

  // Seed weight data for the past 30 days (one entry every 3 days)
  const BASE_WEIGHT_KG = 70; // Baseline weight in kg for demo
  const VARIATION_PERIOD_DAYS = 5; // Period of weight oscillation
  const VARIATION_AMPLITUDE_KG = 0.5; // Maximum weight variation in kg
  
  for (let daysAgo = 0; daysAgo < 30; daysAgo += 3) {
    const dateKey = getDateKey(daysAgo);
    const weightPath = `users/${DEMO_USER_ID}/weighins/${dateKey}`;
    
    // Simulate a gradual weight change with natural-looking variations
    const weight = BASE_WEIGHT_KG + Math.sin(daysAgo / VARIATION_PERIOD_DAYS) * VARIATION_AMPLITUDE_KG;
    
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
