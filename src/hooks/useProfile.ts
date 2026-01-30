import { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { Profile } from "../types";

// Default demo profile with reasonable values
const DEFAULT_DEMO_PROFILE: Profile = {
  age: 30,
  weight: 70,
  height: 175,
  gender: "male" as const,
  goal: "maintain" as const,
  activity: "moderate" as const,
  unitSystem: "metric" as const,
  weightUnit: "kg" as const,
  heightUnit: "cm" as const,
};

export function useProfile() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcementNum, setAnnouncementNum] = useState<unknown>(null);

  useEffect(() => {
    // In demo mode, immediately provide demo profile
    if (isDemoMode) {
      setUid("demo-user-id");
      setProfile(DEFAULT_DEMO_PROFILE);
      setAnnouncementNum(0);
      setLoading(false);
      return () => {}; // No cleanup needed for demo mode
    }

    // Normal mode - use Firebase
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Clean up old profile listener when auth user changes
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!user) {
        setUid(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUid(user.uid);
      setLoading(true);

      const ref = doc(db, "users", user.uid);

      unsubProfile = onSnapshot(
        ref,
        (snap) => {
          const data = snap.data() || {};
          // 🔑 take the nested "profile" field from the doc
          const p = (data.profile as Profile | undefined) ?? null;
          setProfile(p);
          setAnnouncementNum(data.announcementNum ?? null);
          setLoading(false);
        },
        (err) => {
          console.error("Profile snapshot error:", err);
          setProfile(null);
          setAnnouncementNum(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, [isDemoMode]);

  return useMemo(
    () => ({ uid, profile, announcementNum, loading }),
    [uid, profile, announcementNum, loading]
  );
}
