import { useEffect, useState } from "react";
import { doc, getDoc, DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import { MealKey } from "../types/nutrition";
import { getTodayKey, MEALS } from "../utils/nutrition";

export function useStreak(uid: string | null, windowDays = 14) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!uid) {
      setStreak(0);
      return;
    }

    let active = true;

    (async () => {
      const today = new Date();
      const requests = Array.from({ length: windowDays }, (_, idx) => {
        const date = new Date(today);
        date.setDate(today.getDate() - idx);
        const key = getTodayKey(date);
        return getDoc(doc(db, "users", uid, "foods", key)).then((snap) => ({
          key,
          data: snap.data() as DocumentData | undefined,
        }));
      });

      const results = await Promise.all(requests);
      if (!active) return;

      let count = 0;
      for (const { data } of results) {
        const mealsDoc = (data ?? {}) as Partial<Record<MealKey, unknown>>;
        const hasAny = MEALS.some((meal) => {
          const entries = mealsDoc[meal];
          return Array.isArray(entries) && entries.length > 0;
        });
        if (hasAny) {
          count += 1;
        } else {
          break;
        }
      }
      setStreak(count);
    })();

    return () => {
      active = false;
    };
  }, [uid, windowDays]);

  return streak;
}
