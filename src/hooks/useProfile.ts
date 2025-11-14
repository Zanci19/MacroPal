import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { Profile } from "../types";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
          setLoading(false);
        },
        (err) => {
          console.error("Profile snapshot error:", err);
          setProfile(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return { uid, profile, loading };
}
