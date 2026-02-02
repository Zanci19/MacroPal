import { describe, it, expect } from 'vitest';
import {
  validateTitle,
  validateNumber,
  validateEmail,
  validatePassword,
  validateDate,
  validateServingSize,
  validateMacros,
  sanitizeInput,
} from './validation';

describe('validateTitle', () => {
  it('should validate valid titles', () => {
    expect(validateTitle('Chicken Breast')).toEqual({ isValid: true });
    expect(validateTitle('a')).toEqual({ isValid: true });
  });

  it('should reject empty or invalid titles', () => {
    expect(validateTitle('')).toEqual({ isValid: false, error: 'Title cannot be empty' });
    expect(validateTitle('   ')).toEqual({ isValid: false, error: 'Title cannot be empty' });
    expect(validateTitle(null)).toEqual({ isValid: false, error: 'Title is required' });
    expect(validateTitle(undefined)).toEqual({ isValid: false, error: 'Title is required' });
  });

  it('should reject titles that are too long', () => {
    const longTitle = 'a'.repeat(101);
    expect(validateTitle(longTitle)).toEqual({
      isValid: false,
      error: 'Title must be 100 characters or less',
    });
  });
});

describe('validateNumber', () => {
  it('should validate valid numbers', () => {
    expect(validateNumber(100)).toEqual({ isValid: true });
    expect(validateNumber(0)).toEqual({ isValid: true });
    expect(validateNumber(50.5)).toEqual({ isValid: true });
  });

  it('should reject invalid numbers', () => {
    expect(validateNumber(null)).toEqual({ isValid: false, error: 'Value is required' });
    expect(validateNumber(undefined)).toEqual({ isValid: false, error: 'Value is required' });
    expect(validateNumber(NaN)).toEqual({ isValid: false, error: 'Value must be a valid number' });
    expect(validateNumber(Infinity)).toEqual({ isValid: false, error: 'Value must be a valid number' });
  });

  it('should respect min and max constraints', () => {
    expect(validateNumber(-1)).toEqual({ isValid: false, error: 'Value must be at least 0' });
    expect(validateNumber(100001)).toEqual({ isValid: false, error: 'Value must be at most 100000' });
    
    expect(validateNumber(5, { min: 10, fieldName: 'Age' })).toEqual({
      isValid: false,
      error: 'Age must be at least 10',
    });
    
    expect(validateNumber(150, { max: 100, fieldName: 'Weight' })).toEqual({
      isValid: false,
      error: 'Weight must be at most 100',
    });
  });

  it('should handle optional numbers', () => {
    expect(validateNumber(null, { required: false })).toEqual({ isValid: true });
    expect(validateNumber(undefined, { required: false })).toEqual({ isValid: true });
  });
});

describe('validateEmail', () => {
  it('should validate valid emails', () => {
    expect(validateEmail('test@example.com')).toEqual({ isValid: true });
    expect(validateEmail('user+tag@domain.co.uk')).toEqual({ isValid: true });
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('')).toEqual({ isValid: false, error: 'Email is required' });
    expect(validateEmail('not-an-email')).toEqual({ isValid: false, error: 'Invalid email format' });
    expect(validateEmail('missing@domain')).toEqual({ isValid: false, error: 'Invalid email format' });
    expect(validateEmail('@domain.com')).toEqual({ isValid: false, error: 'Invalid email format' });
    expect(validateEmail(null)).toEqual({ isValid: false, error: 'Email is required' });
  });
});

describe('validatePassword', () => {
  it('should validate valid passwords', () => {
    expect(validatePassword('password123')).toEqual({ isValid: true });
    expect(validatePassword('abcdef')).toEqual({ isValid: true });
  });

  it('should reject invalid passwords', () => {
    expect(validatePassword('')).toEqual({ isValid: false, error: 'Password is required' });
    expect(validatePassword('12345')).toEqual({
      isValid: false,
      error: 'Password must be at least 6 characters',
    });
    expect(validatePassword('a'.repeat(129))).toEqual({
      isValid: false,
      error: 'Password must be 128 characters or less',
    });
    expect(validatePassword(null)).toEqual({ isValid: false, error: 'Password is required' });
  });
});

describe('validateDate', () => {
  it('should validate valid dates', () => {
    expect(validateDate(new Date())).toEqual({ isValid: true });
    expect(validateDate('2024-01-01')).toEqual({ isValid: true });
    expect(validateDate(new Date('2023-06-15'))).toEqual({ isValid: true });
  });

  it('should reject invalid dates', () => {
    expect(validateDate(null)).toEqual({ isValid: false, error: 'Date is required' });
    expect(validateDate('invalid-date')).toEqual({ isValid: false, error: 'Invalid date format' });
    expect(validateDate(new Date('invalid'))).toEqual({ isValid: false, error: 'Invalid date format' });
  });

  it('should reject dates too far in the future or past', () => {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 2);
    expect(validateDate(farFuture)).toEqual({
      isValid: false,
      error: 'Date cannot be more than 1 year in the future',
    });

    const farPast = new Date();
    farPast.setFullYear(farPast.getFullYear() - 11);
    expect(validateDate(farPast)).toEqual({
      isValid: false,
      error: 'Date cannot be more than 10 years in the past',
    });
  });
});

describe('validateServingSize', () => {
  it('should validate valid serving sizes', () => {
    expect(validateServingSize(1)).toEqual({ isValid: true });
    expect(validateServingSize(0.5)).toEqual({ isValid: true });
    expect(validateServingSize(2.5)).toEqual({ isValid: true });
  });

  it('should reject invalid serving sizes', () => {
    expect(validateServingSize(0)).toEqual({
      isValid: false,
      error: 'Serving size must be at least 0.01',
    });
    expect(validateServingSize(-1)).toEqual({
      isValid: false,
      error: 'Serving size must be at least 0.01',
    });
    expect(validateServingSize(101)).toEqual({
      isValid: false,
      error: 'Serving size must be at most 100',
    });
  });
});

describe('validateMacros', () => {
  it('should validate valid macros', () => {
    expect(
      validateMacros({
        calories: 200,
        carbs: 20,
        protein: 25,
        fat: 8,
      })
    ).toEqual({ isValid: true });
  });

  it('should reject invalid macros', () => {
    expect(
      validateMacros({
        calories: -100,
        carbs: 20,
        protein: 25,
        fat: 8,
      })
    ).toEqual({ isValid: false, error: 'Calories must be at least 0' });

    expect(
      validateMacros({
        calories: 200,
        carbs: 1001,
        protein: 25,
        fat: 8,
      })
    ).toEqual({ isValid: false, error: 'Carbs must be at most 1000' });

    expect(
      validateMacros({
        calories: 200,
        carbs: 20,
        protein: undefined as unknown as number,
        fat: 8,
      })
    ).toEqual({ isValid: false, error: 'Protein is required' });
  });
});

describe('sanitizeInput', () => {
  it('should trim and limit length', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
    expect(sanitizeInput('test')).toBe('test');
    expect(sanitizeInput('a'.repeat(1001), 10)).toBe('a'.repeat(10));
  });

  it('should handle invalid inputs', () => {
    expect(sanitizeInput(null)).toBe('');
    expect(sanitizeInput(undefined)).toBe('');
    expect(sanitizeInput('')).toBe('');
  });
});
