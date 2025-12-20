// src/utils/genericFoodBoosts.ts

export type GenericRule = {
  id: string;
  /**
   * All keywords must appear in the *normalized* product name
   * (lowercase, spaces only, no punctuation).
   */
  keywords: string[];
  /**
   * Treat it as generic only if the name has <= maxTokens words.
   * (eg. "shiitake mushrooms" → 2 tokens → OK, but
   * "chicken & mushroom pot noodle" → 5 tokens → not generic)
   */
  maxTokens?: number;
  /**
   * If the normalized name matches one of these exactly,
   * give it an extra strong boost.
   */
  exactNames?: string[];
  /**
   * Base boost when the rule matches.
   */
  baseBoost: number;
  /**
   * Extra boost when the name is an exact generic match.
   */
  exactBoost?: number;
};

/**
 * You can extend this list with as many generic foods as you want.
 * Just add new rules with keywords / maxTokens / boosts.
 */
const GENERIC_RULES: GenericRule[] = [
  // MUSHROOMS
  {
    id: "mushroom",
    keywords: ["mushroom"],
    maxTokens: 3,
    exactNames: ["mushroom", "mushrooms"],
    baseBoost: 1600,
    exactBoost: 1400,
  },

  // CHICKEN BREAST
  {
    id: "chicken-breast",
    keywords: ["chicken", "breast"],
    maxTokens: 3,
    exactNames: ["chicken breast", "chicken breasts"],
    baseBoost: 1500,
    exactBoost: 1200,
  },

  // OATS / OATMEAL
  {
    id: "oats",
    keywords: ["oats"],
    maxTokens: 3,
    exactNames: ["oats", "oat flakes"],
    baseBoost: 1400,
    exactBoost: 1000,
  },
  {
    id: "oatmeal",
    keywords: ["oatmeal"],
    maxTokens: 3,
    exactNames: ["oatmeal"],
    baseBoost: 1400,
    exactBoost: 1000,
  },

  // RICE
  {
    id: "rice",
    keywords: ["rice"],
    maxTokens: 3,
    exactNames: ["rice", "white rice", "brown rice"],
    baseBoost: 1400,
    exactBoost: 1000,
  },

  // EGGS
  {
    id: "eggs",
    keywords: ["egg"],
    maxTokens: 3,
    exactNames: ["egg", "eggs"],
    baseBoost: 1400,
    exactBoost: 1000,
  },

  // GREEK YOGURT / SKYR / YOGURT
  {
    id: "greek-yogurt",
    keywords: ["greek", "yogurt"],
    maxTokens: 4,
    exactNames: ["greek yogurt", "greek yoghurt"],
    baseBoost: 1500,
    exactBoost: 1200,
  },
  {
    id: "skyr",
    keywords: ["skyr"],
    maxTokens: 3,
    exactNames: ["skyr"],
    baseBoost: 1400,
    exactBoost: 1000,
  },
  {
    id: "yogurt",
    keywords: ["yogurt"],
    maxTokens: 3,
    exactNames: ["yogurt", "yoghurt"],
    baseBoost: 1000,
    exactBoost: 800,
  },

  // BANANA / APPLE / ORANGE (typical single fruits)
  {
    id: "banana",
    keywords: ["banana"],
    maxTokens: 2,
    exactNames: ["banana", "bananas"],
    baseBoost: 1100,
    exactBoost: 800,
  },
  {
    id: "apple",
    keywords: ["apple"],
    maxTokens: 2,
    exactNames: ["apple", "apples"],
    baseBoost: 1100,
    exactBoost: 800,
  },
  {
    id: "orange",
    keywords: ["orange"],
    maxTokens: 2,
    exactNames: ["orange", "oranges"],
    baseBoost: 1100,
    exactBoost: 800,
  },
];

const DISH_PENALTY_REGEX =
  /(noodle|soup|sauce|pizza|burger|tortelloni|lasagne|curry|ready meal|microwave|pot noodle)/;

/**
 * Compute extra score for “generic” ingredients so they float to the top
 * (e.g. mushrooms, chicken breast, oats, rice…).
 *
 * `nameNorm` and `brandNorm` must already be normalized
 * (lowercase, spaces instead of punctuation).
 */
export function computeGenericFoodBoost(
  nameNorm: string,
  brandNorm: string
): number {
  const tokens = nameNorm.split(" ").filter(Boolean);
  let boost = 0;

  for (const rule of GENERIC_RULES) {
    if (rule.maxTokens && tokens.length > rule.maxTokens) continue;

    const hasAllKeywords = rule.keywords.every((kw) =>
      nameNorm.includes(kw)
    );
    if (!hasAllKeywords) continue;

    boost += rule.baseBoost;

    if (rule.exactNames && rule.exactNames.includes(nameNorm)) {
      boost += rule.exactBoost ?? 0;
    }
  }

  // Global penalty: prepared dishes instead of raw ingredients.
  if (DISH_PENALTY_REGEX.test(nameNorm)) {
    boost -= 400;
  }

  return boost;
}
