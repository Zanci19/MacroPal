import { describe, it, expect } from "vitest";
import {
  rankFoods,
  scoreFood,
  tokenMatchStrength,
  expandToken,
  containsAtWordStart,
  TIER,
  type SearchableFood,
} from "./foodSearch";
import basicFoods from "../data/basicFoods.json";

const FOODS = basicFoods as SearchableFood[];

const namesFor = (query: string, limit = 5) =>
  rankFoods(FOODS, query)
    .results.slice(0, limit)
    .map((f) => f.product_name ?? "");

describe("substring false positives (the reported 'wrong results' bug)", () => {
  it("'oat' does not match 'Goat cheese'", () => {
    const names = namesFor("oat", 20);
    expect(names).not.toContain("Goat cheese");
    expect(names.some((n) => n.startsWith("Oats"))).toBe(true);
  });

  it("'egg' ranks the plain egg above a dish containing egg", () => {
    const names = namesFor("egg", 10);
    const plain = names.findIndex((n) => n.startsWith("Egg,"));
    const dish = names.findIndex((n) => n === "Fried rice with egg");
    expect(plain).toBeGreaterThanOrEqual(0);
    expect(dish === -1 || plain < dish).toBe(true);
  });

  it("a mid-word match is rejected outright, not merely down-ranked", () => {
    const goat: SearchableFood = { product_name: "Goat cheese" };
    expect(scoreFood(goat, "oat").tier).toBe(TIER.NONE);
  });

  it("still matches a genuine prefix, so type-ahead works", () => {
    expect(tokenMatchStrength(["chicken", "breast"], expandToken("chick"))).toBe(1);
    expect(tokenMatchStrength(["chicken", "breast"], expandToken("chicken"))).toBe(2);
    expect(tokenMatchStrength(["goat", "cheese"], expandToken("oat"))).toBe(0);
  });

  it("anchors phrase matches to a word start", () => {
    expect(containsAtWordStart("goat cheese", "oat")).toBe(false);
    expect(containsAtWordStart("hamburger single patty", "ham")).toBe(true);
    expect(containsAtWordStart("brown rice cooked", "brown rice")).toBe(true);
  });
});

describe("plural handling", () => {
  it("matches across singular and plural in both directions", () => {
    expect(tokenMatchStrength(["eggs"], expandToken("egg"))).toBe(2);
    expect(tokenMatchStrength(["egg"], expandToken("eggs"))).toBe(2);
    expect(tokenMatchStrength(["berries"], expandToken("berry"))).toBe(2);
  });
});

describe("tier dominance — the invariant that makes ranking predictable", () => {
  it("no bonus can lift a worse match above a better one", () => {
    // A branded, long, multipack name in a HIGHER tier must still beat a
    // short unbranded generic in a LOWER tier, however good its bonuses are.
    const betterMatchWorstBonuses: SearchableFood = {
      product_name: "Chicken breast 4 x 250 g with sauce",
      brands: "MegaBrand",
    };
    const worseMatchBestBonuses: SearchableFood = { product_name: "Chicken" };

    const better = scoreFood(betterMatchWorstBonuses, "chicken breast");
    const worse = scoreFood(worseMatchBestBonuses, "chicken breast");

    expect(better.tier).toBeGreaterThan(worse.tier);
    expect(better.score).toBeGreaterThan(worse.score);
  });

  it("keeps every bonus inside one tier band", () => {
    for (const food of FOODS) {
      for (const q of ["egg", "rice", "chicken breast", "greek yogurt"]) {
        const { score, tier } = scoreFood(food, q);
        if (tier === TIER.NONE) continue;
        const offset = score - tier;
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThan(100);
      }
    }
  });
});

describe("generic foods outrank prepared dishes", () => {
  it("'rice' puts plain rice first", () => {
    expect(namesFor("rice", 3).some((n) => /^(White|Brown) rice/.test(n))).toBe(true);
    expect(namesFor("rice", 1)[0]).not.toBe("Fried rice with egg");
  });

  it("an exact phrase beats a reordered one", () => {
    const names = namesFor("brown rice", 5);
    expect(names[0]).toMatch(/^Brown rice/);
  });
});

describe("no silent widening", () => {
  it("a query with no match returns nothing rather than junk", () => {
    const { results } = rankFoods(FOODS, "zzzzqqq");
    expect(results).toHaveLength(0);
  });

  it("does not pad a precise query out to five results", () => {
    // The old code widened whenever the strict pass returned < 5 items.
    const { results, relaxed } = rankFoods(FOODS, "brown rice");
    expect(relaxed).toBe(false);
    for (const food of results) {
      const words = (food.product_name ?? "").toLowerCase();
      expect(words.includes("rice")).toBe(true);
    }
  });

  it("flags relaxed results instead of presenting them as hits", () => {
    const foods: SearchableFood[] = [{ product_name: "Chicken breast" }];
    const { results, relaxed } = rankFoods(foods, "chicken tikka masala");
    expect(relaxed).toBe(true);
    expect(results).toHaveLength(1);
  });
});

describe("exact and code matches win", () => {
  it("an exact name match ranks first", () => {
    const foods: SearchableFood[] = [
      { product_name: "Oats, rolled (dry)" },
      { product_name: "Oats" },
    ];
    expect(rankFoods(foods, "oats").results[0].product_name).toBe("Oats");
  });

  it("a barcode match outranks everything", () => {
    const foods: SearchableFood[] = [
      { product_name: "Oats", code: "1111111111111" },
      { product_name: "Something else", code: "5000112637922" },
    ];
    expect(rankFoods(foods, "5000112637922").results[0].product_name).toBe(
      "Something else"
    );
  });
});
