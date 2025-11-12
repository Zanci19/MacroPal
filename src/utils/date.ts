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
