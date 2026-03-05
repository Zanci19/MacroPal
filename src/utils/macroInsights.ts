/**
 * macroInsights.ts
 *
 * Generates a personalised, actionable daily nutrition insight based on the
 * user's current macro progress and their fitness goal.
 */

import type { Goal } from "../types";

export type InsightType =
  | "empty"
  | "balanced"
  | "over_calories"
  | "protein"
  | "carbs"
  | "fat"
  | "calories";

export interface MacroInsight {
  /** Short emoji to display beside the headline */
  emoji: string;
  /** One-line headline */
  headline: string;
  /** Supporting detail / food suggestion */
  detail: string;
  /** Which macro (or status) this insight is about */
  type: InsightType;
}

export interface MacroInsightInput {
  /** Calories consumed today */
  caloriesConsumed: number;
  /** Protein consumed today (g) */
  proteinConsumed: number;
  /** Carbs consumed today (g) */
  carbsConsumed: number;
  /** Fat consumed today (g) */
  fatConsumed: number;
  /** Daily calorie goal */
  caloriesGoal: number;
  /** Daily protein target (g) */
  proteinGoal: number;
  /** Daily carbs target (g) */
  carbsGoal: number;
  /** Daily fat target (g) */
  fatGoal: number;
  /** User's fitness goal */
  goal?: Goal;
}

/**
 * Food suggestions for each macro, keyed by fitness goal where relevant.
 */
const PROTEIN_SUGGESTIONS: Record<Goal, string> = {
  lose: "chicken breast, egg whites, or low-fat Greek yogurt",
  maintain: "chicken, eggs, cottage cheese, or legumes",
  gain: "beef, whole eggs, whey protein, or salmon",
};

const CARBS_SUGGESTIONS: Record<Goal, string> = {
  lose: "leafy greens, berries, or sweet potato",
  maintain: "oats, brown rice, fruit, or sweet potato",
  gain: "oats, white rice, banana, or whole-grain pasta",
};

const FAT_SUGGESTIONS: Record<Goal, string> = {
  lose: "avocado, a handful of nuts, or olive oil",
  maintain: "avocado, nuts, seeds, or olive oil",
  gain: "nuts, peanut butter, avocado, or fatty fish",
};

/** Returns the deficit as a fraction (0 = at target, 1 = eaten nothing). */
function deficitFraction(consumed: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.max(0, (goal - consumed) / goal);
}

/**
 * Computes a personalised macro insight for the current day.
 *
 * @param input - Consumed vs target values and user goal.
 * @returns A {@link MacroInsight} with headline, detail and type.
 */
export function getMacroInsight(input: MacroInsightInput): MacroInsight {
  const {
    caloriesConsumed,
    proteinConsumed,
    carbsConsumed,
    fatConsumed,
    caloriesGoal,
    proteinGoal,
    carbsGoal,
    fatGoal,
    goal = "maintain",
  } = input;

  // Nothing logged yet
  if (caloriesConsumed <= 0) {
    return {
      emoji: "🌅",
      headline: "Start logging your meals",
      detail:
        "Add your first food entry to get a personalised nutrition insight for today.",
      type: "empty",
    };
  }

  // Over calorie goal
  if (caloriesGoal > 0 && caloriesConsumed > caloriesGoal) {
    const over = Math.round(caloriesConsumed - caloriesGoal);
    return {
      emoji: "⚠️",
      headline: `${over} kcal over your daily goal`,
      detail:
        "Consider lighter options for your next meal — salads, soups, or steamed vegetables work great.",
      type: "over_calories",
    };
  }

  // Identify which macro has the largest relative deficit
  const proteinDeficit = deficitFraction(proteinConsumed, proteinGoal);
  const carbsDeficit = deficitFraction(carbsConsumed, carbsGoal);
  const fatDeficit = deficitFraction(fatConsumed, fatGoal);

  // Minimum deficit worth calling out (25 % of the daily target)
  const THRESHOLD = 0.25;

  const deficits = [
    { key: "protein" as const, value: proteinDeficit },
    { key: "carbs" as const, value: carbsDeficit },
    { key: "fat" as const, value: fatDeficit },
  ].filter((d) => d.value >= THRESHOLD);

  deficits.sort((a, b) => b.value - a.value);

  if (deficits.length > 0) {
    const top = deficits[0];

    if (top.key === "protein") {
      const remaining = Math.max(0, Math.round(proteinGoal - proteinConsumed));
      return {
        emoji: "💪",
        headline: `${remaining} g of protein still to go`,
        detail: `Boost your protein with ${PROTEIN_SUGGESTIONS[goal]}.`,
        type: "protein",
      };
    }

    if (top.key === "carbs") {
      const remaining = Math.max(0, Math.round(carbsGoal - carbsConsumed));
      return {
        emoji: "🌾",
        headline: `${remaining} g of carbs still to go`,
        detail: `Try ${CARBS_SUGGESTIONS[goal]} to top up your carbohydrates.`,
        type: "carbs",
      };
    }

    if (top.key === "fat") {
      const remaining = Math.max(0, Math.round(fatGoal - fatConsumed));
      return {
        emoji: "🥑",
        headline: `${remaining} g of healthy fats still to go`,
        detail: `Add ${FAT_SUGGESTIONS[goal]} to your next meal.`,
        type: "fat",
      };
    }
  }

  // All macros are within 25 % of their targets — give positive feedback
  const kcalLeft = Math.max(0, Math.round(caloriesGoal - caloriesConsumed));
  if (kcalLeft > 0) {
    return {
      emoji: "✅",
      headline: "Looking balanced — keep it up!",
      detail: `You have ${kcalLeft} kcal left today. A light snack will round off your macros nicely.`,
      type: "balanced",
    };
  }

  return {
    emoji: "🎯",
    headline: "Macro goals hit — great work!",
    detail: "You've matched your targets for today. Stay hydrated and rest well!",
    type: "balanced",
  };
}
