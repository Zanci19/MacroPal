export type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

export type Macros = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
};

export type DiaryEntry = {
  fdcId: number;
  code?: string;
  name: string;
  brand?: string | null;
  dataType?: string | null;
  base?: { amount: number; unit: string; label: string };
  selection?: {
    mode: "serving" | "weight";
    note: string;
    servingsQty?: number | null;
    weightQty?: number | null;
  };
  perBase?: Macros;
  total: Macros;
  addedAt: string;
  [k: string]: unknown;
};

export type Profile = {
  age: number;
  weight: number; // kg
  height: number; // cm
  gender: "male" | "female";
  goal: "lose" | "maintain" | "gain";
  activity: "sedentary" | "light" | "moderate" | "very" | "extra";
  [k: string]: unknown;
};
