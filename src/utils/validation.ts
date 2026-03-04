/**
 * Input validation utilities for user-submitted data
 * Provides type-safe validation with descriptive error messages
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a meal/food title
 */
export function validateTitle(title: string | undefined | null): ValidationResult {
  if (title === null || title === undefined || typeof title !== 'string') {
    return { isValid: false, error: 'Title is required' };
  }

  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Title cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { isValid: false, error: 'Title must be 100 characters or less' };
  }

  return { isValid: true };
}

/**
 * Validates a numeric value (calories, macros, etc.)
 */
export function validateNumber(
  value: number | undefined | null,
  options: {
    min?: number;
    max?: number;
    fieldName?: string;
    required?: boolean;
  } = {}
): ValidationResult {
  const { min = 0, max = 100000, fieldName = 'Value', required = true } = options;

  if (value === null || value === undefined) {
    if (required) {
      return { isValid: false, error: `${fieldName} is required` };
    }
    return { isValid: true };
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { isValid: false, error: `${fieldName} must be a valid number` };
  }

  if (value < min) {
    return { isValid: false, error: `${fieldName} must be at least ${min}` };
  }

  if (value > max) {
    return { isValid: false, error: `${fieldName} must be at most ${max}` };
  }

  return { isValid: true };
}

/**
 * Validates email format
 */
export function validateEmail(email: string | undefined | null): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string | undefined | null): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Password must be 128 characters or less' };
  }

  return { isValid: true };
}

/**
 * Validates a date string or Date object
 */
export function validateDate(date: string | Date | undefined | null): ValidationResult {
  if (!date) {
    return { isValid: false, error: 'Date is required' };
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }

  // Check if date is not too far in the future (1 year)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
  if (dateObj > oneYearFromNow) {
    return { isValid: false, error: 'Date cannot be more than 1 year in the future' };
  }

  // Check if date is not too far in the past (10 years for health data)
  const tenYearsAgo = new Date();
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  
  if (dateObj < tenYearsAgo) {
    return { isValid: false, error: 'Date cannot be more than 10 years in the past' };
  }

  return { isValid: true };
}

/**
 * Validates serving size
 */
export function validateServingSize(servings: number | undefined | null): ValidationResult {
  return validateNumber(servings, {
    min: 0.01,
    max: 100,
    fieldName: 'Serving size',
    required: true,
  });
}

/**
 * Validates macronutrient values
 */
export function validateMacros(macros: {
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
}): ValidationResult {
  const { calories, carbs, protein, fat } = macros;

  // Validate calories
  const caloriesResult = validateNumber(calories, {
    min: 0,
    max: 10000,
    fieldName: 'Calories',
    required: true,
  });
  if (!caloriesResult.isValid) return caloriesResult;

  // Validate carbs
  const carbsResult = validateNumber(carbs, {
    min: 0,
    max: 1000,
    fieldName: 'Carbs',
    required: true,
  });
  if (!carbsResult.isValid) return carbsResult;

  // Validate protein
  const proteinResult = validateNumber(protein, {
    min: 0,
    max: 1000,
    fieldName: 'Protein',
    required: true,
  });
  if (!proteinResult.isValid) return proteinResult;

  // Validate fat
  const fatResult = validateNumber(fat, {
    min: 0,
    max: 1000,
    fieldName: 'Fat',
    required: true,
  });
  if (!fatResult.isValid) return fatResult;

  return { isValid: true };
}

/**
 * Sanitizes user input by trimming and limiting length
 */
export function sanitizeInput(input: string | undefined | null, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input.trim().slice(0, maxLength);
}
