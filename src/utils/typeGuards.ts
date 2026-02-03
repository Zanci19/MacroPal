/**
 * Type guard utilities for runtime type checking
 * Ensures data from Firebase and external sources matches expected types
 */

import type { Profile, DiaryEntry, Macros, MealKey } from '../types';

/**
 * Checks if a value is a valid Macros object
 */
export function isMacros(value: unknown): value is Macros {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.calories === 'number' &&
    typeof obj.carbs === 'number' &&
    typeof obj.protein === 'number' &&
    typeof obj.fat === 'number' &&
    Number.isFinite(obj.calories) &&
    Number.isFinite(obj.carbs) &&
    Number.isFinite(obj.protein) &&
    Number.isFinite(obj.fat)
  );
}

/**
 * Checks if a value is a valid MealKey
 */
export function isMealKey(value: unknown): value is MealKey {
  return typeof value === 'string' && 
    ['breakfast', 'lunch', 'dinner', 'snacks'].includes(value);
}

/**
 * Checks if a value is a valid DiaryEntry object
 */
export function isDiaryEntry(value: unknown): value is DiaryEntry {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.name === 'string' &&
    typeof obj.fdcId === 'number' &&
    isMacros(obj.total)
  );
}

/**
 * Checks if a value is a valid Profile object (partial check for required fields)
 */
export function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  
  const obj = value as Record<string, unknown>;
  
  // Check required fields
  const hasRequiredFields = (
    typeof obj.email === 'string' &&
    typeof obj.userId === 'string'
  );
  
  if (!hasRequiredFields) return false;
  
  // Check optional fields if they exist
  if (obj.age !== undefined && (typeof obj.age !== 'number' || !Number.isFinite(obj.age))) {
    return false;
  }
  
  if (obj.weight !== undefined && (typeof obj.weight !== 'number' || !Number.isFinite(obj.weight))) {
    return false;
  }
  
  if (obj.height !== undefined && (typeof obj.height !== 'number' || !Number.isFinite(obj.height))) {
    return false;
  }
  
  if (obj.gender !== undefined && !['male', 'female', 'other'].includes(obj.gender as string)) {
    return false;
  }
  
  if (obj.goal !== undefined && !['lose', 'maintain', 'gain'].includes(obj.goal as string)) {
    return false;
  }
  
  return true;
}

/**
 * Safely parses Firestore document data with type checking
 */
export function parseFirestoreData<T>(
  data: unknown,
  typeGuard: (value: unknown) => value is T
): T | null {
  if (!typeGuard(data)) {
    console.warn('Failed to parse Firestore data:', data);
    return null;
  }
  
  return data;
}

/**
 * Type guard for checking if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard for checking if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard for checking if a value is a positive number
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * Type guard for checking if a value is a non-negative number
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
