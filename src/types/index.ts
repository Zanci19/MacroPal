/** =========================
 *  Common types
 *  ========================= */

export type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

export type Macros = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
};

/** =========================
 *  User / profile
 *  ========================= */

export type Gender = "male" | "female";

export type Goal = "lose" | "maintain" | "gain";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "very"
  | "extra";

export interface Profile {
  age: number;
  weight: number; // kg
  height: number; // cm
  gender: Gender;
  goal: Goal;
  activity: ActivityLevel;

  // room for extra fields (targets, flags, etc.)
  [k: string]: any;
}

/** =========================
 *  Diary / foods
 *  ========================= */

export interface BaseServing {
  amount: number;
  unit: string; // e.g. "g", "ml", "slice"
  label: string; // e.g. "per 100 g", "1 serving"
}

export type SelectionMode = "serving" | "weight";

export interface SelectionInfo {
  mode: SelectionMode;
  note: string;
  servingsQty?: number | null;
  weightQty?: number | null; // grams or ml
}

export interface DiaryEntry {
  /** Your internal numeric id (from OFF or elsewhere) */
  fdcId: number;

  /** Barcode / OFF code (if available) */
  code?: string;

  /** Food name (e.g. "Milk 1.5%") */
  name: string;

  /** Brand string if present */
  brand?: string | null;

  /** OFF dataType / category if you store it */
  dataType?: string | null;

  /** Base reference used to compute perBase (usually 100 g or 1 serving) */
  base?: BaseServing;

  /** What the user actually selected for this entry */
  selection?: SelectionInfo;

  /** Macros per base amount (e.g. per 100 g) */
  perBase?: Macros;

  /** Total macros for this logged entry (after scaling) */
  total: Macros & Record<string, number>;

  /** ISO date-time string when entry was added */
  addedAt: string;

  /** Any extra nutritional fields you might attach (micros, tags, etc.) */
  [k: string]: any;
}

/** Day document in Firestore: foods for a given yyyy-mm-dd */
export interface DayDiaryDoc {
  breakfast: DiaryEntry[];
  lunch: DiaryEntry[];
  dinner: DiaryEntry[];
  snacks: DiaryEntry[];
  [k: string]: any;
}
/** =========================
 *  Open Food Facts (subset)
 *  ========================= */

export interface OFFNutriments {
  energy_kcal_100g?: number;
  carbohydrates_100g?: number;
  proteins_100g?: number;
  fat_100g?: number;

  // allow other nutrients without complaining
  [k: string]: number | undefined;
}

export interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  image_front_thumb_url?: string;
  image_front_url?: string;
  nutriments?: OFFNutriments;

  [k: string]: any;
}

/** Search hit from OFF search endpoint */
export interface OFFSearchHit {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  image_front_thumb_url?: string;
  nutriments?: OFFNutriments;

  [k: string]: any;
}
