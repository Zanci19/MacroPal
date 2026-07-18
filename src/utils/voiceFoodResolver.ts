/**
 * Picks the single best food match for a spoken phrase.
 *
 * This is deliberately separate from the AddFood search box: that one ranks a
 * page of results for a human to choose from, whereas voice logging needs one
 * confident answer per item and should prefer generic whole foods ("Egg, whole,
 * raw") over branded products ("Cadbury Creme Egg").
 */

/** The minimum shape the matcher needs; callers pass their own richer type. */
export interface MatchableFood {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
}

export type MatchConfidence = "high" | "medium" | "low";

export interface FoodMatch<T extends MatchableFood> {
  food: T;
  score: number;
  confidence: MatchConfidence;
}

/** Score below which a match is too speculative to add without review. */
const LOW_CONFIDENCE_SCORE = 260;
const HIGH_CONFIDENCE_SCORE = 700;

/** Preparation words that describe a food but rarely appear in database names. */
const PREPARATION_WORDS = new Set([
  "fried",
  "boiled",
  "scrambled",
  "poached",
  "grilled",
  "baked",
  "roasted",
  "steamed",
  "raw",
  "cooked",
  "fresh",
  "plain",
  "whole",
  "large",
  "small",
  "medium",
  "hot",
  "cold",
]);

/**
 * Grams in a food's declared serving size, or null when it isn't a weight
 * (millilitres are treated 1:1, matching how the rest of the app scales them).
 */
export function parseServingGrams(servingSize?: string): number | null {
  if (!servingSize) return null;
  const match = servingSize.match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeForMatch(text: string): string[] {
  return normalizeForMatch(text).split(" ").filter(Boolean);
}

/** Variants of a token so "eggs" matches "egg" and vice versa. */
function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token.length > 3 && token.endsWith("s")) variants.add(token.slice(0, -1));
  if (token.length > 4 && token.endsWith("es")) variants.add(token.slice(0, -2));
  if (token.length > 4 && token.endsWith("ies")) {
    variants.add(`${token.slice(0, -3)}y`);
  }
  variants.add(`${token}s`);
  return Array.from(variants);
}

/**
 * Database names are often "Food, qualifier" ("Apple, raw"). The head is what
 * the speaker almost always said, so compare against it directly.
 */
function headOfName(name: string): string {
  const [head] = name.split(",");
  return normalizeForMatch(head || name);
}

function looksLikeRecipe(name: string): boolean {
  return /\b(with|recipe|flavou?red|sauce|mix|salad|cookies|cake|bar|drink|juice|smoothie|spread|pie|soup)\b/.test(
    name
  );
}

function scoreFood<T extends MatchableFood>(food: T, query: string): number {
  const nameRaw = food.product_name || "";
  if (!nameRaw.trim()) return -Infinity;

  const normalizedQuery = normalizeForMatch(query);
  const queryTokens = tokenizeForMatch(query);
  if (queryTokens.length === 0) return -Infinity;

  const nameNorm = normalizeForMatch(nameRaw);
  const nameHead = headOfName(nameRaw);
  const brandNorm = normalizeForMatch(food.brands || "");
  const haystack = `${nameNorm} ${brandNorm}`.trim();

  let score = 0;

  if (nameNorm === normalizedQuery) score += 1200;
  else if (nameHead === normalizedQuery) score += 1000;
  else if (nameHead.startsWith(normalizedQuery)) score += 700;
  else if (nameNorm.startsWith(normalizedQuery)) score += 600;
  else if (haystack.includes(normalizedQuery)) score += 380;

  // Token coverage, ignoring preparation words the database rarely carries.
  const meaningful = queryTokens.filter((t) => !PREPARATION_WORDS.has(t));
  const scoringTokens = meaningful.length > 0 ? meaningful : queryTokens;
  let matched = 0;
  for (const token of scoringTokens) {
    if (tokenVariants(token).some((v) => haystack.includes(v))) matched += 1;
  }
  if (matched === 0) return -Infinity;

  score += matched * 150;
  score += (matched / scoringTokens.length) * 220;

  // Preparation words are a weak signal, but a real one when they do match.
  for (const token of queryTokens) {
    if (PREPARATION_WORDS.has(token) && haystack.includes(token)) score += 40;
  }

  // Prefer generic, concise entries — the spoken word is almost never a brand.
  if (!brandNorm) score += 130;
  const nameTokenCount = tokenizeForMatch(nameNorm).length;
  if (nameTokenCount <= 2) score += 70;
  else if (nameTokenCount <= 4) score += 25;
  else score -= nameTokenCount * 4;

  if (looksLikeRecipe(nameNorm) && scoringTokens.length <= 2) score -= 200;
  // Multipacks and sized products are packaging noise, not what was spoken.
  if (/\b\d+\s*(x|pack)\b/.test(nameNorm)) score -= 60;

  return score;
}

function confidenceFor(score: number): MatchConfidence {
  if (score >= HIGH_CONFIDENCE_SCORE) return "high";
  if (score >= LOW_CONFIDENCE_SCORE) return "medium";
  return "low";
}

/** Best match for `query` among `foods`, or null when nothing matches at all. */
export function findBestFoodMatch<T extends MatchableFood>(
  foods: T[],
  query: string
): FoodMatch<T> | null {
  let best: FoodMatch<T> | null = null;

  for (const food of foods) {
    const score = scoreFood(food, query);
    if (score === -Infinity) continue;
    if (!best || score > best.score) {
      best = { food, score, confidence: confidenceFor(score) };
    }
  }

  return best;
}

export interface ResolveOptions<T extends MatchableFood> {
  /** Locally bundled + user-created foods, searched first and offline-safe. */
  localFoods: T[];
  /** Optional remote lookup, used only when the local match is weak. */
  searchRemote?: (query: string) => Promise<T[]>;
}

/**
 * Resolves a spoken food phrase, falling back to remote search when the local
 * database has nothing convincing.
 */
export async function resolveVoiceFood<T extends MatchableFood>(
  query: string,
  { localFoods, searchRemote }: ResolveOptions<T>
): Promise<FoodMatch<T> | null> {
  const local = findBestFoodMatch(localFoods, query);
  if (local && local.confidence === "high") return local;

  if (!searchRemote) return local;

  try {
    const remoteFoods = await searchRemote(query);
    const remote = findBestFoodMatch(remoteFoods, query);
    if (!remote) return local;
    if (!local) return remote;
    // Local generic foods are the better answer on a tie — they carry cleaner
    // per-100g data than arbitrary branded products.
    return remote.score > local.score + 80 ? remote : local;
  } catch (error) {
    console.warn("Voice food remote search failed", error);
    return local;
  }
}
