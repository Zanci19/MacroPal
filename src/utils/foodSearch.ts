/**
 * Relevance ranking for food search.
 *
 * The previous implementation lived inline in AddFood.tsx and stacked three
 * independent scorers whose magic numbers overlapped: query-relevance terms
 * topped out around 1600, while the generic-food boost could reach 3000. A
 * boost meant only to prefer "chicken breast" over "chicken breast ready meal"
 * could therefore outweigh whether the item matched the query at all, so no
 * one could predict what landed first.
 *
 * The model here is deliberately boring:
 *
 *   score = TIER + bonus,  where 0 <= bonus < 100 and tiers are 100 apart.
 *
 * A tier expresses HOW the item matched (exact name, prefix, all tokens, ...).
 * Bonuses only reorder items *within* a tier. Because a bonus can never span
 * the gap between two tiers, a better-matching item always outranks a
 * worse-matching one, whatever the bonuses say. That single invariant is what
 * makes the ranking predictable, and it is asserted directly in the tests.
 */

import { computeGenericFoodBoost } from "./genericFoodBoosts";

export interface SearchableFood {
  product_name?: string;
  brands?: string;
  code?: string;
}

/** Tiers are 100 apart so no combination of bonuses can reorder across them. */
export const TIER = {
  EXACT_CODE: 900,
  EXACT_NAME: 800,
  NAME_PREFIX: 700,
  PHRASE_IN_NAME: 600,
  ALL_TOKENS_EXACT: 500,
  ALL_TOKENS_PREFIX: 400,
  PARTIAL: 300,
  NONE: -1,
} as const;

/** Items scoring below this never appear in a strict search. */
export const MIN_STRICT_TIER = TIER.ALL_TOKENS_PREFIX;

export const normalizeText = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();

export const tokenize = (text: string): string[] =>
  normalizeText(text).split(" ").filter(Boolean);

/**
 * Singular/plural variants of a token, so "eggs" matches an "egg" product.
 * Order matters only for readability; callers treat these as a set.
 */
export const expandToken = (token: string): string[] => {
  const t = token.trim().toLowerCase();
  if (!t) return [];
  const variants = new Set<string>([t]);
  // Strip a plural suffix: "eggs" -> "egg", "berries" -> "berry".
  if (t.endsWith("ies") && t.length > 4) variants.add(`${t.slice(0, -3)}y`);
  if (t.endsWith("es") && t.length > 4) variants.add(t.slice(0, -2));
  if (t.endsWith("s") && t.length > 3) variants.add(t.slice(0, -1));
  // And add one, so a singular query matches a plural product name. "berry"
  // pluralises to "berries", not "berrys", so the -y form needs its own rule.
  if (t.endsWith("y") && t.length > 2) variants.add(`${t.slice(0, -1)}ies`);
  else variants.add(`${t}s`);
  if (/(s|x|z|ch|sh)$/.test(t)) variants.add(`${t}es`);
  return Array.from(variants);
};

/**
 * Whether `phrase` occurs in `text` starting at a word boundary.
 *
 * Plain `text.includes(phrase)` reintroduces the substring bug at the phrase
 * level: "goat cheese".includes("oat") is true, so a query for "oat" would
 * score goat cheese as a strong phrase match. Anchoring to a word start keeps
 * type-ahead ("ham" -> "hamburger") while rejecting matches that begin
 * mid-word.
 */
export const containsAtWordStart = (text: string, phrase: string): boolean => {
  if (!phrase) return false;
  return ` ${text}`.includes(` ${phrase}`);
};

const WORD_MATCH = 2;
const PREFIX_MATCH = 1;
const NO_MATCH = 0;

/**
 * How strongly a query token matches a set of product words.
 *
 * This is the fix for the single biggest precision bug in the old ranking,
 * which tested `haystack.includes(token)` on the joined string. Plain
 * substring matching meant "egg" matched "eggplant", "ham" matched "graham
 * crackers" and "oat" matched "goat cheese" -- all scored as full matches.
 *
 * A whole word (or its plural form) is a strong match. A genuine prefix is a
 * weak one, which keeps type-ahead working -- "chick" still finds "chicken" --
 * while ranking "eggplant" strictly below "eggs" for the query "egg".
 */
export const tokenMatchStrength = (
  productWords: string[],
  variants: string[]
): number => {
  let best = NO_MATCH;
  for (const word of productWords) {
    for (const variant of variants) {
      if (word === variant) return WORD_MATCH;
      if (variant.length >= 3 && word.startsWith(variant)) best = PREFIX_MATCH;
    }
  }
  return best;
};

/**
 * Within-tier preferences, bounded to 0..99 so tiers stay dominant.
 * Everything here is a tiebreaker, never a verdict.
 */
const computeBonus = (
  food: SearchableFood,
  nameNorm: string,
  brandNorm: string
): number => {
  let bonus = 0;

  // Prefer generic whole foods over branded products. The underlying rules
  // return roughly 0..3000; rescaled to 0..40 it informs ordering without
  // being able to overturn a tier.
  const raw = computeGenericFoodBoost(nameNorm, brandNorm);
  if (raw > 0) bonus += Math.min(40, Math.round((raw / 3000) * 40));

  // An unbranded entry is usually the generic one people want.
  if (!brandNorm) bonus += 15;

  // Shorter names are more likely to be the plain ingredient.
  const wordCount = tokenize(nameNorm).length;
  if (wordCount <= 2) bonus += 20;
  else if (wordCount <= 4) bonus += 10;

  // Multipacks and pack sizes are rarely what someone is logging.
  if (/\b(\d+\s*x\s*\d+|\d+x)\b/.test(nameNorm)) bonus -= 10;
  if (/\b\d+\s*(kg|g|ml|l)\b/.test(nameNorm)) bonus -= 5;

  // Prepared dishes shouldn't beat the ingredient itself.
  if (
    /\b(with|and|recipe|recipes|flavou?r|flavou?red|sauce|mix|salad|cookies|cake|bar|drink|juice|smoothie|ketchup|spread)\b/.test(
      nameNorm
    )
  ) {
    bonus -= 15;
  }

  return Math.max(0, Math.min(99, bonus + 40));
};

export interface ScoredFood<T extends SearchableFood> {
  food: T;
  score: number;
  tier: number;
}

export const scoreFood = <T extends SearchableFood>(
  food: T,
  query: string
): ScoredFood<T> => {
  const nameNorm = normalizeText(food.product_name || "");
  const brandNorm = normalizeText(food.brands || "");
  const codeNorm = normalizeText(food.code || "");
  const queryNorm = normalizeText(query);

  if (!nameNorm && !codeNorm) {
    return { food, score: TIER.NONE, tier: TIER.NONE };
  }

  const queryTokens = tokenize(query);
  // Brand words count toward matching so "alpro soya" finds a branded item,
  // but the product name alone drives the phrase-level tiers.
  const productWords = [...tokenize(nameNorm), ...tokenize(brandNorm)];

  let tier: number;

  if (codeNorm && codeNorm === queryNorm) {
    tier = TIER.EXACT_CODE;
  } else if (nameNorm === queryNorm) {
    tier = TIER.EXACT_NAME;
  } else if (queryNorm && nameNorm.startsWith(queryNorm)) {
    tier = TIER.NAME_PREFIX;
  } else if (queryNorm && containsAtWordStart(nameNorm, queryNorm)) {
    tier = TIER.PHRASE_IN_NAME;
  } else {
    const strengths = queryTokens.map((token) =>
      tokenMatchStrength(productWords, expandToken(token))
    );
    if (strengths.length === 0 || strengths.some((s) => s === NO_MATCH)) {
      // Not every query token is present. Partial matches are kept but ranked
      // below anything complete, and excluded entirely from a strict search.
      const matched = strengths.filter((s) => s > NO_MATCH).length;
      tier = matched > 0 ? TIER.PARTIAL : TIER.NONE;
    } else if (strengths.every((s) => s === WORD_MATCH)) {
      tier = TIER.ALL_TOKENS_EXACT;
    } else {
      tier = TIER.ALL_TOKENS_PREFIX;
    }
  }

  if (tier === TIER.NONE) return { food, score: TIER.NONE, tier };

  return { food, score: tier + computeBonus(food, nameNorm, brandNorm), tier };
};

export interface RankResult<T extends SearchableFood> {
  results: T[];
  /**
   * True when nothing matched strictly and these are best-effort near matches,
   * so the UI can say so instead of silently presenting them as hits.
   */
  relaxed: boolean;
}

/**
 * Rank foods for a query.
 *
 * The old code widened its filter whenever the strict pass returned fewer than
 * five items, which meant a precise query that legitimately had two good
 * answers got padded out with junk -- and did so silently. Relaxation now
 * happens only when the strict pass returns *nothing*, and it is reported to
 * the caller rather than hidden.
 */
export const rankFoods = <T extends SearchableFood>(
  foods: T[],
  query: string
): RankResult<T> => {
  const scored = foods
    .map((food) => scoreFood(food, query))
    .filter((entry) => entry.tier !== TIER.NONE);

  const byScore = (a: ScoredFood<T>, b: ScoredFood<T>) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.food.product_name || "").localeCompare(b.food.product_name || "");
  };

  const strict = scored.filter((entry) => entry.tier >= MIN_STRICT_TIER);
  if (strict.length > 0) {
    return { results: strict.sort(byScore).map((e) => e.food), relaxed: false };
  }

  return { results: scored.sort(byScore).map((e) => e.food), relaxed: true };
};
