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
  }) => Promise<Record<string, unknown>>;
  logout?: () => Promise<void>;
};

const SocialLogin = registerPlugin<SocialLoginPlugin>("SocialLogin");

let initPromise: Promise<void> | null = null;

type SocialLoginErrorCode =
  | "social_login_init_failed"
  | "social_login_provider_error"
  | "social_login_missing_tokens";

type SocialLoginError = Error & {
  code: SocialLoginErrorCode;
  cause?: unknown;
};

const createSocialLoginError = (
  code: SocialLoginErrorCode,
  message: string,
  cause?: unknown
): SocialLoginError => {
  const error = new Error(message) as SocialLoginError;
  error.code = code;
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
};

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
  })().catch((error) => {
    initPromise = null;
    throw createSocialLoginError(
      "social_login_init_failed",
      "Google sign-in setup failed. Please try again.",
      error
    );
  });

  return initPromise;
};

const getTokenValue = (
  sources: Array<Record<string, unknown> | null | undefined>,
  keys: string[]
) => {
  const visited = new Set<unknown>();
  const queue: Array<Record<string, unknown>> = sources.filter(
    (source): source is Record<string, unknown> => !!source
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
        queue.push(value as Record<string, unknown>);
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
    const response = await SocialLogin
      .login({
        provider: "google",
      })
      .catch((error: unknown) => {
        throw createSocialLoginError(
          "social_login_provider_error",
          "Google sign-in failed while contacting the provider.",
          error
        );
      });
    
    const responseData = response as Record<string, unknown> & {
      result?: Record<string, unknown> & { authentication?: Record<string, unknown> };
      response?: Record<string, unknown>;
      data?: Record<string, unknown>;
      authentication?: Record<string, unknown>;
    };
    
    console.log("[googleSocialLogin] Login response received (structure):", {
      hasResult: !!responseData?.result,
      hasResponse: !!responseData?.response,
      hasData: !!responseData?.data,
      hasAuthentication: !!(responseData?.result?.authentication || responseData?.authentication),
      topLevelKeys: responseData ? Object.keys(responseData) : []
    });

    const candidates: Array<Record<string, unknown> | null | undefined> = [
      responseData,
      responseData?.result ?? null,
      responseData?.response ?? null,
      responseData?.data ?? null,
      responseData?.result?.authentication ?? null,
      responseData?.authentication ?? null,
    ];

    const idToken = getTokenValue(candidates, ["idToken", "id_token"]);
    const accessToken = getTokenValue(candidates, [
      "accessToken",
      "access_token",
    ]);

    console.log("[googleSocialLogin] Tokens extracted - idToken:", !!idToken, "accessToken:", !!accessToken);

    if (!idToken && !accessToken) {
      throw createSocialLoginError(
        "social_login_missing_tokens",
        "Google sign-in did not return an auth token."
      );
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
