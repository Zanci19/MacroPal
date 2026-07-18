import { describe, it, expect } from "vitest";
import {
  parseVoiceFoodTranscript,
  parseVoiceFoodSegment,
  splitTranscript,
  estimateGrams,
  pieceWeightForFood,
} from "./voiceFoodParser";

describe("splitTranscript", () => {
  it("splits on commas", () => {
    expect(splitTranscript("eggs, milk, bread")).toEqual(["eggs", "milk", "bread"]);
  });

  it("splits on spoken connectors", () => {
    expect(splitTranscript("eggs and milk plus bread")).toEqual([
      "eggs",
      "milk",
      "bread",
    ]);
  });

  it("ignores empty segments from trailing punctuation", () => {
    expect(splitTranscript("eggs, milk,")).toEqual(["eggs", "milk"]);
  });
});

describe("parseVoiceFoodSegment", () => {
  it("parses a digit quantity with a plural food", () => {
    expect(parseVoiceFoodSegment("3 fried eggs")).toEqual({
      raw: "3 fried eggs",
      quantity: 3,
      unit: null,
      query: "fried egg",
    });
  });

  it("parses a spelled-out quantity", () => {
    const result = parseVoiceFoodSegment("three fried eggs");
    expect(result?.quantity).toBe(3);
    expect(result?.query).toBe("fried egg");
  });

  it("parses a unit with 'of'", () => {
    expect(parseVoiceFoodSegment("2 slices of bread")).toMatchObject({
      quantity: 2,
      unit: "slice",
      query: "bread",
    });
  });

  it("treats a bare article as quantity one", () => {
    expect(parseVoiceFoodSegment("a glass of milk")).toMatchObject({
      quantity: 1,
      unit: "glass",
      query: "milk",
    });
  });

  it("parses a food with no quantity at all", () => {
    expect(parseVoiceFoodSegment("apple")).toMatchObject({
      quantity: 1,
      unit: null,
      query: "apple",
    });
  });

  it("keeps naturally-plural foods intact when no count was spoken", () => {
    expect(parseVoiceFoodSegment("oats")?.query).toBe("oats");
  });

  it("parses explicit weights", () => {
    expect(parseVoiceFoodSegment("200 grams of chicken breast")).toMatchObject({
      quantity: 200,
      unit: "g",
      query: "chicken breast",
    });
  });

  it("parses a weight glued to the number", () => {
    expect(parseVoiceFoodSegment("500g rice")).toMatchObject({
      quantity: 500,
      unit: "g",
      query: "rice",
    });
  });

  it("parses fractions", () => {
    expect(parseVoiceFoodSegment("1/2 cup of rice")).toMatchObject({
      quantity: 0.5,
      unit: "cup",
      query: "rice",
    });
  });

  it("parses 'half a' phrasing", () => {
    expect(parseVoiceFoodSegment("half a glass of milk")).toMatchObject({
      quantity: 0.5,
      unit: "glass",
      query: "milk",
    });
  });

  it("parses 'one and a half'", () => {
    expect(parseVoiceFoodSegment("one and a half cups of rice")).toMatchObject({
      quantity: 1.5,
      unit: "cup",
      query: "rice",
    });
  });

  it("parses 'a couple of'", () => {
    expect(parseVoiceFoodSegment("a couple of eggs")).toMatchObject({
      quantity: 2,
      query: "egg",
    });
  });

  it("strips leading dictation filler", () => {
    expect(parseVoiceFoodSegment("i had some rice")?.query).toBe("rice");
  });

  it("does not treat a lone unit as a food", () => {
    expect(parseVoiceFoodSegment("a glass")).toBeNull();
  });

  it("returns null for empty or numeric-only input", () => {
    expect(parseVoiceFoodSegment("")).toBeNull();
    expect(parseVoiceFoodSegment("   ")).toBeNull();
    expect(parseVoiceFoodSegment("42")).toBeNull();
  });

  it("handles decimal quantities", () => {
    expect(parseVoiceFoodSegment("2.5 slices of bread")).toMatchObject({
      quantity: 2.5,
      unit: "slice",
    });
  });
});

describe("parseVoiceFoodTranscript", () => {
  it("parses the full multi-food example", () => {
    const result = parseVoiceFoodTranscript(
      "3 fried eggs, glass of milk, 2 slices of bread, apple"
    );
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ quantity: 3, unit: null, query: "fried egg" });
    expect(result[1]).toMatchObject({ quantity: 1, unit: "glass", query: "milk" });
    expect(result[2]).toMatchObject({ quantity: 2, unit: "slice", query: "bread" });
    expect(result[3]).toMatchObject({ quantity: 1, unit: null, query: "apple" });
  });

  it("handles a conversational transcript", () => {
    const result = parseVoiceFoodTranscript(
      "I had two eggs and a bowl of oatmeal plus 250ml orange juice"
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ quantity: 2, query: "egg" });
    expect(result[1]).toMatchObject({ quantity: 1, unit: "bowl", query: "oatmeal" });
    expect(result[2]).toMatchObject({ quantity: 250, unit: "ml", query: "orange juice" });
  });

  it("returns an empty list for empty input", () => {
    expect(parseVoiceFoodTranscript("")).toEqual([]);
    expect(parseVoiceFoodTranscript("   ")).toEqual([]);
  });

  it("drops unparseable segments but keeps the rest", () => {
    const result = parseVoiceFoodTranscript("apple, , 42, milk");
    expect(result.map((r) => r.query)).toEqual(["apple", "milk"]);
  });
});

describe("estimateGrams", () => {
  const item = (over: Partial<ReturnType<typeof parseVoiceFoodSegment>> = {}) =>
    ({ raw: "x", quantity: 1, unit: null, query: "x", ...over } as NonNullable<
      ReturnType<typeof parseVoiceFoodSegment>
    >);

  it("uses exact grams for weight units", () => {
    expect(estimateGrams(item({ quantity: 200, unit: "g" }), "rice")).toBe(200);
    expect(estimateGrams(item({ quantity: 1.5, unit: "kg" }), "rice")).toBe(1500);
  });

  it("uses exact millilitres for volume units", () => {
    expect(estimateGrams(item({ quantity: 250, unit: "ml" }), "milk")).toBe(250);
    expect(estimateGrams(item({ quantity: 1, unit: "l" }), "milk")).toBe(1000);
  });

  it("uses the unit table for descriptive units", () => {
    expect(estimateGrams(item({ quantity: 2, unit: "slice" }), "bread")).toBe(60);
    expect(estimateGrams(item({ quantity: 1, unit: "glass" }), "milk")).toBe(240);
  });

  it("uses the declared serving size when a serving was spoken", () => {
    expect(
      estimateGrams(item({ quantity: 2, unit: "serving" }), "Granola bar", 45)
    ).toBe(90);
  });

  it("uses piece weights for bare counts, ignoring a nominal serving size", () => {
    // Bundled foods declare a nominal "100 g" serving; 3 eggs is not 300 g.
    expect(estimateGrams(item({ quantity: 3 }), "Egg, whole, raw", 100)).toBe(150);
    expect(estimateGrams(item({ quantity: 1 }), "Apple, raw", 100)).toBe(180);
  });

  it("uses piece weights for an explicit 'piece'", () => {
    expect(estimateGrams(item({ quantity: 2, unit: "piece" }), "Apple, raw")).toBe(360);
  });

  it("falls back to a default weight for unknown foods", () => {
    expect(estimateGrams(item({ quantity: 2 }), "mystery stew")).toBe(200);
  });

  it("treats a non-positive quantity as one", () => {
    expect(estimateGrams(item({ quantity: 0, unit: "g" }), "rice")).toBe(1);
  });
});

describe("pieceWeightForFood", () => {
  it("matches known foods case-insensitively", () => {
    expect(pieceWeightForFood("Egg, hard-boiled")).toBe(50);
    expect(pieceWeightForFood("BANANA, raw")).toBe(120);
  });

  it("returns the default for unknown foods", () => {
    expect(pieceWeightForFood("moon cheese")).toBe(100);
  });
});
