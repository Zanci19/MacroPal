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
  units?: "metric" | "imperial";

  // room for extra fields (targets, flags, etc.)
  [k: string]: unknown;
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
  photoUrl?: string;
  photoName?: string;

  /** Any extra nutritional fields you might attach (micros, tags, etc.) */
  [k: string]: unknown;
}

/** Day document in Firestore: foods for a given yyyy-mm-dd */
export interface DayDiaryDoc {
  breakfast: DiaryEntry[];
  lunch: DiaryEntry[];
  dinner: DiaryEntry[];
  snacks: DiaryEntry[];
  [k: string]: DiaryEntry[];
}

export interface WorkoutEntry {
  title: string;
  calories: number;
  durationMinutes?: number;
  intensity?: "easy" | "moderate" | "hard" | string;
  addedAt: string;
  note?: string;
  [k: string]: unknown;
}

export interface WorkoutDayDoc {
  activities: WorkoutEntry[];
  [k: string]: WorkoutEntry[];
}

export interface MealPlanEntry {
  title: string;
  note?: string;
  createdAt: string;
}

export interface MealPlanDoc {
  breakfast: MealPlanEntry[];
  lunch: MealPlanEntry[];
  dinner: MealPlanEntry[];
  snacks: MealPlanEntry[];
  [k: string]: MealPlanEntry[];
}

export interface MealTemplate {
  name: string;
  items: DiaryEntry[];
  createdAt: string;
  [k: string]: unknown;
}

export interface WeighInEntry {
  date: string; // yyyy-mm-dd
  weight: number; // kg
  createdAt?: string;
  [k: string]: unknown;
}

/** =========================
 *  Sharing / Pairing
 *  ========================= */

/** A pairing code document stored at `pairingCodes/{code}` */
export interface PairingCodeDoc {
  /** UID of the user who generated this code (the sharer) */
  ownerUid: string;
  /** Display name of the sharer */
  ownerName: string;
  /** ISO timestamp when the code was created */
  createdAt: string;
  /** ISO timestamp when the code expires (createdAt + 5 min) */
  expiresAt: string;
}

/** An entry in a viewer's list of watched users (stored in `users/{uid}`) */
export interface SharedUserEntry {
  /** UID of the paired user whose data the viewer can see */
  uid: string;
  /** Display name at the time of pairing */
  displayName: string;
  /** ISO timestamp when the pairing was created */
  pairedAt: string;
}

/** An entry in a sharer's list of who can view them (stored in `users/{uid}`) */
export interface ViewerEntry {
  /** UID of the viewer */
  uid: string;
  /** Display name at the time of pairing */
  displayName: string;
  /** ISO timestamp when the pairing was created */
  pairedAt: string;
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

  [k: string]: unknown;
}

/** Search hit from OFF search endpoint */
export interface OFFSearchHit {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  image_front_thumb_url?: string;
  nutriments?: OFFNutriments;

  [k: string]: unknown;
}
