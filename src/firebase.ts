import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import {
  getAnalytics,
  isSupported,
  logEvent,
  Analytics,
} from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "macropal-zanci19.firebaseapp.com",
  projectId: "macropal-zanci19",
  storageBucket: "macropal-zanci19.firebasestorage.app",
  messagingSenderId: "621449190647",
  appId: "1:621449190647:web:3e13f7c1de1d0f254587f2",
  measurementId: "G-HSKWTMK5WZ",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export let analytics: Analytics | null = null;

export const trackEvent = (name: string, params?: Record<string, any>) => {
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
