import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toDateKey,
  fromDateKey,
  isDateKey,
  clampDateKeyToToday,
  shiftDateKey,
  formatDateKey,
  todayDateKey,
  getRelativeDateString,
  getDateRange,
  isInPast,
  isInFuture,
  getWeekStart,
  getWeekDates,
  formatTime,
  formatDateTime,
} from './date';

describe('toDateKey', () => {
  it('should format a Date into yyyy-mm-dd', () => {
    expect(toDateKey(new Date(2024, 0, 15))).toBe('2024-01-15');
    expect(toDateKey(new Date(2024, 11, 31))).toBe('2024-12-31');
  });

  it('should zero-pad month and day', () => {
    expect(toDateKey(new Date(2024, 1, 5))).toBe('2024-02-05');
  });
});

describe('fromDateKey', () => {
  it('should parse a yyyy-mm-dd key back to a Date', () => {
    const date = fromDateKey('2024-06-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(5); // June = 5
    expect(date.getDate()).toBe(15);
  });

  it('should be the inverse of toDateKey', () => {
    const key = '2024-03-20';
    expect(toDateKey(fromDateKey(key))).toBe(key);
  });
});

describe('isDateKey', () => {
  it('should return true for valid date keys', () => {
    expect(isDateKey('2024-01-01')).toBe(true);
    expect(isDateKey('2000-12-31')).toBe(true);
  });

  it('should return false for invalid date keys', () => {
    expect(isDateKey('not-a-date')).toBe(false);
    expect(isDateKey('2024-1-1')).toBe(false);
    expect(isDateKey('')).toBe(false);
    expect(isDateKey(null)).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
    expect(isDateKey(123)).toBe(false);
  });
});

describe('shiftDateKey', () => {
  it('should add days to a date key', () => {
    expect(shiftDateKey('2024-01-01', 1)).toBe('2024-01-02');
    expect(shiftDateKey('2024-01-31', 1)).toBe('2024-02-01');
  });

  it('should subtract days from a date key', () => {
    expect(shiftDateKey('2024-01-02', -1)).toBe('2024-01-01');
    expect(shiftDateKey('2024-03-01', -1)).toBe('2024-02-29'); // 2024 is a leap year
  });

  it('should handle zero shift', () => {
    expect(shiftDateKey('2024-06-15', 0)).toBe('2024-06-15');
  });
});

describe('todayDateKey', () => {
  it('should return a valid date key for today', () => {
    const key = todayDateKey();
    expect(isDateKey(key)).toBe(true);
    expect(key).toBe(toDateKey(new Date()));
  });
});

describe('clampDateKeyToToday', () => {
  it('should return today if given a future date', () => {
    const future = shiftDateKey(todayDateKey(), 10);
    expect(clampDateKeyToToday(future)).toBe(todayDateKey());
  });

  it('should return the date unchanged if it is today or in the past', () => {
    const today = todayDateKey();
    expect(clampDateKeyToToday(today)).toBe(today);
    const past = shiftDateKey(today, -5);
    expect(clampDateKeyToToday(past)).toBe(past);
  });
});

describe('formatDateKey', () => {
  it('should return a non-empty string', () => {
    const formatted = formatDateKey('2024-06-15');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});

describe('getRelativeDateString', () => {
  let now: Date;

  beforeEach(() => {
    now = new Date();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "Today" for today', () => {
    const today = toDateKey(now);
    expect(getRelativeDateString(today)).toBe('Today');
  });

  it('should return "Yesterday" for yesterday', () => {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getRelativeDateString(toDateKey(yesterday))).toBe('Yesterday');
  });

  it('should return "Tomorrow" for tomorrow', () => {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getRelativeDateString(toDateKey(tomorrow))).toBe('Tomorrow');
  });

  it('should return a "X days ago" string for recent past dates', () => {
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(getRelativeDateString(toDateKey(threeDaysAgo))).toBe('3 days ago');
  });

  it('should return a "In X days" string for near future dates', () => {
    const inFiveDays = new Date(now);
    inFiveDays.setDate(inFiveDays.getDate() + 5);
    expect(getRelativeDateString(toDateKey(inFiveDays))).toBe('In 5 days');
  });

  it('should return a formatted date for dates more than 7 days away', () => {
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const result = getRelativeDateString(toDateKey(twoWeeksAgo));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Should not be a relative label
    expect(result).not.toBe('Today');
    expect(result).not.toBe('Yesterday');
  });
});

describe('getDateRange', () => {
  it('should return start and end as valid date keys', () => {
    const { start, end } = getDateRange(7);
    expect(isDateKey(start)).toBe(true);
    expect(isDateKey(end)).toBe(true);
  });

  it('should return a range where end >= start', () => {
    const { start, end } = getDateRange(30);
    expect(end >= start).toBe(true);
  });

  it('should span the correct number of days', () => {
    const days = 7;
    const { start, end } = getDateRange(days);
    const startMs = fromDateKey(start).getTime();
    const endMs = fromDateKey(end).getTime();
    const diffDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(days - 1);
  });
});

describe('isInPast', () => {
  it('should return true for past dates', () => {
    const yesterday = shiftDateKey(todayDateKey(), -1);
    expect(isInPast(yesterday)).toBe(true);
  });

  it('should return false for today', () => {
    expect(isInPast(todayDateKey())).toBe(false);
  });

  it('should return false for future dates', () => {
    const tomorrow = shiftDateKey(todayDateKey(), 1);
    expect(isInPast(tomorrow)).toBe(false);
  });
});

describe('isInFuture', () => {
  it('should return true for future dates', () => {
    const tomorrow = shiftDateKey(todayDateKey(), 1);
    expect(isInFuture(tomorrow)).toBe(true);
  });

  it('should return false for today', () => {
    expect(isInFuture(todayDateKey())).toBe(false);
  });

  it('should return false for past dates', () => {
    const yesterday = shiftDateKey(todayDateKey(), -1);
    expect(isInFuture(yesterday)).toBe(false);
  });
});

describe('getWeekStart', () => {
  it('should return Monday for a given date', () => {
    // 2024-06-19 is a Wednesday
    const weekStart = getWeekStart('2024-06-19');
    const day = fromDateKey(weekStart).getDay();
    expect(day).toBe(1); // Monday
  });

  it('should return the same day if the input is a Monday', () => {
    // 2024-06-17 is a Monday
    expect(getWeekStart('2024-06-17')).toBe('2024-06-17');
  });
});

describe('getWeekDates', () => {
  it('should return exactly 7 dates', () => {
    const dates = getWeekDates('2024-06-19');
    expect(dates).toHaveLength(7);
  });

  it('should return dates in ascending order', () => {
    const dates = getWeekDates('2024-06-19');
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it('should start on Monday', () => {
    const dates = getWeekDates('2024-06-19');
    const startDay = fromDateKey(dates[0]).getDay();
    expect(startDay).toBe(1);
  });

  it('should only contain valid date keys', () => {
    const dates = getWeekDates('2024-06-19');
    dates.forEach((d) => expect(isDateKey(d)).toBe(true));
  });
});

describe('formatTime', () => {
  it('should return a non-empty time string', () => {
    const result = formatTime(new Date(2024, 5, 15, 14, 30));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatDateTime', () => {
  it('should return a non-empty datetime string', () => {
    const result = formatDateTime(new Date(2024, 5, 15, 14, 30));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
