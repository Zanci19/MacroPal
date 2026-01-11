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
    };
  }) => Promise<Record<string, any>>;
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

const getErrorValue = (
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

const createSocialLoginError = (
  message: string,
  code: string,
  details?: Record<string, any>
) => {
  const error = new Error(message) as Error & {
    code?: string;
    details?: Record<string, any>;
  };
  error.code = code;
  error.details = details;
  return error;
};

export const signInWithGoogleSocialLogin = async (): Promise<UserCredential> => {
  await initializeSocialLogin();

  const response = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["profile", "email", "openid"],
    },
  });

  const candidates = [
    response,
    response?.result,
    response?.response,
    response?.data,
    response?.result?.authentication,
    response?.authentication,
  ];

  const providerError = getErrorValue(candidates, [
    "errorMessage",
    "error",
    "message",
    "error_description",
  ]);
  if (providerError) {
    throw createSocialLoginError(
      providerError,
      "social_login_provider_error",
      { provider: "google" }
    );
  }

  const idToken = getTokenValue(candidates, ["idToken", "id_token"]);
  const accessToken = getTokenValue(candidates, ["accessToken", "access_token"]);

  if (!idToken && !accessToken) {
    throw createSocialLoginError(
      "Google sign-in did not return an auth token.",
      "social_login_missing_tokens",
      {
        provider: "google",
      }
    );
  }

  const credential = GoogleAuthProvider.credential(
    idToken ?? undefined,
    accessToken ?? undefined
  );

  return signInWithCredential(auth, credential);
};
