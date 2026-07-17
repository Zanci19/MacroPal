/** =====================================================================
 *  Nutrients — single source of truth for the whole app.
 *
 *  Every surface (search extraction, custom food/meal forms, diary
 *  aggregation, Home, Analytics, nutrient detail) reads nutrient keys,
 *  units, labels and OFF/basicFoods mappings from `NUTRIENTS` below, so
 *  the model can only ever drift in one place.
 *
 *  Units follow MacroPal's stored convention (matches basicFoods.json and
 *  the custom-food form): grams for macros/salt/sodium, mg/µg for
 *  vitamins & minerals as annotated per field.
 *  ===================================================================== */

import type { Nutrients, NutrientTotals, Macros } from "../types";

export type NutrientCategory = "macro" | "extended" | "vitamin" | "mineral";

export interface NutrientMeta {
  key: keyof Nutrients;
  /** Full label, e.g. "Saturated fat" */
  label: string;
  /** Compact label for tight UI, e.g. "Sat. fat" */
  short: string;
  unit: string;
  category: NutrientCategory;
  /** OFF / basicFoods per-100g nutriment key */
  off100g: string;
  /** OFF per-serving nutriment key */
  offServing: string;
  /** Rounding used when extracting/scaling this nutrient */
  decimals: number;
  /** Reference daily value in `unit` (FDA adult) for %DV, when applicable */
  dv?: number;
}

/**
 * Ordered so the primary PCF trio always leads. `calories` is handled
 * separately by most UI but is included here for extraction/scaling.
 */
export const NUTRIENTS: NutrientMeta[] = [
  // ----- primary -----
  { key: "calories", label: "Calories", short: "Cal", unit: "kcal", category: "macro", off100g: "energy-kcal_100g", offServing: "energy-kcal_serving", decimals: 0 },
  { key: "carbs", label: "Carbohydrates", short: "Carbs", unit: "g", category: "macro", off100g: "carbohydrates_100g", offServing: "carbohydrates_serving", decimals: 1, dv: 275 },
  { key: "fat", label: "Fat", short: "Fat", unit: "g", category: "macro", off100g: "fat_100g", offServing: "fat_serving", decimals: 1, dv: 78 },
  { key: "protein", label: "Protein", short: "Protein", unit: "g", category: "macro", off100g: "proteins_100g", offServing: "proteins_serving", decimals: 1, dv: 50 },

  // ----- extended macros -----
  { key: "fiber", label: "Fiber", short: "Fiber", unit: "g", category: "extended", off100g: "fiber_100g", offServing: "fiber_serving", decimals: 1, dv: 28 },
  { key: "sugar", label: "Sugars", short: "Sugars", unit: "g", category: "extended", off100g: "sugars_100g", offServing: "sugars_serving", decimals: 1, dv: 50 },
  { key: "saturatedFat", label: "Saturated fat", short: "Sat. fat", unit: "g", category: "extended", off100g: "saturated-fat_100g", offServing: "saturated-fat_serving", decimals: 1, dv: 20 },
  { key: "sodium", label: "Sodium", short: "Sodium", unit: "g", category: "extended", off100g: "sodium_100g", offServing: "sodium_serving", decimals: 2, dv: 2.3 },
  { key: "salt", label: "Salt", short: "Salt", unit: "g", category: "extended", off100g: "salt_100g", offServing: "salt_serving", decimals: 2, dv: 5.75 },

  // ----- vitamins -----
  { key: "vitaminA", label: "Vitamin A", short: "Vit A", unit: "µg", category: "vitamin", off100g: "vitamin-a_100g", offServing: "vitamin-a_serving", decimals: 1, dv: 900 },
  { key: "vitaminC", label: "Vitamin C", short: "Vit C", unit: "mg", category: "vitamin", off100g: "vitamin-c_100g", offServing: "vitamin-c_serving", decimals: 1, dv: 90 },
  { key: "vitaminD", label: "Vitamin D", short: "Vit D", unit: "µg", category: "vitamin", off100g: "vitamin-d_100g", offServing: "vitamin-d_serving", decimals: 1, dv: 20 },
  { key: "vitaminE", label: "Vitamin E", short: "Vit E", unit: "mg", category: "vitamin", off100g: "vitamin-e_100g", offServing: "vitamin-e_serving", decimals: 1, dv: 15 },
  { key: "vitaminK", label: "Vitamin K", short: "Vit K", unit: "µg", category: "vitamin", off100g: "vitamin-k_100g", offServing: "vitamin-k_serving", decimals: 1, dv: 120 },
  { key: "vitaminB1", label: "Vitamin B1 (Thiamin)", short: "B1", unit: "mg", category: "vitamin", off100g: "vitamin-b1_100g", offServing: "vitamin-b1_serving", decimals: 2, dv: 1.2 },
  { key: "vitaminB2", label: "Vitamin B2 (Riboflavin)", short: "B2", unit: "mg", category: "vitamin", off100g: "vitamin-b2_100g", offServing: "vitamin-b2_serving", decimals: 2, dv: 1.3 },
  { key: "vitaminB3", label: "Vitamin B3 (Niacin)", short: "B3", unit: "mg", category: "vitamin", off100g: "vitamin-b3_100g", offServing: "vitamin-b3_serving", decimals: 2, dv: 16 },
  { key: "vitaminB6", label: "Vitamin B6", short: "B6", unit: "mg", category: "vitamin", off100g: "vitamin-b6_100g", offServing: "vitamin-b6_serving", decimals: 2, dv: 1.7 },
  { key: "vitaminB12", label: "Vitamin B12", short: "B12", unit: "µg", category: "vitamin", off100g: "vitamin-b12_100g", offServing: "vitamin-b12_serving", decimals: 2, dv: 2.4 },
  { key: "folate", label: "Folate", short: "Folate", unit: "µg", category: "vitamin", off100g: "folates_100g", offServing: "folates_serving", decimals: 1, dv: 400 },

  // ----- minerals -----
  { key: "calcium", label: "Calcium", short: "Calcium", unit: "mg", category: "mineral", off100g: "calcium_100g", offServing: "calcium_serving", decimals: 1, dv: 1300 },
  { key: "iron", label: "Iron", short: "Iron", unit: "mg", category: "mineral", off100g: "iron_100g", offServing: "iron_serving", decimals: 2, dv: 18 },
  { key: "magnesium", label: "Magnesium", short: "Magnesium", unit: "mg", category: "mineral", off100g: "magnesium_100g", offServing: "magnesium_serving", decimals: 1, dv: 420 },
  { key: "potassium", label: "Potassium", short: "Potassium", unit: "mg", category: "mineral", off100g: "potassium_100g", offServing: "potassium_serving", decimals: 1, dv: 4700 },
  { key: "zinc", label: "Zinc", short: "Zinc", unit: "mg", category: "mineral", off100g: "zinc_100g", offServing: "zinc_serving", decimals: 2, dv: 11 },
];

export const NUTRIENTS_BY_KEY: Record<string, NutrientMeta> = NUTRIENTS.reduce(
  (acc, n) => {
    acc[n.key] = n;
    return acc;
  },
  {} as Record<string, NutrientMeta>
);

/** The four primary keys, always shown first / largest. */
export const PRIMARY_KEYS = ["calories", "carbs", "fat", "protein"] as const;
/** Macro-gram keys used for the calorie split (carbs/fat/protein). */
export const MACRO_GRAM_KEYS = ["carbs", "fat", "protein"] as const;
export const EXTENDED_KEYS = NUTRIENTS.filter((n) => n.category === "extended").map((n) => n.key);
export const VITAMIN_KEYS = NUTRIENTS.filter((n) => n.category === "vitamin").map((n) => n.key);
export const MINERAL_KEYS = NUTRIENTS.filter((n) => n.category === "mineral").map((n) => n.key);
/** Every optional nutrient (everything except the required PCF+calories). */
export const OPTIONAL_KEYS = NUTRIENTS.filter((n) => !PRIMARY_KEYS.includes(n.key as (typeof PRIMARY_KEYS)[number])).map((n) => n.key);

function roundTo(value: number, dp: number): number {
  if (!isFinite(value)) return 0;
  return Number(value.toFixed(dp));
}

function readNumber(source: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!source) return undefined;
  const raw = source[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  return isFinite(n) ? n : undefined;
}

export function emptyNutrients(): Nutrients {
  return { calories: 0, carbs: 0, protein: 0, fat: 0 };
}

/**
 * Extract a full canonical Nutrients object from an OFF / basicFoods
 * nutriments map. `mode` selects the per-100g or per-serving key set.
 * Required macros default to 0; optional nutrients stay `undefined` when
 * the source has no value (so we never show a fake 0).
 */
export function nutrientsFromNutriments(
  nutri: Record<string, number | undefined> | undefined,
  mode: "100g" | "serving" = "100g"
): Nutrients {
  const out: Nutrients = emptyNutrients();
  for (const n of NUTRIENTS) {
    const srcKey = mode === "serving" ? n.offServing : n.off100g;
    const value = readNumber(nutri, srcKey);
    const isPrimary = PRIMARY_KEYS.includes(n.key as (typeof PRIMARY_KEYS)[number]);
    if (value === undefined) {
      if (isPrimary) (out as unknown as Record<string, number>)[n.key] = 0;
      continue;
    }
    (out as unknown as Record<string, number>)[n.key] = roundTo(value, n.decimals);
  }
  return deriveSaltSodium(out);
}

/** Scale a per-base Nutrients object by a quantity, preserving undefineds. */
export function scaleNutrients(base: Nutrients | undefined, qty: number): Nutrients {
  const out: Nutrients = emptyNutrients();
  if (!base) return out;
  for (const n of NUTRIENTS) {
    const v = (base as unknown as Record<string, number | undefined>)[n.key];
    const isPrimary = PRIMARY_KEYS.includes(n.key as (typeof PRIMARY_KEYS)[number]);
    if (v === undefined) {
      if (isPrimary) (out as unknown as Record<string, number>)[n.key] = 0;
      continue;
    }
    (out as unknown as Record<string, number>)[n.key] = roundTo(v * qty, n.decimals);
  }
  return out;
}

/** Sum two nutrient bags; undefined + value = value, undefined + undefined = undefined. */
export function addNutrients(a: NutrientTotals | undefined, b: NutrientTotals | undefined): NutrientTotals {
  const out = emptyNutrients() as NutrientTotals;
  for (const n of NUTRIENTS) {
    const av = a ? (a as unknown as Record<string, number | undefined>)[n.key] : undefined;
    const bv = b ? (b as unknown as Record<string, number | undefined>)[n.key] : undefined;
    const isPrimary = PRIMARY_KEYS.includes(n.key as (typeof PRIMARY_KEYS)[number]);
    if (av === undefined && bv === undefined) {
      if (isPrimary) (out as unknown as Record<string, number>)[n.key] = 0;
      continue;
    }
    (out as unknown as Record<string, number>)[n.key] = roundTo((av ?? 0) + (bv ?? 0), n.decimals);
  }
  return out;
}

/** Sum a list of entries' `total` bags into one totals object. */
export function sumNutrients(items: Array<{ total?: NutrientTotals } | NutrientTotals>): NutrientTotals {
  return items.reduce<NutrientTotals>((acc, item) => {
    const totals = ((item as { total?: NutrientTotals }).total ?? item) as NutrientTotals;
    return addNutrients(acc, totals);
  }, emptyNutrients() as NutrientTotals);
}

/**
 * Keep salt and sodium consistent (sodium ≈ salt / 2.5). If exactly one is
 * present, derive the other so custom foods can't hold contradictory values.
 */
export function deriveSaltSodium(n: Nutrients): Nutrients {
  const SALT_PER_SODIUM = 2.5;
  const hasSalt = typeof n.salt === "number";
  const hasSodium = typeof n.sodium === "number";
  if (hasSalt && !hasSodium) {
    return { ...n, sodium: roundTo((n.salt as number) / SALT_PER_SODIUM, 2) };
  }
  if (hasSodium && !hasSalt) {
    return { ...n, salt: roundTo((n.sodium as number) * SALT_PER_SODIUM, 2) };
  }
  return n;
}

/** %DV for a nutrient value, or null when no DV reference exists. */
export function percentDV(key: keyof Nutrients, value: number | undefined): number | null {
  if (value === undefined) return null;
  const meta = NUTRIENTS_BY_KEY[key as string];
  if (!meta || !meta.dv) return null;
  return Math.round((value / meta.dv) * 100);
}

/** Format a nutrient value with its unit, e.g. "12.4 g". Empty when undefined. */
export function formatNutrient(key: keyof Nutrients, value: number | undefined): string {
  if (value === undefined) return "—";
  const meta = NUTRIENTS_BY_KEY[key as string];
  const dp = meta ? meta.decimals : 1;
  return `${roundTo(value, dp)}${meta ? " " + meta.unit : ""}`;
}

/** Backward-compat: narrow a Nutrients bag to the legacy PCF-only Macros. */
export function toMacros(n: Nutrients | undefined): Macros {
  return {
    calories: n?.calories ?? 0,
    carbs: n?.carbs ?? 0,
    protein: n?.protein ?? 0,
    fat: n?.fat ?? 0,
  };
}
