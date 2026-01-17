import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';

vi.mock("./firebase", () => ({
  auth: {},
  db: {},
  storage: {},
  trackEvent: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({
    exists: () => false,
  })),
}));

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
