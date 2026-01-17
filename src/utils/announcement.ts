export const normalizeAnnouncementNum = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const shouldShowAnnouncement = (
  storedValue: unknown,
  latestValue: number,
): boolean => normalizeAnnouncementNum(storedValue) < latestValue;
