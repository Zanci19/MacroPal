import { describe, it, expect } from "vitest";
import { getMacroInsight } from "./macroInsights";

const BASE = {
  caloriesGoal: 2000,
  proteinGoal: 150,
  carbsGoal: 200,
  fatGoal: 70,
};

describe("getMacroInsight", () => {
  it("returns 'empty' type when nothing has been logged", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 0,
      proteinConsumed: 0,
      carbsConsumed: 0,
      fatConsumed: 0,
    });
    expect(result.type).toBe("empty");
    expect(result.headline).toMatch(/start logging/i);
  });

  it("returns 'over_calories' when calories exceed the goal", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 2300,
      proteinConsumed: 150,
      carbsConsumed: 250,
      fatConsumed: 80,
    });
    expect(result.type).toBe("over_calories");
    expect(result.headline).toContain("300");
    expect(result.headline).toMatch(/over/i);
  });

  it("highlights protein deficit when protein is the largest shortfall", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 1200,
      proteinConsumed: 40,   // 73 % deficit
      carbsConsumed: 180,    // 10 % deficit
      fatConsumed: 60,       // 14 % deficit
    });
    expect(result.type).toBe("protein");
    expect(result.headline).toMatch(/protein/i);
  });

  it("highlights carbs deficit when carbs are the largest shortfall", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 900,
      proteinConsumed: 120,  // 20 % deficit
      carbsConsumed: 50,     // 75 % deficit
      fatConsumed: 55,       // 21 % deficit
    });
    expect(result.type).toBe("carbs");
    expect(result.headline).toMatch(/carb/i);
  });

  it("highlights fat deficit when fat is the largest shortfall", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 1400,
      proteinConsumed: 130,  // 13 % deficit — below threshold
      carbsConsumed: 180,    // 10 % deficit — below threshold
      fatConsumed: 10,       // 86 % deficit
    });
    expect(result.type).toBe("fat");
    expect(result.headline).toMatch(/fat/i);
  });

  it("returns 'balanced' when all macros are within 25 % of targets", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 1800,
      proteinConsumed: 130,  // 13 % deficit
      carbsConsumed: 180,    // 10 % deficit
      fatConsumed: 60,       // 14 % deficit
    });
    expect(result.type).toBe("balanced");
  });

  it("returns 'balanced' goal-hit variant when all macros and calories are met", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 2000,
      proteinConsumed: 150,
      carbsConsumed: 200,
      fatConsumed: 70,
    });
    expect(result.type).toBe("balanced");
    expect(result.headline).toMatch(/hit|great/i);
  });

  it("uses goal-specific food suggestions for protein (lose)", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 1200,
      proteinConsumed: 40,
      carbsConsumed: 180,
      fatConsumed: 60,
      goal: "lose",
    });
    expect(result.type).toBe("protein");
    expect(result.detail).toMatch(/chicken|egg|greek yogurt/i);
  });

  it("uses goal-specific food suggestions for protein (gain)", () => {
    const result = getMacroInsight({
      ...BASE,
      caloriesConsumed: 1200,
      proteinConsumed: 40,
      carbsConsumed: 180,
      fatConsumed: 60,
      goal: "gain",
    });
    expect(result.type).toBe("protein");
    expect(result.detail).toMatch(/beef|egg|whey|salmon/i);
  });

  it("handles zero goals gracefully without throwing", () => {
    expect(() =>
      getMacroInsight({
        caloriesGoal: 0,
        proteinGoal: 0,
        carbsGoal: 0,
        fatGoal: 0,
        caloriesConsumed: 500,
        proteinConsumed: 30,
        carbsConsumed: 60,
        fatConsumed: 20,
      })
    ).not.toThrow();
  });
});
