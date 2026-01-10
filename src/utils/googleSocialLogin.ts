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
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }
  return undefined;
};

export const signInWithGoogleSocialLogin = async (): Promise<UserCredential> => {
  await initializeSocialLogin();

  const response = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["profile", "email"],
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

  const idToken = getTokenValue(candidates, ["idToken", "id_token"]);
  const accessToken = getTokenValue(candidates, ["accessToken", "access_token"]);

  if (!idToken && !accessToken) {
    throw new Error("Google sign-in did not return an auth token.");
  }

  const credential = GoogleAuthProvider.credential(
    idToken ?? undefined,
    accessToken ?? undefined
  );

  return signInWithCredential(auth, credential);
};
