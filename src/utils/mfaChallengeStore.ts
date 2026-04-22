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

let pendingMfaChallenge: PendingMfaChallenge | null = null;
const MFA_CHALLENGE_TTL_MS = 10 * 60 * 1000;

export const setPendingMfaChallenge = (challenge: PendingMfaChallenge) => {
  pendingMfaChallenge = challenge;
};

export const getPendingMfaChallenge = () => {
  if (!pendingMfaChallenge) return null;
  if (Date.now() - pendingMfaChallenge.createdAt > MFA_CHALLENGE_TTL_MS) {
    pendingMfaChallenge = null;
    return null;
  }
  return pendingMfaChallenge;
};

export const clearPendingMfaChallenge = () => {
  pendingMfaChallenge = null;
};

