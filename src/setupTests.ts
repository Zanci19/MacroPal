// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom/extend-expect";
import { vi } from "vitest";

// Mock matchmedia for Ionic components that rely on it
if (typeof window !== "undefined") {
  window.matchMedia =
    window.matchMedia ||
    function () {
      return {
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
      } as MediaQueryList;
    };
}

// --- Firebase mocks -------------------------------------------------------

const mockApp = {} as Record<string, unknown>;
const mockAuth = { currentUser: null } as { currentUser: any };

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => mockApp),
}));

vi.mock("firebase/analytics", () => ({
  getAnalytics: vi.fn(() => ({ })),
  isSupported: vi.fn(() => Promise.resolve(false)),
  logEvent: vi.fn(),
}));

vi.mock("firebase/auth", () => {
  const noopPromise = () => Promise.resolve();
  const fakeUser = { uid: "test", emailVerified: true } as any;

  return {
    getAuth: vi.fn(() => mockAuth),
    onAuthStateChanged: vi.fn((_auth, next) => {
      const timer = setTimeout(() => next?.(mockAuth.currentUser), 0);
      return () => clearTimeout(timer);
    }),
    signInWithEmailAndPassword: vi.fn(async () => ({ user: fakeUser })),
    createUserWithEmailAndPassword: vi.fn(async () => ({ user: fakeUser })),
    sendEmailVerification: vi.fn(noopPromise),
    sendPasswordResetEmail: vi.fn(noopPromise),
    deleteUser: vi.fn(noopPromise),
    signOut: vi.fn(noopPromise),
    updateProfile: vi.fn(noopPromise),
    updatePassword: vi.fn(noopPromise),
    EmailAuthProvider: { credential: vi.fn(() => ({})) },
    reauthenticateWithCredential: vi.fn(noopPromise),
  };
});

vi.mock("firebase/firestore", () => {
  const noopPromise = () => Promise.resolve();
  const mockRef = {};
  const mockSnapshot = { exists: () => false, data: () => ({}) };

  return {
       initializeFirestore: vi.fn(() => ({})),
    doc: vi.fn(() => mockRef),
    getDoc: vi.fn(async () => mockSnapshot),
    setDoc: vi.fn(noopPromise),
    onSnapshot: vi.fn((_ref, next) => {
      next?.({ data: () => ({}) });
      return () => {};
    }),
    runTransaction: vi.fn((_db, fn) => fn({})),
    serverTimestamp: vi.fn(() => new Date()),
    arrayUnion: vi.fn((...args) => args),
    collection: vi.fn(() => ({})),
    deleteDoc: vi.fn(noopPromise),
    query: vi.fn(() => ({})),
    orderBy: vi.fn(() => ({})),
    limit: vi.fn(() => ({})),
    increment: vi.fn((value: number) => value),
  };
});