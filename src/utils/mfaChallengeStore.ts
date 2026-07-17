import type { MultiFactorResolver } from "firebase/auth";

export type PendingMfaChallengeMethod = "sms" | "authenticator";
export type PendingMfaChallengeSource = "password" | "google";

export type PendingMfaChallenge = {
  resolver: MultiFactorResolver;
  method: PendingMfaChallengeMethod;
  availableMethods: PendingMfaChallengeMethod[];
  verificationId: string | null;
  totpEnrollmentId: string | null;
  maskedPhone: string | null;
  source: PendingMfaChallengeSource;
  createdAt: number;
};

const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;

// The challenge holds a live Firebase MultiFactorResolver (non-serializable),
// so it can only live in memory — a full page reload unavoidably drops it.
// Back the singleton with globalThis so it survives module re-evaluation
// (HMR, lazy-loaded chunks) within the same page context, which is where the
// previous module-local variable could be silently reset between /login and
// /login-verify.
type MfaStore = { challenge: PendingMfaChallenge | null };
const STORE_KEY = "__macropal_mfa_challenge__";
const globalScope = globalThis as unknown as Record<string, MfaStore | undefined>;
const store: MfaStore = globalScope[STORE_KEY] ?? { challenge: null };
globalScope[STORE_KEY] = store;

export const setPendingMfaChallenge = (challenge: PendingMfaChallenge) => {
  store.challenge = challenge;
};

export const getPendingMfaChallenge = () => {
  if (!store.challenge) return null;
  if (Date.now() - store.challenge.createdAt > MFA_CHALLENGE_TTL_MS) {
    store.challenge = null;
    return null;
  }
  return store.challenge;
};

export const clearPendingMfaChallenge = () => {
  store.challenge = null;
};

