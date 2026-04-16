import { describe, it, expect } from 'vitest';
import {
  isMacros,
  isMealKey,
  isDiaryEntry,
  isProfile,
  isObject,
  isNonEmptyString,
  isPositiveNumber,
  isNonNegativeNumber,
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

describe('isMealKey', () => {
  it('should validate valid MealKey values', () => {
    expect(isMealKey('breakfast')).toBe(true);
    expect(isMealKey('lunch')).toBe(true);
    expect(isMealKey('dinner')).toBe(true);
    expect(isMealKey('snacks')).toBe(true);
  });

  it('should reject invalid MealKey values', () => {
    expect(isMealKey('brunch')).toBe(false);
    expect(isMealKey('')).toBe(false);
    expect(isMealKey(null)).toBe(false);
    expect(isMealKey(undefined)).toBe(false);
    expect(isMealKey(123)).toBe(false);
  });
});

describe('isDiaryEntry', () => {
  it('should validate valid DiaryEntry objects', () => {
    const entry = {
      fdcId: 123,
      name: 'Test Food',
      total: { calories: 200, carbs: 20, protein: 25, fat: 8 },
      addedAt: '2024-01-01T00:00:00Z',
    };
    expect(isDiaryEntry(entry)).toBe(true);
  });

  it('should reject invalid DiaryEntry objects', () => {
    expect(isDiaryEntry(null)).toBe(false);
    expect(isDiaryEntry({})).toBe(false);
    expect(isDiaryEntry({ name: 'Test' })).toBe(false);
  });
});

describe('isProfile', () => {
  it('should validate valid Profile objects', () => {
    const profile = {
      age: 30,
      weight: 70,
      height: 175,
      gender: 'male',
      goal: 'maintain',
      activity: 'moderate',
    };
    expect(isProfile(profile)).toBe(true);
  });

  it('should reject invalid Profile objects', () => {
    expect(isProfile(null)).toBe(false);
    expect(isProfile({})).toBe(false);
    expect(isProfile({ age: 30 })).toBe(false);
  });
});

describe('helper type guards', () => {
  describe('isObject', () => {
    it('should identify objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should identify non-empty strings', () => {
      expect(isNonEmptyString('test')).toBe(true);
      expect(isNonEmptyString('  ')).toBe(false);
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe('isPositiveNumber', () => {
    it('should identify positive numbers', () => {
      expect(isPositiveNumber(1)).toBe(true);
      expect(isPositiveNumber(0.1)).toBe(true);
      expect(isPositiveNumber(0)).toBe(false);
      expect(isPositiveNumber(-1)).toBe(false);
      expect(isPositiveNumber(NaN)).toBe(false);
      expect(isPositiveNumber('1')).toBe(false);
    });
  });

  describe('isNonNegativeNumber', () => {
    it('should identify non-negative numbers', () => {
      expect(isNonNegativeNumber(0)).toBe(true);
      expect(isNonNegativeNumber(1)).toBe(true);
      expect(isNonNegativeNumber(-1)).toBe(false);
      expect(isNonNegativeNumber(NaN)).toBe(false);
      expect(isNonNegativeNumber('0')).toBe(false);
    });
  });
});
