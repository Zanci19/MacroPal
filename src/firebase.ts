import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAnalytics,
  isSupported,
  logEvent,
  Analytics,
} from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "macropal-zanci19.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "macropal-zanci19",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "macropal-zanci19.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "621449190647",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:621449190647:web:3e13f7c1de1d0f254587f2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-HSKWTMK5WZ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
const firestoreSettings =
  typeof window !== "undefined"
    ? {
        experimentalForceLongPolling: true,
        cache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      }
    : {
        experimentalForceLongPolling: true,
      };

export const db = initializeFirestore(app, firestoreSettings);
export const storage = getStorage(app);

export let analytics: Analytics | null = null;

export const trackEvent = (name: string, params?: Record<string, string | number | boolean | null | undefined>) => {
  if (!analytics) return;
  logEvent(analytics, name, params);
};

if (typeof window !== "undefined") {
  isSupported()
    .then((yes) => {
      if (yes) {
        analytics = getAnalytics(app);

        trackEvent("analytics_initialized");
      }
    })
    .catch((err) => {
      console.log("Analytics not supported:", err);
    });
}
