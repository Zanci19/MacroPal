import { describe, it, expect, vi } from "vitest";
import {
  findBestFoodMatch,
  resolveVoiceFood,
  normalizeForMatch,
  type MatchableFood,
} from "./voiceFoodResolver";
import basicFoods from "../data/basicFoods.json";

const LOCAL = basicFoods as MatchableFood[];

const match = (query: string) => findBestFoodMatch(LOCAL, query);

describe("normalizeForMatch", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeForMatch("Egg, whole (raw)")).toBe("egg whole raw");
  });
});

describe("findBestFoodMatch against the bundled food database", () => {
  it("matches a plain food name", () => {
    expect(match("apple")?.food.product_name).toMatch(/apple/i);
    expect(match("banana")?.food.product_name).toMatch(/banana/i);
  });

  it("matches a food described with a preparation word", () => {
    expect(match("fried egg")?.food.product_name).toMatch(/egg/i);
    expect(match("boiled egg")?.food.product_name).toMatch(/egg/i);
  });

  it("matches multi-word foods", () => {
    expect(match("chicken breast")?.food.product_name).toMatch(/chicken breast/i);
    expect(match("peanut butter")?.food.product_name).toMatch(/peanut butter/i);
  });

  it("matches singular and plural forms alike", () => {
    expect(match("egg")?.food.product_name).toMatch(/egg/i);
    expect(match("eggs")?.food.product_name).toMatch(/egg/i);
    expect(match("almonds")?.food.product_name).toMatch(/almond/i);
  });

  it("matches bread", () => {
    expect(match("bread")?.food.product_name).toMatch(/bread/i);
  });

  it("matches milk", () => {
    expect(match("milk")?.food.product_name).toMatch(/milk/i);
  });

  it("reports high confidence for an exact name", () => {
    const result = match("banana");
    expect(result?.confidence).toBe("high");
  });

  it("returns null when nothing shares a token", () => {
    expect(match("zzzzqqq")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(match("")).toBeNull();
    expect(match("   ")).toBeNull();
  });

  it("ignores entries with no name", () => {
    expect(findBestFoodMatch([{ code: "x", product_name: "" }], "apple")).toBeNull();
  });
});

describe("findBestFoodMatch ranking preferences", () => {
  const foods: MatchableFood[] = [
    { code: "generic", product_name: "Egg, whole, raw" },
    { code: "branded", product_name: "Creme Egg Chocolate Bar", brands: "Cadbury" },
    { code: "recipe", product_name: "Egg salad with mayonnaise and herbs" },
  ];

  it("prefers the generic whole food over a branded product", () => {
    expect(findBestFoodMatch(foods, "egg")?.food.code).toBe("generic");
  });

  it("prefers the generic whole food over a recipe", () => {
    const result = findBestFoodMatch(foods, "eggs");
    expect(result?.food.code).toBe("generic");
  });

  it("penalises multipack packaging names", () => {
    const withPack: MatchableFood[] = [
      { code: "single", product_name: "Yogurt" },
      { code: "pack", product_name: "Yogurt 4 x 125g" },
    ];
    expect(findBestFoodMatch(withPack, "yogurt")?.food.code).toBe("single");
  });
});

describe("resolveVoiceFood", () => {
  it("uses the local match without calling remote when confidence is high", async () => {
    const searchRemote = vi.fn().mockResolvedValue([]);
    const result = await resolveVoiceFood("banana", { localFoods: LOCAL, searchRemote });

    expect(result?.food.product_name).toMatch(/banana/i);
    expect(searchRemote).not.toHaveBeenCalled();
  });

  it("falls back to remote search when there is no local match", async () => {
    const remoteHit = { code: "off-1", product_name: "Chicken Tikka Masala" };
    const searchRemote = vi.fn().mockResolvedValue([remoteHit]);

    const result = await resolveVoiceFood("chicken tikka masala", {
      localFoods: [] as MatchableFood[],
      searchRemote,
    });

    expect(searchRemote).toHaveBeenCalledWith("chicken tikka masala");
    expect(result?.food.code).toBe("off-1");
  });

  it("keeps the local match when the remote match is not clearly better", async () => {
    const localFoods: MatchableFood[] = [{ code: "local-1", product_name: "Hummus" }];
    const searchRemote = vi
      .fn()
      .mockResolvedValue([{ code: "off-1", product_name: "Hummus" }]);

    const result = await resolveVoiceFood("hummus", { localFoods, searchRemote });
    expect(result?.food.code).toBe("local-1");
  });

  it("falls back to the local match when remote search throws", async () => {
    const localFoods: MatchableFood[] = [{ code: "local-1", product_name: "Hummus dip" }];
    const searchRemote = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await resolveVoiceFood("hummus", { localFoods, searchRemote });
    expect(result?.food.code).toBe("local-1");
  });

  it("returns null when neither source matches", async () => {
    const searchRemote = vi.fn().mockResolvedValue([]);
    const result = await resolveVoiceFood("zzzzqqq", { localFoods: [], searchRemote });
    expect(result).toBeNull();
  });

  it("works with no remote search configured", async () => {
    const result = await resolveVoiceFood("apple", { localFoods: LOCAL });
    expect(result?.food.product_name).toMatch(/apple/i);
  });
});
