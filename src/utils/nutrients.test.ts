import { describe, it, expect } from "vitest";
import {
  nutrientsFromNutriments,
  scaleNutrients,
  addNutrients,
  sumNutrients,
  deriveSaltSodium,
  percentDV,
  emptyNutrients,
  NUTRIENTS,
} from "./nutrients";

describe("nutrientsFromNutriments", () => {
  it("extracts the full nutrient set from a basicFoods-style map (per 100g)", () => {
    const apple = {
      "energy-kcal_100g": 52,
      carbohydrates_100g: 13.8,
      sugars_100g: 10.4,
      fiber_100g: 2.4,
      proteins_100g: 0.3,
      fat_100g: 0.2,
      "vitamin-c_100g": 4.6,
      "vitamin-k_100g": 2.2,
      potassium_100g: 107,
      magnesium_100g: 5,
      calcium_100g: 6,
      iron_100g: 0.1,
    };
    const n = nutrientsFromNutriments(apple, "100g");
    expect(n.calories).toBe(52);
    expect(n.carbs).toBe(13.8);
    expect(n.protein).toBe(0.3);
    expect(n.fat).toBe(0.2);
    // extended macros + micronutrients preserved (this was the bug)
    expect(n.sugar).toBe(10.4);
    expect(n.fiber).toBe(2.4);
    expect(n.vitaminC).toBe(4.6);
    expect(n.potassium).toBe(107);
    expect(n.calcium).toBe(6);
    expect(n.iron).toBe(0.1);
  });

  it("leaves absent optional nutrients undefined, not 0", () => {
    const n = nutrientsFromNutriments({ "energy-kcal_100g": 100 }, "100g");
    expect(n.calories).toBe(100);
    // required macros default to 0
    expect(n.carbs).toBe(0);
    // optional nutrients stay undefined so charts don't show false zeros
    expect(n.fiber).toBeUndefined();
    expect(n.vitaminC).toBeUndefined();
  });

  it("reads the per-serving key set when mode is 'serving'", () => {
    const n = nutrientsFromNutriments(
      { "energy-kcal_serving": 250, proteins_serving: 12 },
      "serving"
    );
    expect(n.calories).toBe(250);
    expect(n.protein).toBe(12);
  });
});

describe("scaleNutrients", () => {
  it("scales every present nutrient and preserves undefineds", () => {
    const base = nutrientsFromNutriments(
      { "energy-kcal_100g": 52, carbohydrates_100g: 13.8, "vitamin-c_100g": 4.6 },
      "100g"
    );
    const scaled = scaleNutrients(base, 2);
    expect(scaled.calories).toBe(104);
    expect(scaled.carbs).toBe(27.6);
    expect(scaled.vitaminC).toBe(9.2);
    expect(scaled.fiber).toBeUndefined();
  });

  it("returns empty nutrients for undefined base", () => {
    expect(scaleNutrients(undefined, 3)).toEqual(emptyNutrients());
  });
});

describe("addNutrients / sumNutrients", () => {
  it("adds two bags, treating undefined as absent", () => {
    const a = { calories: 100, carbs: 10, protein: 5, fat: 2, fiber: 3 };
    const b = { calories: 50, carbs: 5, protein: 2, fat: 1, vitaminC: 4 };
    const sum = addNutrients(a, b);
    expect(sum.calories).toBe(150);
    expect(sum.carbs).toBe(15);
    expect(sum.fiber).toBe(3);
    expect(sum.vitaminC).toBe(4);
  });

  it("sums a diary-style list of entries by their `total`", () => {
    const entries = [
      { total: { calories: 100, carbs: 10, protein: 5, fat: 2, sodium: 0.1 } },
      { total: { calories: 200, carbs: 20, protein: 10, fat: 4, sodium: 0.2 } },
    ];
    const totals = sumNutrients(entries);
    expect(totals.calories).toBe(300);
    expect(totals.protein).toBe(15);
    expect(totals.sodium).toBeCloseTo(0.3, 5);
  });
});

describe("deriveSaltSodium", () => {
  it("derives sodium from salt when only salt is present", () => {
    const n = deriveSaltSodium({ calories: 0, carbs: 0, protein: 0, fat: 0, salt: 2.5 });
    expect(n.sodium).toBe(1);
  });

  it("derives salt from sodium when only sodium is present", () => {
    const n = deriveSaltSodium({ calories: 0, carbs: 0, protein: 0, fat: 0, sodium: 1 });
    expect(n.salt).toBe(2.5);
  });

  it("leaves both untouched when both present", () => {
    const n = deriveSaltSodium({ calories: 0, carbs: 0, protein: 0, fat: 0, salt: 3, sodium: 1 });
    expect(n.salt).toBe(3);
    expect(n.sodium).toBe(1);
  });
});

describe("percentDV", () => {
  it("computes a percentage of the daily value", () => {
    // vitamin C DV = 90mg
    expect(percentDV("vitaminC", 90)).toBe(100);
    expect(percentDV("vitaminC", 45)).toBe(50);
  });

  it("returns null when the value is undefined or no DV exists", () => {
    expect(percentDV("vitaminC", undefined)).toBeNull();
    expect(percentDV("calories", 200)).toBeNull();
  });
});

describe("NUTRIENTS metadata integrity", () => {
  it("has unique keys and consistent 100g/serving key derivation", () => {
    const keys = NUTRIENTS.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const n of NUTRIENTS) {
      expect(n.off100g).toContain("_100g");
      expect(n.offServing).toContain("_serving");
    }
  });
});
