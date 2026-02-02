import { describe, it, expect } from 'vitest';
import {
  isMacros,
  isMeal,
  isDiaryEntry,
  isProfile,
  isObject,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
  parseFirestoreData,
} from './typeGuards';

describe('isMacros', () => {
  it('should validate valid Macros objects', () => {
    expect(isMacros({ calories: 200, carbs: 20, protein: 25, fat: 8 })).toBe(true);
    expect(isMacros({ calories: 0, carbs: 0, protein: 0, fat: 0 })).toBe(true);
  });

  it('should reject invalid Macros objects', () => {
    expect(isMacros(null)).toBe(false);
    expect(isMacros(undefined)).toBe(false);
    expect(isMacros({})).toBe(false);
    expect(isMacros({ calories: 200 })).toBe(false);
    expect(isMacros({ calories: '200', carbs: 20, protein: 25, fat: 8 })).toBe(false);
    expect(isMacros({ calories: NaN, carbs: 20, protein: 25, fat: 8 })).toBe(false);
  });
});

describe('isMeal', () => {
  it('should validate valid Meal objects', () => {
    const meal = {
      name: 'Chicken Breast',
      servings: 1,
      macros: { calories: 200, carbs: 0, protein: 40, fat: 4 },
    };
    expect(isMeal(meal)).toBe(true);
  });

  it('should reject invalid Meal objects', () => {
    expect(isMeal(null)).toBe(false);
    expect(isMeal({})).toBe(false);
    expect(isMeal({ name: 'Test' })).toBe(false);
    expect(
      isMeal({
        name: 'Test',
        servings: 'one',
        macros: { calories: 200, carbs: 20, protein: 25, fat: 8 },
      })
    ).toBe(false);
    expect(
      isMeal({
        name: 'Test',
        servings: 1,
        macros: { calories: 200 },
      })
    ).toBe(false);
  });
});

describe('isDiaryEntry', () => {
  it('should validate valid DiaryEntry objects', () => {
    const entry = {
      date: '2024-01-01',
      meals: [
        {
          name: 'Breakfast',
          servings: 1,
          macros: { calories: 300, carbs: 30, protein: 20, fat: 10 },
        },
      ],
      weight: 70,
    };
    expect(isDiaryEntry(entry)).toBe(true);

    // Without weight
    const entryNoWeight = {
      date: '2024-01-01',
      meals: [],
    };
    expect(isDiaryEntry(entryNoWeight)).toBe(true);
  });

  it('should reject invalid DiaryEntry objects', () => {
    expect(isDiaryEntry(null)).toBe(false);
    expect(isDiaryEntry({})).toBe(false);
    expect(isDiaryEntry({ date: '2024-01-01' })).toBe(false);
    expect(isDiaryEntry({ date: '2024-01-01', meals: 'not-an-array' })).toBe(false);
    expect(
      isDiaryEntry({
        date: '2024-01-01',
        meals: [{ invalid: 'meal' }],
      })
    ).toBe(false);
  });
});

describe('isProfile', () => {
  it('should validate valid Profile objects', () => {
    const profile = {
      email: 'test@example.com',
      userId: 'user123',
      age: 30,
      weight: 70,
      height: 175,
      gender: 'male' as const,
      goal: 'maintain' as const,
    };
    expect(isProfile(profile)).toBe(true);

    // Minimal profile
    const minimalProfile = {
      email: 'test@example.com',
      userId: 'user123',
    };
    expect(isProfile(minimalProfile)).toBe(true);
  });

  it('should reject invalid Profile objects', () => {
    expect(isProfile(null)).toBe(false);
    expect(isProfile({})).toBe(false);
    expect(isProfile({ email: 'test@example.com' })).toBe(false);
    expect(isProfile({ userId: 'user123' })).toBe(false);
    expect(
      isProfile({
        email: 'test@example.com',
        userId: 'user123',
        age: 'thirty',
      })
    ).toBe(false);
    expect(
      isProfile({
        email: 'test@example.com',
        userId: 'user123',
        gender: 'invalid',
      })
    ).toBe(false);
  });
});

describe('isObject', () => {
  it('should validate objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: 'value' })).toBe(true);
  });

  it('should reject non-objects', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('string')).toBe(false);
    expect(isObject(123)).toBe(false);
  });
});

describe('isNonEmptyString', () => {
  it('should validate non-empty strings', () => {
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('  text  ')).toBe(true);
  });

  it('should reject empty or invalid strings', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
  });
});

describe('isPositiveNumber', () => {
  it('should validate positive numbers', () => {
    expect(isPositiveNumber(1)).toBe(true);
    expect(isPositiveNumber(0.1)).toBe(true);
    expect(isPositiveNumber(1000)).toBe(true);
  });

  it('should reject non-positive numbers', () => {
    expect(isPositiveNumber(0)).toBe(false);
    expect(isPositiveNumber(-1)).toBe(false);
    expect(isPositiveNumber(NaN)).toBe(false);
    expect(isPositiveNumber(Infinity)).toBe(false);
  });
});

describe('isNonNegativeNumber', () => {
  it('should validate non-negative numbers', () => {
    expect(isNonNegativeNumber(0)).toBe(true);
    expect(isNonNegativeNumber(1)).toBe(true);
    expect(isNonNegativeNumber(100.5)).toBe(true);
  });

  it('should reject negative numbers', () => {
    expect(isNonNegativeNumber(-1)).toBe(false);
    expect(isNonNegativeNumber(NaN)).toBe(false);
    expect(isNonNegativeNumber(Infinity)).toBe(false);
  });
});

describe('parseFirestoreData', () => {
  it('should parse valid data', () => {
    const macros = { calories: 200, carbs: 20, protein: 25, fat: 8 };
    expect(parseFirestoreData(macros, isMacros)).toEqual(macros);
  });

  it('should return null for invalid data', () => {
    expect(parseFirestoreData({ invalid: 'data' }, isMacros)).toBeNull();
    expect(parseFirestoreData(null, isMacros)).toBeNull();
  });
});
