import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonChip,
  IonToast,
  IonBadge,
  IonDatetime,
  IonModal,
  IonActionSheet,
  IonReorderGroup,
  IonReorder,
  IonAlert,
  IonProgressBar,
  IonText,
} from "@ionic/react";
import {
  addCircleOutline,
  sunnyOutline,
  restaurantOutline,
  cafeOutline,
  fastFoodOutline,
  flameOutline,
  bulbOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  calendarOutline,
  ellipsisVertical,
  chevronDownOutline,
  chevronUpOutline,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router";
import { db, trackEvent } from "../../firebase";
import { doc, getDoc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import "./Home.css";
import {
  clampDateKeyToToday,
  formatDateKey,
  isDateKey,
  shiftDateKey,
  todayDateKey,
} from "../../utils/date";
import type {
  MealKey,
  Macros,
  DiaryEntry,
  DayDiaryDoc,
  WorkoutDayDoc,
  WorkoutEntry,
} from "../../types";
import { useProfile } from "../../hooks/useProfile";

function safeNum(n: unknown, dp = 2): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  const factor = Math.pow(10, dp);
  return Math.round(v * factor) / factor;
}

const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

const WELLNESS_TIPS = [
  "Add something nourishing to your next meal — it doesn't have to be perfect.",
  "Your plate doesn’t need to be fancy; simple meals fuel well.",
  "Include foods that help you feel stable and energized.",
  "A little extra fiber can make meals more satisfying.",
  "Whole foods help your energy last longer, but all foods fit.",
  "Some days are heavy on carbs, some on protein — balance comes over time.",
  "Frozen fruits and veggies count just as much as fresh.",
  "Healthy eating is about patterns, not single meals.",
  "Choose foods that help your mood, not stress it.",
  "Meals don’t need rules — just awareness and kindness.",
  "Keep water nearby — hydration is a quiet productivity hack.",
  "Small sips often work better than chugging all at once.",
  "Warm drinks can calm the nervous system on stressful days.",
  "Electrolytes can help if you’ve been active or sweating a lot.",
  "Hydration supports clearer thinking and steadier energy.",
  "Sleep is a core part of wellness — protect it like a resource.",
  "A steady sleep routine does more than most supplements.",
  "Short rest breaks help your brain process the day.",
  "Deep breathing before meals can ease tension.",
  "Even a gentle stretch can restore focus.",
  "Movement counts even if it’s short or simple.",
  "You don’t need to ‘work out’ — moving your body is enough.",
  "A casual walk can reset your mind better than scrolling.",
  "Strength comes from small, repeated efforts.",
  "Your pace doesn't matter; showing up for yourself does.",
  "Mobility work is self-care disguised as exercise.",
  "A slow walk is still movement, not a failure.",
  "Some days you need intensity, some days gentleness.",
  "Move in ways that feel good, not punishing.",
  "Your body appreciates variety more than perfection.",
  "Food should support your life, not take it over.",
  "You don't have to earn your food — you need it.",
  "Cravings are messages, not problems.",
  "Satisfaction matters — bland meals aren’t sustainable.",
  "Eating regularly keeps your mind clearer and calmer.",
  "Feeling full is not failure — it's biology.",
  "Your body deserves to be fed even on stressful days.",
  "You can't out-discipline hunger; fuel works better.",
  "Emergency snacks prevent emergency stress.",
  "Allowing enjoyment helps reduce overeating later.",
  "A small reset moment can change the direction of your day.",
  "You don’t need motivation — tiny actions build momentum.",
  "Notice how foods make you feel, not how they make you look.",
  "Your worth has nothing to do with your plate.",
  "It’s okay to have days where you prioritize comfort.",
  "Wellness is not a competition — it’s a relationship with yourself.",
  "Consistency feels easier when it’s flexible, not strict.",
  "Self-kindness leads to better decisions than self-criticism.",
  "You don't have to be perfect to make progress.",
  "Listening to your body is a lifelong skill.",
  "A clean desk can refresh your mind more than you expect.",
  "Take 60 seconds to breathe — small resets matter.",
  "Being overwhelmed is a sign to pause, not push.",
  "Fresh air can improve your mood instantly.",
  "A short break can prevent a big burnout.",
  "Your brain focuses better with regular meals.",
  "Write down one thing you're grateful for — tiny habit, big shift.",
  "Music can regulate your mood surprisingly well.",
  "You don’t have to multitask — single-tasking works better.",
  "Let your future self benefit from your calm choices today.",
  "Stack tiny habits onto routines you already have.",
  "One small improvement repeated is more powerful than a big change once.",
  "A 1% better choice is still progress.",
  "Your habits don’t need to be aesthetic to be effective.",
  "Set up your kitchen so the easiest option is a good one.",
  "Make wellness simple enough that even tired-you can follow it.",
  "Default meals save brain energy.",
  "A little planning reduces a lot of stress later.",
  "Your systems should support you, not pressure you.",
  "Focus on what’s doable today, not what was ideal yesterday.",
  "Your feelings are valid even when they don’t make sense.",
  "Talking to someone you trust can help more than you expect.",
  "Your body reacts to stress — be gentle with it.",
  "A tough day doesn’t erase your progress.",
  "Rest is productive when you need it.",
  "You’re allowed to slow down when life gets loud.",
  "Take mental breaks without guilt.",
  "Being human means fluctuating energy — embrace it.",
  "Let yourself enjoy small pleasures without explaining them.",
  "Your wellbeing is worth time and attention.",
  "No single food defines your health — the big picture does.",
  "Enjoying dessert doesn’t cancel your nutrition.",
  "Balanced eating includes foods you love.",
  "Mindful enjoyment prevents overthinking later.",
  "There’s room for fun foods and nourishing foods.",
  "A flexible approach is healthier than a perfect one.",
  "Let go of labels like ‘good’ or ‘bad’ — food is just food.",
  "Your body knows what to do with consistent nourishment.",
  "Fullness is feedback, not failure.",
  "You deserve meals that keep you satisfied and happy.",
  "Celebrate small wins — they stack up quietly.",
  "You’re allowed to change direction anytime.",
  "Being kind to yourself is not weakness.",
  "Take moments to notice what already works for you.",
  "You don’t need to rush to be improving.",
  "Your body is on your team, even when you feel off.",
  "Take pride in caring about your wellbeing.",
  "One calm moment can change an entire chain of choices.",
  "You’re learning, not competing.",
  "Your journey is yours — no comparison needed."
];


const ProgressRing: React.FC<{
  size?: number;
  stroke?: number;
  progress: number;
}> = ({ size = 64, stroke = 8, progress }) => {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress || 0));
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${p * C} ${C - p * C}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-pct">{Math.round(p * 100)}%</div>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const history = useHistory();
  const location = useLocation();

  const { uid, profile, loading: profileLoading } = useProfile();

  const [loading, setLoading] = useState(true);
  const [activeDateKey, setActiveDateKey] = useState<string>(() => {
    const params = new URLSearchParams(location.search);
    const qDate = params.get("date");
    if (isDateKey(qDate)) {
      return clampDateKeyToToday(qDate);
    }
    return todayDateKey();
  });
  const [pendingDateKey, setPendingDateKey] = useState<string>(activeDateKey);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [dayData, setDayData] = useState<DayDiaryDoc>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  });

  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [workoutCalories, setWorkoutCalories] = useState<number>(0);

  const [streak, setStreak] = useState<number>(0);

  const [lastDeleted, setLastDeleted] = useState<{
    meal: MealKey;
    index: number;
    item: DiaryEntry;
  } | null>(null);

  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  const [copyMenuMeal, setCopyMenuMeal] = useState<MealKey | null>(null);
  const [dayMenuOpen, setDayMenuOpen] = useState(false);

  const [collapsedMeals, setCollapsedMeals] = useState<
    Record<MealKey, boolean>
  >({
    breakfast: false,
    lunch: false,
    dinner: false,
    snacks: false,
  });

  const [tipIndex, setTipIndex] = useState(() =>
    Math.floor(Math.random() * WELLNESS_TIPS.length)
  );

  const [quickAddMeal, setQuickAddMeal] = useState<MealKey | null>(null);

  const refreshStreak = useCallback(async (userId: string) => {
    const todayKeyValue = todayDateKey();
    let s = 0;
    for (let i = 0; i < 14; i++) {
      const offset = shiftDateKey(todayKeyValue, -i);
      const ds = await getDoc(doc(db, "users", userId, "foods", offset));
      const dd = ds.data() as Partial<DayDiaryDoc> | undefined;
      const any = !!(
        dd?.breakfast?.length ||
        dd?.lunch?.length ||
        dd?.dinner?.length ||
        dd?.snacks?.length
      );
      if (any) s++;
      else break;
    }
    setStreak(s);
    trackEvent("streak_calculated", { uid: userId, streak: s });
  }, []);

  useEffect(() => {
    if (profileLoading) return;

    if (!uid) {
      trackEvent("home_redirect_no_uid");
      history.replace("/login");
      return;
    }

    if (!profile || !profile.age) {
      trackEvent("home_redirect_no_profile", { uid });
      history.replace("/setup-profile");
      return;
    }

    setActiveDateKey((prev) => clampDateKeyToToday(prev));
    refreshStreak(uid);
  }, [profileLoading, uid, profile, history, refreshStreak]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    setLastDeleted(null);
    setDayData({ breakfast: [], lunch: [], dinner: [], snacks: [] });

    const ref = doc(db, "users", uid, "foods", activeDateKey);
    const unsub = onSnapshot(ref, (snap) => {
      const raw = snap.data() as Partial<DayDiaryDoc> | undefined;
      const nextDay: DayDiaryDoc = {
        breakfast: raw?.breakfast ?? [],
        lunch: raw?.lunch ?? [],
        dinner: raw?.dinner ?? [],
        snacks: raw?.snacks ?? [],
      };
      setDayData(nextDay);
      setLoading(false);
      refreshStreak(uid);

      const totalEntries =
        nextDay.breakfast.length +
        nextDay.lunch.length +
        nextDay.dinner.length +
        nextDay.snacks.length;

      trackEvent("day_diary_snapshot", {
        uid,
        date: activeDateKey,
        total_entries: totalEntries,
      });
    });

    return () => unsub();
  }, [uid, activeDateKey, refreshStreak]);

  useEffect(() => {
    if (!uid) return;
    setWorkouts([]);
    setWorkoutCalories(0);

    const ref = doc(db, "users", uid, "workouts", activeDateKey);
    const unsub = onSnapshot(ref, (snap) => {
      const raw = snap.data() as WorkoutDayDoc | undefined;
      const activities = raw?.activities ?? [];
      setWorkouts(activities);

      const totalBonus = activities.reduce((sum, activity) => {
        const calories =
          typeof activity?.calories === "number"
            ? activity.calories
            : (activity as any)?.caloriesBurned ?? 0;
        return sum + safeNum(calories);
      }, 0);

      setWorkoutCalories(Math.max(0, Math.round(totalBonus)));

      trackEvent("workout_snapshot", {
        uid,
        date: activeDateKey,
        total_activities: activities.length,
        calories_bonus: Math.round(totalBonus),
      });
    });

    return () => unsub();
  }, [uid, activeDateKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("date") === activeDateKey) return;
    params.set("date", activeDateKey);
    history.replace({
      pathname: location.pathname,
      search: `?${params.toString()}`,
    });
  }, [activeDateKey, history, location.pathname, location.search]);

  const todayKey = todayDateKey();
  const isToday = activeDateKey === todayKey;
  const activeDateLabel = formatDateKey(activeDateKey, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const showWellnessTip = profile?.showWellnessTip ?? true;

  // Prefer stored caloriesTarget from profile; fall back to formula if missing
  const caloriesNeeded = useMemo(() => {
    if (!profile) return null;

    const stored = (profile as any).caloriesTarget as number | undefined;
    if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
      return stored;
    }

    const { age, weight, height, gender, goal, activity } = profile as any;
    if (!age || !weight || !height || !gender) return null;

    let bmr =
      gender === "male"
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

    const mult =
      activity === "light"
        ? 1.375
        : activity === "moderate"
          ? 1.55
          : activity === "very"
            ? 1.725
            : activity === "extra"
              ? 1.9
              : 1.2;

    let daily = bmr * mult;
    if (goal === "lose") daily -= 500;
    else if (goal === "gain") daily += 500;

    return Math.max(800, Math.round(daily));
  }, [profile]);

  const totals = useMemo(() => {
    const sum = (arr: DiaryEntry[]) =>
      arr.reduce(
        (a, it) => ({
          calories: a.calories + (it.total?.calories || 0),
          carbs: a.carbs + (it.total?.carbs || 0),
          protein: a.protein + (it.total?.protein || 0),
          fat: a.fat + (it.total?.fat || 0),
        }),
        { calories: 0, carbs: 0, protein: 0, fat: 0 } as Macros
      );

    const perMeal = {
      breakfast: sum(dayData.breakfast),
      lunch: sum(dayData.lunch),
      dinner: sum(dayData.dinner),
      snacks: sum(dayData.snacks),
    };
    const day = Object.values(perMeal).reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        carbs: a.carbs + m.carbs,
        protein: a.protein + m.protein,
        fat: a.fat + m.fat,
      }),
      { calories: 0, carbs: 0, protein: 0, fat: 0 } as Macros
    );

    return { perMeal, day };
  }, [dayData]);

  const kcalConsumed = Math.round(Math.max(0, totals.day.calories));
  const baseKcalGoal = caloriesNeeded ?? 0;
  const kcalGoal = baseKcalGoal + workoutCalories;
  const kcalLeft = Math.max(0, Math.round(kcalGoal - kcalConsumed));
  const progress = kcalGoal > 0 ? Math.min(1, kcalConsumed / kcalGoal) : 0;
  const kcalDelta = kcalConsumed - kcalGoal;
  const summaryDifferenceLabel = isToday
    ? "Calories Remaining"
    : kcalDelta >= 0
      ? "Over target"
      : "Under target";
  const summaryDifferenceValue = isToday ? kcalLeft : Math.abs(kcalDelta);

  // Prefer stored macroTargets; fall back to formula if missing
  const macroTargets = useMemo(() => {
    if (!profile || !caloriesNeeded) return null;

    const stored = (profile as any).macroTargets as
      | { proteinG?: number; fatG?: number; carbsG?: number }
      | undefined;

    if (
      stored &&
      typeof stored.proteinG === "number" &&
      typeof stored.fatG === "number" &&
      typeof stored.carbsG === "number"
    ) {
      return {
        proteinG: stored.proteinG,
        fatG: stored.fatG,
        carbsG: stored.carbsG,
      };
    }

    const weight = (profile as any).weight as number | null;
    if (!weight) return null;

    const proteinG = Math.round(1.8 * weight);
    const proteinK = proteinG * 4;

    const fatByWeight = 0.8 * weight;
    const fatByPercent = (0.25 * caloriesNeeded) / 9;
    const fatG = Math.round(Math.max(50, fatByWeight, fatByPercent));
    const fatK = fatG * 9;

    const carbsG = Math.round(
      Math.max(0, caloriesNeeded - proteinK - fatK) / 4
    );

    return { proteinG, fatG, carbsG };
  }, [profile, caloriesNeeded]);

  const macroProgress = useMemo(() => {
    if (!macroTargets) return null;
    const day = totals.day;

    return [
      {
        key: "protein",
        label: "Protein",
        used: safeNum(day.protein),
        target: macroTargets.proteinG,
        color: "primary" as const,
      },
      {
        key: "carbs",
        label: "Carbs",
        used: safeNum(day.carbs),
        target: macroTargets.carbsG,
        color: "tertiary" as const,
      },
      {
        key: "fat",
        label: "Fat",
        used: safeNum(day.fat),
        target: macroTargets.fatG,
        color: "warning" as const,
      },
    ].map((m) => ({
      ...m,
      pct: m.target > 0 ? Math.min(1, m.used / m.target) : 0,
      remaining: Math.max(0, Math.round(m.target - m.used)),
    }));
  }, [macroTargets, totals.day]);

  const pretty = (s: string) => s[0].toUpperCase() + s.slice(1);

  const mealIcon: Record<MealKey, string> = {
    breakfast: sunnyOutline,
    lunch: restaurantOutline,
    dinner: cafeOutline,
    snacks: fastFoodOutline,
  };

  const deleteFood = async (meal: MealKey, index: number) => {
    if (!uid) return;
    const dayKey = activeDateKey;
    const current = dayData[meal] || [];
    if (index < 0 || index >= current.length) return;
    const item = current[index];

    trackEvent("food_delete_attempt", {
      uid,
      date: dayKey,
      meal,
      index,
      name: item.name,
    });

    const nextMealArr = [...current];
    nextMealArr.splice(index, 1);
    setDayData({ ...dayData, [meal]: nextMealArr });
    setLastDeleted({ meal, index, item });
    setToast({ open: true, message: `Removed ${item.name}.` });

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", dayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const arr: DiaryEntry[] = [...(data[meal] || [])];
        const idx = arr.findIndex((x) => x.addedAt === item.addedAt);
        if (idx >= 0) arr.splice(idx, 1);
        else if (index <= arr.length) arr.splice(index, 1);
        tx.set(ref, { [meal]: arr }, { merge: true });
      });

      trackEvent("food_deleted", {
        uid,
        date: dayKey,
        meal,
        index,
        name: item.name,
      });
    } catch {
      const reverted = [...(dayData[meal] || [])];
      reverted.splice(index, 0, item);
      setDayData({ ...dayData, [meal]: reverted });
      setLastDeleted(null);
      setToast({ open: true, message: "Delete failed." });

      trackEvent("food_delete_error", {
        uid,
        date: dayKey,
        meal,
        index,
        name: item.name,
      });
    }
  };

  const undoDelete = async () => {
    if (!uid || !lastDeleted) return;
    const { meal, index, item } = lastDeleted;
    const dayKey = activeDateKey;

    trackEvent("food_undo_delete_attempt", {
      uid,
      date: dayKey,
      meal,
      index,
      name: item.name,
    });

    const arr = [...(dayData[meal] || [])];
    const insertAt = Math.min(Math.max(index, 0), arr.length);
    arr.splice(insertAt, 0, item);
    setDayData({ ...dayData, [meal]: arr });
    setLastDeleted(null);

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", dayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const cur: DiaryEntry[] = [...(data[meal] || [])];

        const exists = cur.some((x) => x.addedAt === item.addedAt);
        if (!exists) {
          const pos = Math.min(Math.max(index, 0), cur.length);
          cur.splice(pos, 0, item);
          tx.set(ref, { [meal]: cur }, { merge: true });
        }
      });

      trackEvent("food_undo_delete_success", {
        uid,
        date: dayKey,
        meal,
        index,
        name: item.name,
      });
    } catch {
      const arr2 = [...(dayData[meal] || [])];
      const i2 = arr2.findIndex((x) => x.addedAt === item.addedAt);
      if (i2 >= 0) {
        arr2.splice(i2, 1);
        setDayData({ ...dayData, [meal]: arr2 });
      }
      setToast({ open: true, message: "Undo failed." });

      trackEvent("food_undo_delete_error", {
        uid,
        date: dayKey,
        meal,
        index,
        name: item.name,
      });
    }
  };

  const clearMeal = async (meal: MealKey) => {
    if (!uid) return;
    if (!window.confirm(`Remove all foods from ${meal}?`)) return;

    const dayKey = activeDateKey;

    trackEvent("meal_clear_confirmed", {
      uid,
      date: dayKey,
      meal,
      count: (dayData[meal] || []).length,
    });

    const emptyMeal: DiaryEntry[] = [];
    setDayData((prev) => ({
      ...prev,
      [meal]: emptyMeal,
    }));

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", dayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        tx.set(ref, { ...data, [meal]: emptyMeal }, { merge: true });
      });
      setToast({ open: true, message: `Removed all foods from ${meal}.` });

      trackEvent("meal_cleared_success", { uid, date: dayKey, meal });
    } catch {
      setToast({ open: true, message: "Could not clear this meal." });

      trackEvent("meal_cleared_error", { uid, date: dayKey, meal });
    }
  };

  const copyMealFromYesterday = async (meal: MealKey) => {
    if (!uid) return;

    const todayKeyValue = activeDateKey;
    const yesterdayKey = shiftDateKey(todayKeyValue, -1);

    trackEvent("meal_copy_from_yesterday_attempt", {
      uid,
      today: todayKeyValue,
      yesterday: yesterdayKey,
      meal,
    });

    try {
      await runTransaction(db, async (tx) => {
        const yRef = doc(db, "users", uid, "foods", yesterdayKey);
        const tRef = doc(db, "users", uid, "foods", todayKeyValue);

        const [ySnap, tSnap] = await Promise.all([tx.get(yRef), tx.get(tRef)]);
        const yData = ySnap.data() || {};
        const tData = tSnap.data() || {};

        const yArr: DiaryEntry[] = yData[meal] || [];
        const curArr: DiaryEntry[] = tData[meal] || [];

        if (!yArr.length) {
          throw new Error("No entries to copy from yesterday.");
        }
        if (curArr.length) {
          throw new Error("This meal already has entries today.");
        }

        tx.set(
          tRef,
          {
            ...tData,
            [meal]: yArr,
          },
          { merge: true }
        );
      });

      setToast({
        open: true,
        message: `Copied ${pretty(meal)} from yesterday.`,
      });

      trackEvent("meal_copy_from_yesterday_success", {
        uid,
        today: todayKeyValue,
        yesterday: yesterdayKey,
        meal,
      });
    } catch (e: any) {
      setToast({
        open: true,
        message: e?.message || "Could not copy from yesterday.",
      });

      trackEvent("meal_copy_from_yesterday_error", {
        uid,
        today: todayKeyValue,
        yesterday: yesterdayKey,
        meal,
        error: e?.message || String(e),
      });
    } finally {
      setCopyMenuMeal(null);
    }
  };

  const clearDay = async () => {
    if (!uid) return;
    if (!window.confirm("Remove all foods from this day?")) return;

    const dayKey = activeDateKey;

    const empty: DayDiaryDoc = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    };

    trackEvent("day_clear_confirmed", {
      uid,
      date: dayKey,
    });

    setDayData(empty);

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", dayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        tx.set(
          ref,
          {
            ...data,
            breakfast: [],
            lunch: [],
            dinner: [],
            snacks: [],
          },
          { merge: true }
        );
      });
      setToast({ open: true, message: "Cleared all meals for this day." });

      trackEvent("day_clear_success", { uid, date: dayKey });
    } catch {
      setToast({ open: true, message: "Could not clear this day." });

      trackEvent("day_clear_error", { uid, date: dayKey });
    }
  };

  const copyDayFromYesterday = async () => {
    if (!uid) return;

    const todayKeyValue = activeDateKey;
    const yesterdayKey = shiftDateKey(todayKeyValue, -1);

    trackEvent("day_copy_from_yesterday_attempt", {
      uid,
      today: todayKeyValue,
      yesterday: yesterdayKey,
    });

    try {
      await runTransaction(db, async (tx) => {
        const yRef = doc(db, "users", uid, "foods", yesterdayKey);
        const tRef = doc(db, "users", uid, "foods", todayKeyValue);

        const [ySnap, tSnap] = await Promise.all([tx.get(yRef), tx.get(tRef)]);
        const yData = ySnap.data() || {};
        const tData = tSnap.data() || {};

        const yDay: DayDiaryDoc = {
          breakfast: yData.breakfast || [],
          lunch: yData.lunch || [],
          dinner: yData.dinner || [],
          snacks: yData.snacks || [],
        };

        const tDay: DayDiaryDoc = {
          breakfast: tData.breakfast || [],
          lunch: tData.lunch || [],
          dinner: tData.dinner || [],
          snacks: tData.snacks || [],
        };

        const yHasAny =
          yDay.breakfast.length ||
          yDay.lunch.length ||
          yDay.dinner.length ||
          yDay.snacks.length;

        if (!yHasAny) {
          throw new Error("No entries to copy from yesterday.");
        }

        const tHasAny =
          tDay.breakfast.length ||
          tDay.lunch.length ||
          tDay.dinner.length ||
          tDay.snacks.length;

        if (tHasAny) {
          throw new Error("This day already has entries.");
        }

        tx.set(
          tRef,
          {
            ...tData,
            breakfast: yDay.breakfast,
            lunch: yDay.lunch,
            dinner: yDay.dinner,
            snacks: yDay.snacks,
          },
          { merge: true }
        );
      });

      setToast({
        open: true,
        message: "Copied entire day from yesterday.",
      });

      trackEvent("day_copy_from_yesterday_success", {
        uid,
        today: todayKeyValue,
        yesterday: yesterdayKey,
      });
    } catch (e: any) {
      setToast({
        open: true,
        message: e?.message || "Could not copy entire day.",
      });

      trackEvent("day_copy_from_yesterday_error", {
        uid,
        today: todayKeyValue,
        yesterday: yesterdayKey,
        error: e?.message || String(e),
      });
    } finally {
      setDayMenuOpen(false);
    }
  };

  const handleReorder = async (meal: MealKey, ev: CustomEvent) => {
    if (!uid) {
      (ev as any).detail.complete();
      return;
    }
    const from = (ev as any).detail.from as number;
    const to = (ev as any).detail.to as number;

    trackEvent("meal_reorder_attempt", {
      uid,
      date: activeDateKey,
      meal,
      from,
      to,
    });

    setDayData((prev) => {
      const current = [...(prev[meal] || [])];
      if (from < 0 || from >= current.length) return prev;
      const [moved] = current.splice(from, 1);
      current.splice(to, 0, moved);
      return { ...prev, [meal]: current };
    });

    (ev as any).detail.complete();

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", activeDateKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const arr: DiaryEntry[] = [...(data[meal] || [])];
        if (from < 0 || from >= arr.length) return;
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        tx.set(ref, { ...data, [meal]: arr }, { merge: true });
      });

      trackEvent("meal_reorder_success", {
        uid,
        date: activeDateKey,
        meal,
        from,
        to,
      });
    } catch {
      setToast({ open: true, message: "Reorder failed." });

      trackEvent("meal_reorder_error", {
        uid,
        date: activeDateKey,
        meal,
        from,
        to,
      });
    }
  };

  const addQuickCalories = async (
    meal: MealKey,
    form: { calories?: string; protein?: string; carbs?: string; fat?: string; note?: string }
  ) => {
    if (!uid) return false;

    const calories = safeNum(form.calories, 0);
    const protein = safeNum(form.protein, 1);
    const carbs = safeNum(form.carbs, 1);
    const fat = safeNum(form.fat, 1);

    if (calories <= 0) {
      setToast({ open: true, message: "Enter calories to quick add." });
      trackEvent("quick_add_invalid", { uid, meal, reason: "no_calories" });
      return false;
    }

    const entry: DiaryEntry = {
      fdcId: Date.now(),
      name: "Quick add",
      brand: form.note || "Manual entry",
      total: {
        calories,
        protein,
        carbs,
        fat,
      },
      addedAt: new Date().toISOString(),
      note: form.note,
      dataType: "quick_add",
    };

    setDayData((prev) => {
      const nextMeal = [...(prev[meal] || []), entry];
      return { ...prev, [meal]: nextMeal };
    });

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", activeDateKey);
        const snap = await tx.get(ref);
        const data = (snap.data() as DayDiaryDoc | undefined) || {
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: [],
        };

        const updated = { ...data } as DayDiaryDoc;
        const current = Array.isArray(updated[meal]) ? updated[meal] : [];
        updated[meal] = [...current, entry];

        tx.set(ref, updated, { merge: true });
      });

      setToast({ open: true, message: "Quick add logged." });
      trackEvent("quick_add_success", { uid, meal, date: activeDateKey });
    } catch (err: any) {
      console.error("quick add failed", err);
      setToast({ open: true, message: "Could not save quick add." });
      trackEvent("quick_add_error", {
        uid,
        meal,
        date: activeDateKey,
        error: err?.message || String(err),
      });
    }

    return true;
  };

  const ringColor =
    progress <= 0.9
      ? "var(--ion-color-success)"
      : progress <= 1.1
        ? "var(--ion-color-warning)"
        : "var(--ion-color-danger)";

  const goRelativeDay = (delta: number) => {
    setActiveDateKey((prev) => {
      const next = clampDateKeyToToday(shiftDateKey(prev, delta));
      if (next !== prev) {
        trackEvent("day_navigate_relative", {
          uid,
          from: prev,
          to: next,
          delta,
        });
      }
      return next;
    });
  };

  const openPicker = () => {
    setPendingDateKey(activeDateKey);
    setShowDatePicker(true);
    trackEvent("day_picker_open", { uid, date: activeDateKey });
  };

  const confirmPicker = () => {
    const from = activeDateKey;
    const to = clampDateKeyToToday(pendingDateKey);
    setActiveDateKey(to);
    setShowDatePicker(false);
    if (from !== to) {
      trackEvent("day_picker_confirm", { uid, from, to });
    }
  };

  const handleDateChange = (value: string | null | undefined) => {
    if (!value) return;
    const key = value.split("T")[0];
    if (isDateKey(key)) {
      const clamped = clampDateKeyToToday(key);
      setPendingDateKey(clamped);
      trackEvent("day_picker_change_pending", {
        uid,
        value: key,
        pending: clamped,
      });
    }
  };

  const toggleMealCollapsed = (meal: MealKey) => {
    setCollapsedMeals((prev) => {
      const nextState = !prev[meal];
      trackEvent("meal_toggle_collapsed", {
        uid,
        date: activeDateKey,
        meal,
        collapsed: nextState,
      });
      return {
        ...prev,
        [meal]: nextState,
      };
    });
  };

  const anyItems =
    dayData.breakfast.length +
    dayData.lunch.length +
    dayData.dinner.length +
    dayData.snacks.length >
    0;

  const hasEverLoggedFood = !!(profile as any)?.hasEverLoggedFood;

  const shuffleTip = () => {
    setTipIndex((prev) => {
      if (WELLNESS_TIPS.length <= 1) return prev;
      const next =
        (prev + 1 + Math.floor(Math.random() * (WELLNESS_TIPS.length - 1))) %
        WELLNESS_TIPS.length;

      trackEvent("wellness_tip_shuffled", {
        uid,
        date: activeDateKey,
        next_tip_index: next,
      });

      return next;
    });
  };

  const copyDaySummary = async () => {
    if (!profile || caloriesNeeded == null || !macroTargets) return;

    const lines = [
      `${activeDateLabel} — ${kcalConsumed} kcal consumed`,
      `Goal: ${kcalGoal} kcal (${summaryDifferenceLabel}: ${summaryDifferenceValue} kcal)`,
      `Carbs: ${Math.round(totals.day.carbs)} / ${macroTargets.carbsG} g`,
      `Protein: ${Math.round(totals.day.protein)} / ${macroTargets.proteinG} g`,
      `Fat: ${Math.round(totals.day.fat)} / ${macroTargets.fatG} g`,
      streak > 1 ? `Streak: ${streak} days` : null,
    ].filter(Boolean);

    const summaryText = lines.join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = summaryText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setToast({ open: true, message: "Summary copied to clipboard." });
      trackEvent("day_summary_copied", {
        uid,
        date: activeDateKey,
        kcalConsumed,
        kcalGoal,
      });
    } catch (err: any) {
      console.error("Failed to copy summary", err);
      setToast({ open: true, message: "Could not copy summary." });
      trackEvent("day_summary_copy_failed", {
        uid,
        date: activeDateKey,
        error: err?.message || String(err),
      });
    }
  };

  useEffect(() => {
    if (!uid) return;
    if (!anyItems) return;
    if ((profile as any)?.hasEverLoggedFood === true) return;

    const ref = doc(db, "users", uid);
    updateDoc(ref, { "profile.hasEverLoggedFood": true })
      .then(() => {
        trackEvent("profile_has_ever_logged_food_set", {
          uid,
          date: activeDateKey,
        });
      })
      .catch((err) => {
        console.error("Failed to set hasEverLoggedFood:", err);
      });
  }, [uid, anyItems, profile, activeDateKey]);


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Daily dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="home-content ion-padding tabbed-content" fullscreen>
        <div className="fs-datebar" role="group" aria-label="Select day">
          <IonButton
            fill="clear"
            shape="round"
            onClick={() => goRelativeDay(-1)}
            aria-label="Previous day"
          >
            <IonIcon icon={chevronBackOutline} />
          </IonButton>

          <IonButton className="fs-datebtn" fill="outline" onClick={openPicker}>
            <IonIcon slot="start" icon={calendarOutline} />
            <span className="fs-datebtn__label">{activeDateLabel}</span>
            {isToday && (
              <IonBadge color="success" className="fs-datebtn__badge">
                Today
              </IonBadge>
            )}
          </IonButton>

          <IonButton
            fill="clear"
            shape="round"
            onClick={() => goRelativeDay(1)}
            aria-label="Next day"
            disabled={isToday}
          >
            <IonIcon icon={chevronForwardOutline} />
          </IonButton>

          <IonButton
            fill="clear"
            shape="round"
            onClick={() => {
              setDayMenuOpen(true);
              trackEvent("day_menu_open", { uid, date: activeDateKey });
            }}
            aria-label="Day options"
          >
            <IonIcon icon={ellipsisVertical} />
          </IonButton>
        </div>

        <IonCard className="fs-summary">
          <IonCardHeader className="fs-summary__hdr">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <IonCardTitle>{isToday ? "Today" : "Summary"}</IonCardTitle>
              {streak > 1 && (
                <IonChip color="success" style={{ marginInlineStart: 8 }}>
                  <IonIcon icon={flameOutline} />
                  <span style={{ marginLeft: 4 }}>{streak}-day streak</span>
                </IonChip>
              )}
            </div>
          </IonCardHeader>

          <IonCardContent className="fs-summary__row">
            {!profile || caloriesNeeded == null ? (
              <div className="ion-text-center" style={{ padding: 24 }}>
                <IonSpinner name="dots" />
              </div>
            ) : (
              <>
              <div className="fs-summary__left" style={{ color: ringColor }}>
                <ProgressRing size={64} stroke={8} progress={progress} />
              </div>
              <div className="fs-summary__mid">
                <div className="fs-metric-title">
                  {summaryDifferenceLabel}
                </div>
                <div className="fs-metric-subtitle">
                  Goal {kcalGoal} kcal · {workoutCalories} from activity
                </div>
              </div>
              <div className="fs-summary__right">
                <div className="fs-metric-value">
                  {summaryDifferenceValue}
                </div>
                <div className="fs-metric-subvalue">{kcalConsumed} eaten</div>
              </div>
            </>
          )}
          </IonCardContent>

          {profile && caloriesNeeded != null && (
            <div className="fs-summary__meta">
              <div>
                <div className="fs-summary__meta-label">Base goal</div>
                <div className="fs-summary__meta-value">{baseKcalGoal}</div>
              </div>
              <div>
                <div className="fs-summary__meta-label">Activity bonus</div>
                <div className="fs-summary__meta-value">
                  +{workoutCalories} kcal
                </div>
              </div>
              <div>
                <div className="fs-summary__meta-label">Adjusted goal</div>
                <div className="fs-summary__meta-value">{kcalGoal}</div>
              </div>
            </div>
          )}

          {profile && caloriesNeeded != null && macroProgress && (
            <div className="fs-macro-progress">
              <div className="fs-macro-progress__hdr">
                <IonText className="fs-macro-progress__title">
                  Macro targets
                </IonText>
                <IonText color="medium" className="fs-macro-progress__caption">
                  Watch grams left in real time
                </IonText>
              </div>
              <div className="fs-macro-progress__grid">
                {macroProgress.map((macro) => (
                  <div key={macro.key} className="fs-macro-progress__item">
                    <div className="fs-macro-progress__top">
                      <span>{macro.label}</span>
                      <span>
                        {Math.round(macro.used)} / {macro.target} g
                      </span>
                    </div>
                    <IonProgressBar
                      value={macro.pct}
                      color={macro.color}
                      className="fs-macro-progress__bar"
                    />
                    <div className="fs-macro-progress__foot">
                      <span>{macro.remaining} g left</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </IonCard>

        {showWellnessTip && (
          <IonCard className="fs-tip-card">
            <IonCardHeader className="fs-tip-card__hdr">
              <div className="fs-tip-card__title">
                <IonIcon icon={bulbOutline} aria-hidden="true" />
                <IonCardTitle>Wellness tip</IonCardTitle>
              </div>
            </IonCardHeader>
            <IonCardContent className="fs-tip-card__content">
              <p className="fs-tip-card__text">{WELLNESS_TIPS[tipIndex]}</p>
              <IonButton size="small" fill="outline" onClick={shuffleTip}>
                New tip
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}

        {loading && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {!loading && !anyItems && !hasEverLoggedFood && (
          <div
            style={{
              marginTop: 24,
              padding: 24,
              textAlign: "center",
              opacity: 0.9,
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
              No foods logged yet
            </h2>
            <p style={{ marginTop: 8, fontSize: "0.95rem" }}>
              Tap any meal below to start adding foods and see your stats
              update.
            </p>
            <IonButton
              style={{ marginTop: 12 }}
              onClick={() => {
                trackEvent("home_empty_state_add_food_tap", {
                  uid,
                  date: activeDateKey,
                });
                history.push(`/add-food?meal=breakfast&date=${activeDateKey}`);
              }}
            >
              Add your first food
            </IonButton>
          </div>
        )}

        {!loading &&
          MEALS.map((meal) => {
            const items = dayData[meal] || [];
            const hasItems = items.length > 0;
            const isCollapsed = collapsedMeals[meal];

            const mealTotals = totals.perMeal[meal];
            const hasMealTotals =
              mealTotals &&
              (mealTotals.calories > 0 ||
                mealTotals.carbs > 0 ||
                mealTotals.protein > 0 ||
                mealTotals.fat > 0);

            return (
              <IonCard
                key={meal}
                className={`fs-meal ${hasItems ? "is-open" : ""}`}
              >
                <IonCardHeader className="fs-meal__hdr">
                  <IonItem
                    lines="none"
                    className="fs-meal__row"
                    detail={false}
                    button
                    onClick={() => toggleMealCollapsed(meal)}
                  >
                    <IonIcon
                      slot="start"
                      className="fs-meal__icon"
                      icon={mealIcon[meal]}
                      aria-hidden="true"
                    />

                    {/* TITLE + TOTALS STACK */}
                    <div className="fs-meal__title">
                      <h2 className="fs-meal__title-text">{pretty(meal)}</h2>

                      {hasMealTotals && !isCollapsed && (
                        <div className="fs-meal__totals">
                          {Math.round(mealTotals.calories)} kcal · Carbohydrates{" "}
                          {mealTotals.carbs.toFixed(0)} g · Protein{" "}
                          {mealTotals.protein.toFixed(0)} g · Fat{" "}
                          {mealTotals.fat.toFixed(0)} g
                        </div>
                      )}
                    </div>

                    <IonIcon
                      slot="end"
                      className="fs-meal__chevron"
                      icon={isCollapsed ? chevronDownOutline : chevronUpOutline}
                      aria-hidden="true"
                    />

                    <IonButton
                      slot="end"
                      className="fs-meal__add"
                      fill="clear"
                      onClick={(e) => {
                        e.stopPropagation();
                        trackEvent("navigate_add_food", {
                          uid,
                          date: activeDateKey,
                          meal,
                          has_items: hasItems,
                        });
                        history.push(`/add-food?meal=${meal}&date=${activeDateKey}`);
                      }}
                      aria-label={`Add to ${meal}`}
                    >
                      <IonIcon icon={addCircleOutline} />
                    </IonButton>
                  </IonItem>
                </IonCardHeader>

                {!isCollapsed && (
                  <IonCardContent>
                    <div className="fs-meal__actions">
                      <IonButton
                        size="small"
                        fill="solid"
                        color="dark"
                        onClick={() => {
                          setQuickAddMeal(meal);
                          trackEvent("quick_add_open", {
                            uid,
                            date: activeDateKey,
                            meal,
                          });
                        }}
                      >
                        Quick add
                      </IonButton>

                      <IonButton
                        size="small"
                        fill="outline"
                        onClick={() => {
                          setCopyMenuMeal(meal);
                          trackEvent("meal_more_options_open", {
                            uid,
                            date: activeDateKey,
                            meal,
                          });
                        }}
                      >
                        More options
                      </IonButton>
                    </div>

                    {!hasItems && (
                      <IonText color="medium" className="fs-meal__hint">
                        Start with a quick add or tap the plus button to search
                        foods.
                      </IonText>
                    )}

                    {hasItems && (
                      <IonList>
                        <IonReorderGroup
                          disabled={false}
                          onIonItemReorder={(ev) => handleReorder(meal, ev as any)}
                        >
                          {items.map((it, idx) => {
                            const t: any = it.total || {
                              calories: 0,
                              carbs: 0,
                              protein: 0,
                              fat: 0,
                            };
                            const kcal = Math.round(t.calories || 0);
                            const carbs =
                              typeof t.carbs === "number" ? t.carbs : 0;
                            const protein =
                              typeof t.protein === "number" ? t.protein : 0;
                            const fat =
                              typeof t.fat === "number" ? t.fat : 0;

                            const sugar =
                              typeof t.sugar === "number" ? t.sugar : null;
                            const fiber =
                              typeof t.fiber === "number" ? t.fiber : null;
                            const satFat =
                              typeof t.saturatedFat === "number"
                                ? t.saturatedFat
                                : null;
                            const salt =
                              typeof t.salt === "number" ? t.salt : null;

                            const hasMicros =
                              sugar !== null ||
                              fiber !== null ||
                              satFat !== null ||
                              salt !== null;

                            return (
                              <IonItem
                                key={`${it.addedAt}-${idx}`}
                                className="meal-item"
                                button
                                detail={false}
                                onClick={() => {
                                  trackEvent("meal_item_edit_via_add_food", {
                                    uid,
                                    date: activeDateKey,
                                    meal,
                                    index: idx,
                                    name: it.name,
                                  });

                                  history.push({
                                    pathname: "/add-food",
                                    search: `?meal=${meal}&date=${activeDateKey}`,
                                    state: {
                                      editEntry: {
                                        meal,
                                        index: idx,
                                        item: it,
                                      },
                                    },
                                  });
                                }}
                              >
                                <IonReorder slot="start" />
                                <IonLabel>
                                  <h2>
                                    {it.name}
                                    {it.brand ? ` · ${it.brand}` : ""}
                                  </h2>
                                  <p className="meal-item-macros">
                                    Carbs {carbs.toFixed(1)} g · Protein{" "}
                                    {protein.toFixed(1)} g · Fat{" "}
                                    {fat.toFixed(1)} g
                                  </p>
                                  {hasMicros && (
                                    <p className="meal-item-micros">
                                      {sugar !== null && (
                                        <span>Sugar {sugar.toFixed(1)} g</span>
                                      )}
                                      {fiber !== null && (
                                        <span>
                                          {" "}
                                          · Fiber {fiber.toFixed(1)} g
                                        </span>
                                      )}
                                      {satFat !== null && (
                                        <span>
                                          {" "}
                                          · Sat. fat {satFat.toFixed(1)} g
                                        </span>
                                      )}
                                      {salt !== null && (
                                        <span>
                                          {" "}
                                          · Salt {salt.toFixed(1)} g
                                        </span>
                                      )}
                                    </p>
                                  )}
                                </IonLabel>

                                <IonButton
                                  slot="end"
                                  fill="clear"
                                  aria-label={`Remove ${it.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFood(meal, idx);
                                  }}
                                  className="del-btn"
                                >
                                  <IonIcon icon={trashOutline} />
                                </IonButton>

                                <div className="kcal-badge" slot="end">
                                  {kcal} kcal
                                </div>
                              </IonItem>
                            );
                          })}
                      </IonReorderGroup>
                    </IonList>
                  )}
                  </IonCardContent>
                )}
              </IonCard>
            );
          })}

        <IonActionSheet
          isOpen={copyMenuMeal !== null}
          onDidDismiss={() => {
            setCopyMenuMeal(null);
            trackEvent("meal_more_options_close", {
              uid,
              date: activeDateKey,
            });
          }}
          header={
            copyMenuMeal ? `Actions for ${pretty(copyMenuMeal)}` : undefined
          }
          buttons={[
            {
              text: "Copy foods from yesterday",
              handler: () => {
                if (copyMenuMeal) {
                  copyMealFromYesterday(copyMenuMeal);
                }
              },
            },
            {
              text: "Remove all foods from this meal",
              role: "destructive",
              handler: () => {
                if (copyMenuMeal) {
                  clearMeal(copyMenuMeal);
                }
              },
            },

            {
              text: "Cancel",
              role: "cancel",
            },
          ]}
        />

        <IonActionSheet
          isOpen={dayMenuOpen}
          onDidDismiss={() => {
            setDayMenuOpen(false);
            trackEvent("day_menu_close", { uid, date: activeDateKey });
          }}
          header="Day actions"
          buttons={[
            {
              text: "Copy entire day from yesterday",
              handler: () => {
                copyDayFromYesterday();
              },
            },
            {
              text: "Copy summary to clipboard",
              handler: () => {
                if (copyMenuMeal) {
                  copyDaySummary();
                }
              },
            },
            {
              text: "Clear all meals for this day",
              role: "destructive",
              handler: () => {
                clearDay();
              },
            },
            {
              text: "Cancel",
              role: "cancel",
            },
          ]}
        />

        <IonAlert
          isOpen={!!quickAddMeal}
          onDidDismiss={() => setQuickAddMeal(null)}
          header="Quick add entry"
          subHeader="Drop in calories without searching"
          inputs={[
            {
              name: "calories",
              type: "number",
              placeholder: "Calories",
              attributes: { inputmode: "decimal", min: 0 },
            },
            {
              name: "protein",
              type: "number",
              placeholder: "Protein (g)",
              attributes: { inputmode: "decimal", min: 0 },
            },
            {
              name: "carbs",
              type: "number",
              placeholder: "Carbs (g)",
              attributes: { inputmode: "decimal", min: 0 },
            },
            {
              name: "fat",
              type: "number",
              placeholder: "Fat (g)",
              attributes: { inputmode: "decimal", min: 0 },
            },
            {
              name: "note",
              type: "text",
              placeholder: "Optional label (e.g. latte)",
            },
          ]}
          buttons={[
            {
              text: "Cancel",
              role: "cancel",
              handler: () => setQuickAddMeal(null),
            },
            {
              text: "Add",
              handler: (data) => {
                if (quickAddMeal) {
                  addQuickCalories(quickAddMeal, data);
                }
                setQuickAddMeal(null);
                return true;
              },
            },
          ]}
        />

        <IonToast
          isOpen={toast.open}
          message={toast.message}
          duration={2500}
          buttons={[
            {
              text: "Undo",
              role: "cancel",
              side: "end",
              handler: () => undoDelete(),
            },
          ]}
          onDidDismiss={() => setToast({ open: false, message: "" })}
        />
      </IonContent>

      <IonModal
        isOpen={showDatePicker}
        onDidDismiss={() => {
          setShowDatePicker(false);
          trackEvent("day_picker_dismiss", { uid, date: activeDateKey });
        }}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>Select a day</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding home-content tabbed-content" fullscreen>
          <IonDatetime
            className="fs-datepicker"
            presentation="date"
            value={`${pendingDateKey}T00:00:00`}
            max={`${todayKey}T23:59:59`}
            onIonChange={(e) => handleDateChange(e.detail.value?.toString())}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => {
                setShowDatePicker(false);
                trackEvent("day_picker_cancel", {
                  uid,
                  active: activeDateKey,
                  pending: pendingDateKey,
                });
              }}
            >
              Cancel
            </IonButton>
            <IonButton expand="block" onClick={confirmPicker}>
              View day
            </IonButton>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default Home;
