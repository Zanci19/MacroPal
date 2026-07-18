/**
 * Parses a spoken food log ("3 fried eggs, a glass of milk, 2 slices of bread")
 * into structured items the food resolver can look up and portion.
 *
 * Everything here is pure so the messy natural-language handling stays testable
 * without a microphone or a network round-trip.
 */

export type VoiceUnit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "oz"
  | "slice"
  | "glass"
  | "cup"
  | "bowl"
  | "tbsp"
  | "tsp"
  | "handful"
  | "can"
  | "bottle"
  | "scoop"
  | "plate"
  | "packet"
  | "piece"
  | "serving";

export interface ParsedVoiceFood {
  /** The original segment, kept so the UI can show what was heard. */
  raw: string;
  quantity: number;
  /** null when the speaker gave no unit at all ("apple", "3 eggs"). */
  unit: VoiceUnit | null;
  /** The food text to search for, with quantity/unit/filler stripped. */
  query: string;
}

/**
 * Grams (or ml, treated 1:1) for one of each unit. `null` means the amount
 * depends on the food itself and is resolved later from its serving size or
 * the piece-weight table.
 */
export const UNIT_GRAMS: Record<VoiceUnit, number | null> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  oz: 28.35,
  slice: 30,
  glass: 240,
  cup: 240,
  bowl: 250,
  tbsp: 15,
  tsp: 5,
  handful: 30,
  can: 330,
  bottle: 500,
  scoop: 30,
  plate: 350,
  packet: 50,
  piece: null,
  serving: null,
};

/** Spoken unit variants → canonical unit. */
const UNIT_ALIASES: Record<string, VoiceUnit> = {
  g: "g",
  gram: "g",
  grams: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  slice: "slice",
  slices: "slice",
  glass: "glass",
  glasses: "glass",
  cup: "cup",
  cups: "cup",
  bowl: "bowl",
  bowls: "bowl",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  handful: "handful",
  handfuls: "handful",
  can: "can",
  cans: "can",
  tin: "can",
  tins: "can",
  bottle: "bottle",
  bottles: "bottle",
  scoop: "scoop",
  scoops: "scoop",
  plate: "plate",
  plates: "plate",
  packet: "packet",
  packets: "packet",
  pack: "packet",
  packs: "packet",
  piece: "piece",
  pieces: "piece",
  serving: "serving",
  servings: "serving",
  portion: "serving",
  portions: "serving",
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  couple: 2,
  few: 3,
  several: 3,
  dozen: 12,
  half: 0.5,
  quarter: 0.25,
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
};

/** Leading phrases dictation tends to produce that carry no food meaning. */
const LEADING_FILLER = [
  "i had",
  "i ate",
  "i drank",
  "i have had",
  "i also had",
  "also had",
  "add",
  "log",
  "then",
  "also",
  "plus",
  "and",
  "some",
  "a bit of",
  "a piece of",
  "with",
];

/** Splits the transcript into one segment per spoken food. */
export function splitTranscript(transcript: string): string[] {
  return transcript
    .replace(/\band\/or\b/gi, ",")
    .split(/\s*(?:,|;|\n|\band\b|\bplus\b|\balong with\b|\btogether with\b|&)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripLeadingFiller(text: string): string {
  let out = text.trim();
  let changed = true;
  // Loop so stacked filler ("and then also some rice") peels off fully.
  while (changed) {
    changed = false;
    for (const filler of LEADING_FILLER) {
      const re = new RegExp(`^${filler}\\b\\s*`, "i");
      if (re.test(out)) {
        out = out.replace(re, "").trim();
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Reads a quantity off the front of the token list.
 * Returns the value and how many tokens it consumed (0 = no quantity given).
 */
function readQuantity(tokens: string[]): { value: number; consumed: number } {
  if (tokens.length === 0) return { value: 1, consumed: 0 };

  const first = tokens[0];

  // "1/2", "3/4"
  const fractionMatch = first.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const denominator = Number(fractionMatch[2]);
    if (denominator !== 0) {
      return { value: Number(fractionMatch[1]) / denominator, consumed: 1 };
    }
  }

  if (UNICODE_FRACTIONS[first] !== undefined) {
    return { value: UNICODE_FRACTIONS[first], consumed: 1 };
  }

  // "2", "2.5"
  const numeric = first.match(/^(\d+(?:\.\d+)?)$/);
  if (numeric) {
    let value = Number(numeric[1]);
    let consumed = 1;
    // "1 and a half"
    if (
      tokens[1] === "and" &&
      (tokens[2] === "a" || tokens[2] === "an") &&
      tokens[3] === "half"
    ) {
      value += 0.5;
      consumed = 4;
    }
    return { value, consumed };
  }

  const word = NUMBER_WORDS[first];
  if (word !== undefined) {
    // "half a glass", "a couple of eggs" — the article is noise, drop it.
    if ((word === 0.5 || word === 0.25) && (tokens[1] === "a" || tokens[1] === "an")) {
      return { value: word, consumed: 2 };
    }
    // "a couple", "a few", "a dozen"
    if (word === 1 && tokens[1] && NUMBER_WORDS[tokens[1]] !== undefined) {
      const second = NUMBER_WORDS[tokens[1]];
      if (second >= 2) return { value: second, consumed: 2 };
    }
    // "one and a half"
    if (
      tokens[1] === "and" &&
      (tokens[2] === "a" || tokens[2] === "an") &&
      tokens[3] === "half"
    ) {
      return { value: word + 0.5, consumed: 4 };
    }
    return { value: word, consumed: 1 };
  }

  return { value: 1, consumed: 0 };
}

/** Turns a plain plural into its singular so it matches database entries. */
function singularize(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

function cleanQuery(text: string): string {
  return text
    .replace(/^(?:of|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses one segment. Returns null when nothing food-like is left.
 */
export function parseVoiceFoodSegment(segment: string): ParsedVoiceFood | null {
  const raw = segment.trim();
  if (!raw) return null;

  const cleaned = stripLeadingFiller(
    raw
      .toLowerCase()
      // Keep digits, letters, slashes (fractions), dots (2.5) and fraction glyphs.
      .replace(/[^a-z0-9./½⅓⅔¼¾\s-]/g, " ")
  );
  if (!cleaned) return null;

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const { value: quantity, consumed } = readQuantity(tokens);
  let rest = tokens.slice(consumed);

  // "500g rice" — unit glued to the number and split off as its own token.
  if (consumed === 0 && rest.length > 0) {
    const glued = rest[0].match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
    if (glued && UNIT_ALIASES[glued[2]]) {
      const unit = UNIT_ALIASES[glued[2]];
      const query = cleanQuery(rest.slice(1).map(singularize).join(" "));
      if (!query) return null;
      return { raw, quantity: Number(glued[1]), unit, query };
    }
  }

  let unit: VoiceUnit | null = null;
  if (rest.length > 0) {
    const candidate = UNIT_ALIASES[rest[0]];
    // A unit alone isn't a food — "a cup" with nothing after it is not useful,
    // but "a cup of rice" is. Only treat it as a unit when a food follows.
    if (candidate && rest.length > 1) {
      unit = candidate;
      rest = rest.slice(1);
    }
  }

  // Drop the connecting "of" ("2 slices of bread").
  if (rest[0] === "of") rest = rest.slice(1);

  if (rest.length === 0) return null;

  // Only singularize when a count was actually spoken, so "oats"/"grapes"
  // (foods that are plural by nature) survive intact.
  const shouldSingularize = quantity !== 1 || consumed > 0;
  const query = cleanQuery(
    rest.map((token) => (shouldSingularize ? singularize(token) : token)).join(" ")
  );

  // A measure with no food after it ("a glass") isn't something we can log.
  if (!query || /^\d+$/.test(query) || UNIT_ALIASES[query] !== undefined) return null;

  return { raw, quantity, unit, query };
}

/**
 * Parses a full spoken transcript into food items, in the order spoken.
 */
export function parseVoiceFoodTranscript(transcript: string): ParsedVoiceFood[] {
  if (!transcript || !transcript.trim()) return [];
  return splitTranscript(transcript)
    .map(parseVoiceFoodSegment)
    .filter((item): item is ParsedVoiceFood => item !== null);
}

/**
 * Typical weight in grams of one "piece" of common whole foods, used when the
 * speaker counted items ("3 eggs") and the matched food has no serving size.
 * Keys are matched as whole words against the resolved food name.
 */
const PIECE_WEIGHTS_G: Array<{ match: RegExp; grams: number }> = [
  { match: /\begg\b/, grams: 50 },
  { match: /\bbread|toast\b/, grams: 30 },
  { match: /\bapple\b/, grams: 180 },
  { match: /\bbanana\b/, grams: 120 },
  { match: /\borange\b/, grams: 150 },
  { match: /\bpear\b/, grams: 180 },
  { match: /\bpeach\b/, grams: 150 },
  { match: /\bkiwi\b/, grams: 75 },
  { match: /\bapricot\b/, grams: 35 },
  { match: /\bmandarin|clementine|tangerine\b/, grams: 90 },
  { match: /\bplum\b/, grams: 65 },
  { match: /\bfig\b/, grams: 50 },
  { match: /\bdate\b/, grams: 8 },
  { match: /\bavocado\b/, grams: 150 },
  { match: /\btomato\b/, grams: 120 },
  { match: /\bpotato\b/, grams: 170 },
  { match: /\bcarrot\b/, grams: 60 },
  { match: /\bonion\b/, grams: 110 },
  { match: /\bcucumber\b/, grams: 200 },
  { match: /\bpepper\b/, grams: 120 },
  { match: /\bchicken breast\b/, grams: 170 },
  { match: /\bsausage\b/, grams: 60 },
  { match: /\bburger|hamburger\b/, grams: 220 },
  { match: /\bpizza\b/, grams: 110 },
  { match: /\bcookie|biscuit\b/, grams: 15 },
  { match: /\bbar\b/, grams: 40 },
  { match: /\byogurt\b/, grams: 150 },
  { match: /\blemon\b/, grams: 85 },
];

const DEFAULT_PIECE_GRAMS = 100;

/** Estimated grams for one piece of the named food. */
export function pieceWeightForFood(foodName: string): number {
  const name = foodName.toLowerCase();
  const hit = PIECE_WEIGHTS_G.find((entry) => entry.match.test(name));
  return hit ? hit.grams : DEFAULT_PIECE_GRAMS;
}

/**
 * Resolves a parsed item to grams.
 *
 * `servingGrams` is the matched food's declared serving size. It is used only
 * when the speaker actually said "serving"/"portion" — for a bare count ("3
 * eggs") the piece-weight table is far more reliable, because most database
 * entries declare a nominal 100 g serving that has nothing to do with the
 * weight of one physical item.
 */
export function estimateGrams(
  item: ParsedVoiceFood,
  foodName: string,
  servingGrams?: number | null
): number {
  const qty = item.quantity > 0 ? item.quantity : 1;

  if (item.unit) {
    const perUnit = UNIT_GRAMS[item.unit];
    if (perUnit !== null) return Math.round(qty * perUnit);
    if (item.unit === "serving" && servingGrams && servingGrams > 0) {
      return Math.round(qty * servingGrams);
    }
  }

  // A bare count, "piece", or a serving with no declared size: one whole item.
  return Math.round(qty * pieceWeightForFood(foodName));
}
