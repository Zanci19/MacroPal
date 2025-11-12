import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "macropal-zanci19.firebaseapp.com",
  projectId: "macropal-zanci19",
  storageBucket: "macropal-zanci19.firebasestorage.app",
  messagingSenderId: "621449190647",
  appId: "1:621449190647:web:3e13f7c1de1d0f254587f2",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  useFetchStreams: false,
  experimentalAutoDetectLongPolling: true,
  // experimentalForceLongPolling: true, // <- alternative; you can enable this instead of auto-detect if needed
});
