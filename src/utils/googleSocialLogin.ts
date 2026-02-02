import { registerPlugin } from "@capacitor/core";
import {
  GoogleAuthProvider,
  signInWithCredential,
  UserCredential,
} from "firebase/auth";
import { auth } from "../firebase";

type SocialLoginPlugin = {
  initialize: (options: { google: { webClientId: string } }) => Promise<void>;
  login: (options: {
    provider: "google";
    options?: {
      scopes?: string[];
      filterByAuthorizedAccounts?: boolean;
      autoSelectEnabled?: boolean;
      forceRefreshToken?: boolean;
    };
  }) => Promise<Record<string, any>>;
  logout?: () => Promise<void>;
};

const SocialLogin = registerPlugin<SocialLoginPlugin>("SocialLogin");

let initPromise: Promise<void> | null = null;

const initializeSocialLogin = async () => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
      throw new Error("Missing VITE_GOOGLE_WEB_CLIENT_ID for Google sign-in.");
    }

    await SocialLogin.initialize({
      google: {
        webClientId,
      },
    });
  })();

  return initPromise;
};

const getTokenValue = (
  sources: Array<Record<string, any> | null | undefined>,
  keys: string[]
) => {
  const visited = new Set<unknown>();
  const queue: Array<Record<string, any>> = sources.filter(
    (source): source is Record<string, any> => !!source
  );

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    for (const key of keys) {
      const value = current[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") {
        queue.push(value as Record<string, any>);
      }
    }
  }

  return undefined;
};

export const signInWithGoogleSocialLogin = async (): Promise<UserCredential> => {
  await initializeSocialLogin();

  const logoutIfPossible = async (reason: string) => {
    if (typeof SocialLogin.logout !== "function") return;
    try {
      await SocialLogin.logout();
    } catch (logoutError) {
      console.warn(`[googleSocialLogin] logout failed (${reason})`, logoutError);
    }
  };

  const loginWithTokens = async () => {
    console.log("[googleSocialLogin] Starting login...");
    const response = await SocialLogin.login({
      provider: "google",
    });
    console.log("[googleSocialLogin] Login response received (structure):", {
      hasResult: !!response?.result,
      hasResponse: !!response?.response,
      hasData: !!response?.data,
      hasAuthentication: !!(response?.result?.authentication || response?.authentication),
      topLevelKeys: response ? Object.keys(response) : []
    });

    const candidates = [
      response,
      response?.result,
      response?.response,
      response?.data,
      response?.result?.authentication,
      response?.authentication,
    ];

    const idToken = getTokenValue(candidates, ["idToken", "id_token"]);
    const accessToken = getTokenValue(candidates, [
      "accessToken",
      "access_token",
    ]);

    console.log("[googleSocialLogin] Tokens extracted - idToken:", !!idToken, "accessToken:", !!accessToken);

    if (!idToken && !accessToken) {
      throw new Error("Google sign-in did not return an auth token.");
    }

    const credential = GoogleAuthProvider.credential(
      idToken ?? undefined,
      accessToken ?? undefined
    );

    console.log("[googleSocialLogin] Signing in with Firebase...");
    return signInWithCredential(auth, credential);
  };

  try {
    return await loginWithTokens();
  } catch (error: unknown) {
    const err = error as Error & { code?: number | string; errorCode?: number | string; nativeCode?: number | string };
    console.error("[googleSocialLogin] Error during sign-in:", err);
    const code = err?.code ?? err?.errorCode ?? err?.nativeCode;
    const message = String(err?.message ?? "").toLowerCase();
    const isReauthFailure =
      code === 16 ||
      code === "16" ||
      message.includes("account reauth failed");

    if (!isReauthFailure) {
      throw err;
    }

    console.log("[googleSocialLogin] Detected Error 16, retrying...");
    await logoutIfPossible("reauth");

    initPromise = null;
    await initializeSocialLogin();

    return loginWithTokens();
  }
};
