import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Profile } from "../types/nutrition";

export const PROFILE_MISSING_ERROR = "profile_missing";

export function useUserProfile(uid: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    (async () => {
      setLoading(true);
      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          throw new Error(PROFILE_MISSING_ERROR);
        }
        const data = snap.data() as Profile;
        if (isMounted) {
          setProfile(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setProfile(null);
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [uid]);

  return { profile, loading, error };
}
