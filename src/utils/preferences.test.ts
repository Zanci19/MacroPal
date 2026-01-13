import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getLazyLoadPreference, applyLazyLoadPreference } from './preferences';

describe('Lazy Load Preferences', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('getLazyLoadPreference', () => {
    it('should return true by default when nothing is stored', () => {
      const result = getLazyLoadPreference();
      expect(result).toBe(true);
    });

    it('should return true when stored value is "on"', () => {
      localStorage.setItem('mp_lazy_load', 'on');
      const result = getLazyLoadPreference();
      expect(result).toBe(true);
    });

    it('should return false when stored value is "off"', () => {
      localStorage.setItem('mp_lazy_load', 'off');
      const result = getLazyLoadPreference();
      expect(result).toBe(false);
    });

    it('should return false for invalid stored values', () => {
      localStorage.setItem('mp_lazy_load', 'invalid');
      const result = getLazyLoadPreference();
      expect(result).toBe(false);
    });
  });

  describe('applyLazyLoadPreference', () => {
    it('should store "on" when enabled is true', () => {
      applyLazyLoadPreference(true);
      const stored = localStorage.getItem('mp_lazy_load');
      expect(stored).toBe('on');
    });

    it('should store "off" when enabled is false', () => {
      applyLazyLoadPreference(false);
      const stored = localStorage.getItem('mp_lazy_load');
      expect(stored).toBe('off');
    });

    it('should dispatch custom event with correct detail', () => {
      const eventSpy = vi.fn();
      window.addEventListener('mp_lazy_load_change', eventSpy);

      applyLazyLoadPreference(true);

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const event = eventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail.enabled).toBe(true);

      window.removeEventListener('mp_lazy_load_change', eventSpy);
    });
  });

  describe('Integration', () => {
    it('should maintain consistent state between apply and get', () => {
      // Apply true
      applyLazyLoadPreference(true);
      expect(getLazyLoadPreference()).toBe(true);

      // Apply false
      applyLazyLoadPreference(false);
      expect(getLazyLoadPreference()).toBe(false);

      // Apply true again
      applyLazyLoadPreference(true);
      expect(getLazyLoadPreference()).toBe(true);
    });

    it('should default to lazy loading enabled for new users', () => {
      // Simulate a new user with no stored preference
      const result = getLazyLoadPreference();
      expect(result).toBe(true); // Lazy loading should be ON by default
    });
  });
});
