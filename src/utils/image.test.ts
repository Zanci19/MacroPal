import { describe, it, expect } from 'vitest';
import { normalizePhotoUrl } from './image';

describe('normalizePhotoUrl', () => {
  it('should return null for null input', () => {
    expect(normalizePhotoUrl(null)).toBe(null);
  });

  it('should return null for undefined input', () => {
    expect(normalizePhotoUrl(undefined)).toBe(null);
  });

  it('should return null for empty string', () => {
    expect(normalizePhotoUrl('')).toBe(null);
  });

  it('should return null for whitespace-only string', () => {
    expect(normalizePhotoUrl('   ')).toBe(null);
  });

  it('should convert http:// to https://', () => {
    const input = 'http://example.com/photo.jpg';
    const expected = 'https://example.com/photo.jpg';
    expect(normalizePhotoUrl(input)).toBe(expected);
  });

  it('should preserve https:// URLs', () => {
    const input = 'https://example.com/photo.jpg';
    expect(normalizePhotoUrl(input)).toBe(input);
  });

  it('should add sz=256 to Google URLs without size parameter', () => {
    const input = 'https://lh3.googleusercontent.com/a/default-user';
    const expected = 'https://lh3.googleusercontent.com/a/default-user?sz=256';
    expect(normalizePhotoUrl(input)).toBe(expected);
  });

  it('should not add sz parameter to Google URLs that already have =sXXX format', () => {
    const input = 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    // Should NOT add ?sz=256 because =s96-c already exists
    expect(normalizePhotoUrl(input)).toBe(input);
  });

  it('should not add sz parameter to Google URLs that already have sz= query param', () => {
    const input = 'https://lh3.googleusercontent.com/a/default-user?sz=200';
    expect(normalizePhotoUrl(input)).toBe(input);
  });

  it('should handle Google URLs with other query parameters', () => {
    const input = 'https://lh3.googleusercontent.com/a/default-user?foo=bar';
    const expected = 'https://lh3.googleusercontent.com/a/default-user?foo=bar&sz=256';
    expect(normalizePhotoUrl(input)).toBe(expected);
  });

  it('should not modify non-Google URLs', () => {
    const input = 'https://example.com/photo.jpg';
    expect(normalizePhotoUrl(input)).toBe(input);
  });

  it('should handle different Google size formats', () => {
    // Common Google profile photo formats
    const testCases = [
      'https://lh3.googleusercontent.com/a/default-user=s96-c',
      'https://lh3.googleusercontent.com/a/default-user=s200',
      'https://lh3.googleusercontent.com/a/default-user=s512-c',
    ];

    testCases.forEach((url) => {
      // Should not modify URLs that already have size parameters
      expect(normalizePhotoUrl(url)).toBe(url);
    });
  });

  it('should trim whitespace from input', () => {
    const input = '  https://example.com/photo.jpg  ';
    const expected = 'https://example.com/photo.jpg';
    expect(normalizePhotoUrl(input)).toBe(expected);
  });

  it('should only add size parameter to actual googleusercontent.com domains', () => {
    // Should add sz=256 to legitimate Google URLs
    const legitimateUrl = 'https://lh3.googleusercontent.com/a/user';
    expect(normalizePhotoUrl(legitimateUrl)).toBe(legitimateUrl + '?sz=256');

    // Should NOT add sz=256 to URLs that only contain the string in query params
    const maliciousUrl = 'https://evil.com/photo?redirect=googleusercontent.com';
    expect(normalizePhotoUrl(maliciousUrl)).toBe(maliciousUrl);
  });

  it('should handle invalid URLs gracefully', () => {
    const invalidUrl = 'not-a-valid-url';
    expect(normalizePhotoUrl(invalidUrl)).toBe(invalidUrl);
  });
});
