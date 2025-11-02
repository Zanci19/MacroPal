import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { DiaryEntry, MealKey } from "../types/nutrition";
import { MEALS } from "../utils/nutrition";

type DiaryState = {
  data: Record<MealKey, DiaryEntry[]>;
  loading: boolean;
};

export function useDiary(uid: string | null, dayKey: string | null): DiaryState {
  const [data, setData] = useState<Record<MealKey, DiaryEntry[]>>(() => ({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !dayKey) {
      setData({ breakfast: [], lunch: [], dinner: [], snacks: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", uid, "foods", dayKey);
    const unsub = onSnapshot(ref, (snapshot) => {
      const raw = snapshot.data() || {};
      const normalized = MEALS.reduce(
        (acc, meal) => ({
          ...acc,
          [meal]: Array.isArray(raw[meal]) ? raw[meal] : [],
        }),
        {} as Record<MealKey, DiaryEntry[]>
      );
      setData(normalized);
      setLoading(false);
    });

    return () => unsub();
  }, [uid, dayKey]);

  return useMemo(() => ({ data, loading }), [data, loading]);
}
