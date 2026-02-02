export const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const fromDateKey = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
};

export const isDateKey = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const clampDateKeyToToday = (key: string): string => {
  const today = toDateKey(new Date());
  return key > today ? today : key;
};

export const shiftDateKey = (key: string, delta: number): string => {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
};

export const formatDateKey = (
  key: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  }
): string => {
  return fromDateKey(key).toLocaleDateString(undefined, options);
};

export const todayDateKey = (): string => toDateKey(new Date());

/**
 * Get a human-readable relative date string
 */
export const getRelativeDateString = (dateKey: string): string => {
  const date = fromDateKey(dateKey);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (toDateKey(date) === toDateKey(today)) {
    return 'Today';
  }
  if (toDateKey(date) === toDateKey(yesterday)) {
    return 'Yesterday';
  }
  if (toDateKey(date) === toDateKey(tomorrow)) {
    return 'Tomorrow';
  }

  // Calculate days difference
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0 && diffDays <= 7) {
    return `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }
  if (diffDays < 0 && diffDays >= -7) {
    return `${Math.abs(diffDays)} day${diffDays !== -1 ? 's' : ''} ago`;
  }

  return formatDateKey(dateKey);
};

/**
 * Get date range for analytics
 */
export const getDateRange = (days: number): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);

  return {
    start: toDateKey(start),
    end: toDateKey(end),
  };
};

/**
 * Check if a date is in the past
 */
export const isInPast = (dateKey: string): boolean => {
  return dateKey < todayDateKey();
};

/**
 * Check if a date is in the future
 */
export const isInFuture = (dateKey: string): boolean => {
  return dateKey > todayDateKey();
};

/**
 * Get the start of the week for a given date
 */
export const getWeekStart = (dateKey: string): string => {
  const date = fromDateKey(dateKey);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust for Sunday
  date.setDate(date.getDate() + diff);
  return toDateKey(date);
};

/**
 * Get all dates in a week
 */
export const getWeekDates = (dateKey: string): string[] => {
  const start = getWeekStart(dateKey);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(shiftDateKey(start, i));
  }
  return dates;
};

/**
 * Format time for display
 */
export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Format date and time for display
 */
export const formatDateTime = (date: Date): string => {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
