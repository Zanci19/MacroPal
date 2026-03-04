import { describe, it, expect, vi } from 'vitest';
import { getUserFriendlyErrorMessage, createErrorInfo } from './handleError';

vi.mock('../firebase', () => ({
  trackEvent: vi.fn(),
}));

describe('getUserFriendlyErrorMessage', () => {
  const make = (msg: string) => new Error(msg);

  it('should map auth/email-already-in-use', () => {
    const result = getUserFriendlyErrorMessage(make('auth/email-already-in-use'));
    expect(result).toMatch(/already registered/i);
  });

  it('should map auth/wrong-password', () => {
    const result = getUserFriendlyErrorMessage(make('auth/wrong-password'));
    expect(result).toMatch(/incorrect password/i);
  });

  it('should map auth/user-not-found', () => {
    const result = getUserFriendlyErrorMessage(make('auth/user-not-found'));
    expect(result).toMatch(/no account found/i);
  });

  it('should map auth/invalid-email', () => {
    const result = getUserFriendlyErrorMessage(make('auth/invalid-email'));
    expect(result).toMatch(/valid email/i);
  });

  it('should map auth/weak-password', () => {
    const result = getUserFriendlyErrorMessage(make('auth/weak-password'));
    expect(result).toMatch(/too weak/i);
  });

  it('should map auth/network-request-failed', () => {
    const result = getUserFriendlyErrorMessage(make('auth/network-request-failed'));
    expect(result).toMatch(/network error/i);
  });

  it('should map permission-denied', () => {
    const result = getUserFriendlyErrorMessage(make('permission-denied'));
    expect(result).toMatch(/permission/i);
  });

  it('should map not-found', () => {
    const result = getUserFriendlyErrorMessage(make('not-found'));
    expect(result).toMatch(/not found/i);
  });

  it('should map generic network errors', () => {
    const result = getUserFriendlyErrorMessage(make('network failure'));
    expect(result).toMatch(/network error/i);
  });

  it('should map offline errors', () => {
    const result = getUserFriendlyErrorMessage(make('client is offline'));
    expect(result).toMatch(/network error/i);
  });

  it('should return a fallback message for unknown errors', () => {
    const result = getUserFriendlyErrorMessage(make('something completely unexpected'));
    expect(result).toMatch(/something went wrong/i);
  });
});

describe('createErrorInfo', () => {
  it('should create an ErrorInfo object from an Error', () => {
    const error = new Error('auth/wrong-password');
    const info = createErrorInfo('LoginPage', error);

    expect(info.source).toBe('LoginPage');
    expect(info.message).toBe('auth/wrong-password');
    expect(info.userMessage).toMatch(/incorrect password/i);
    expect(typeof info.timestamp).toBe('string');
    expect(new Date(info.timestamp).getTime()).not.toBeNaN();
  });

  it('should create an ErrorInfo object from a non-Error value', () => {
    const info = createErrorInfo('TestSource', 'plain string error');
    expect(info.source).toBe('TestSource');
    expect(info.message).toBe('plain string error');
    expect(typeof info.userMessage).toBe('string');
  });

  it('should handle null/undefined errors gracefully', () => {
    const info = createErrorInfo('TestSource', null);
    expect(info.source).toBe('TestSource');
    expect(typeof info.message).toBe('string');
    expect(typeof info.userMessage).toBe('string');
  });
});
