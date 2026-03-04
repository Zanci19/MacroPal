import { describe, it, expect, vi } from 'vitest';

vi.mock('./firebase', () => ({
  auth: {},
  db: {},
  storage: {},
  trackEvent: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({
    exists: () => false,
  })),
}));

import App from './App';

describe('App', () => {
  it('exports a component', () => {
    expect(App).toBeTypeOf('function');
  });
});
