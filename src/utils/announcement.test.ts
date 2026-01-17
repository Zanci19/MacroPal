import { describe, expect, it } from 'vitest';
import { normalizeAnnouncementNum, shouldShowAnnouncement } from './announcement';

describe('announcement utils', () => {
  describe('normalizeAnnouncementNum', () => {
    it('returns numbers as-is when valid', () => {
      expect(normalizeAnnouncementNum(2)).toBe(2);
    });

    it('parses numeric strings', () => {
      expect(normalizeAnnouncementNum('3')).toBe(3);
    });

    it('falls back to 0 for invalid values', () => {
      expect(normalizeAnnouncementNum('not-a-number')).toBe(0);
      expect(normalizeAnnouncementNum(null)).toBe(0);
    });
  });

  describe('shouldShowAnnouncement', () => {
    it('returns true when stored value is lower than the latest', () => {
      expect(shouldShowAnnouncement('1', 2)).toBe(true);
    });

    it('returns false when stored value matches or exceeds the latest', () => {
      expect(shouldShowAnnouncement(2, 2)).toBe(false);
      expect(shouldShowAnnouncement('3', 2)).toBe(false);
    });
  });
});
