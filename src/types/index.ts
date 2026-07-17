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

/**
 * Canonical nutrient model used across the whole app. Calories + the primary
 * PCF trio are always present; extended macros and micronutrients are optional
 * (undefined = "unknown", never coerce to 0 or charts show false zeros).
 * The single source of truth for keys/units/OFF-mapping is
 * `src/utils/nutrients.ts` (`NUTRIENTS`).
 */
export interface Nutrients {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;

  // ----- extended macros -----
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  salt?: number; // grams
  sodium?: number; // grams

  // ----- vitamins -----
  vitaminA?: number; // µg
  vitaminC?: number; // mg
  vitaminD?: number; // µg
  vitaminE?: number; // mg
  vitaminK?: number; // µg
  vitaminB1?: number; // mg
  vitaminB2?: number; // mg
  vitaminB3?: number; // mg
  vitaminB6?: number; // mg
  vitaminB12?: number; // µg
  folate?: number; // µg

  // ----- minerals -----
  calcium?: number; // mg
  iron?: number; // mg
  magnesium?: number; // mg
  potassium?: number; // mg
  zinc?: number; // mg
}

/** A totals bag: canonical nutrients plus room for legacy/extra numeric keys. */
export type NutrientTotals = Nutrients & { [k: string]: number | undefined };

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

  /** Nutrients per base amount (e.g. per 100 g) */
  perBase?: Nutrients;

  /** Total nutrients for this logged entry (after scaling) */
  total: NutrientTotals;

  /** Stable unique id for this entry (used for edit/delete/undo). */
  id?: string;

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

/** =========================
 *  Clinician collaboration
 *  ========================= */

export type UserRole = "user" | "clinician" | "admin";

export interface ClinicianLink {
  clinicianUid: string;
  clinicianName: string;
  consentedAt: string;
  linkedAt: string;
  status: "active" | "revoked";
  inviteCode?: string;
}

export interface ClinicianAssignment {
  uid: string;
  displayName: string;
  assignedAt: string;
  assignedBy?: string;
}

export interface RiskThresholds {
  adherence7dMin: number;
  adherence30dMin: number;
}

export interface AlertDoc {
  severity: "low" | "medium" | "high" | "critical";
  reasonCode: string;
  status: "open" | "acknowledged" | "resolved";
  message: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface CarePlanTemplateDoc {
  name: string;
  description?: string;
  tasks: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CarePlanDoc {
  name: string;
  description?: string;
  tasks: string[];
  completedTasks?: string[];
  status: "active" | "completed" | "paused";
  assignedAt: string;
  assignedBy: string;
  templateId?: string;
}

export interface ConsultationReportPayload {
  reportType: "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  adherence7d: number;
  adherence30d: number;
  trendDelta: number;
  openAlerts: number;
  keyNotes: string[];
  generatedAt: string;
}

export interface ClinicianInviteDoc {
  clinicianUid: string;
  clinicianName: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt?: string;
  redeemedBy?: string;
  status: "active" | "redeemed" | "expired";
}

export interface MessageThreadDoc {
  clinicianUid: string;
  userUid: string;
  updatedAt: string;
  unreadForUser: number;
  unreadForClinician: number;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface MessageItemDoc {
  senderUid: string;
  senderRole: UserRole;
  body: string;
  createdAt: string;
}
