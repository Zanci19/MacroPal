import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
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
  IonButtons,
  IonInput,
  IonThumbnail,
  IonText,
  IonAlert,
} from "@ionic/react";
import {
  addCircleOutline,
  sunnyOutline,
  restaurantOutline,
  cafeOutline,
  fastFoodOutline,
  flameOutline,
  bulbOutline,
  chevronBackOutline,
  chevronForwardOutline,
  calendarOutline,
  ellipsisVertical,
  chevronDownOutline,
  chevronUpOutline,
} from "ionicons/icons";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import type { Swiper as SwiperClass } from "swiper";
import { useHistory, useLocation } from "react-router";
import { db, trackEvent } from "../../firebase";
import {
  doc,
  addDoc,
  collection,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  setDoc,
} from "firebase/firestore";
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
  MealTemplate,
  WorkoutDayDoc,
  WorkoutEntry,
} from "../../types";
import type { WeighInEntry } from "../../types";
import { useProfile } from "../../hooks/useProfile";
import {
  fromMetricWeight,
  getUnitSystem,
  toMetricWeight,
  weightLabel,
} from "../../utils/units";
import {
  INSPIRATIONAL_QUOTES,
  type InspirationalQuote,
} from "../../data/inspirationalQuotes";

function safeNum(n: unknown, dp = 2): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  const factor = Math.pow(10, dp);
  return Math.round(v * factor) / factor;
}

const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

const ZEN_QUOTES_ENDPOINT = "https://zenquotes.io/api/random";
const INSPIRATIONAL_QUOTE_SLIDE_INDEX = 3;

const getFallbackQuote = (): InspirationalQuote => {
  const index = Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length);
  return INSPIRATIONAL_QUOTES[index];
};


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
  const [templateMenuMeal, setTemplateMenuMeal] = useState<MealKey | null>(null);
  const [mealTemplates, setMealTemplates] = useState<
    { id: string; data: MealTemplate }[]
  >([]);
  const [templatePromptOpen, setTemplatePromptOpen] = useState(false);
  const [templateTargetMeal, setTemplateTargetMeal] = useState<MealKey | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [foodMenuEntry, setFoodMenuEntry] = useState<{
    meal: MealKey;
    index: number;
    name: string;
  } | null>(null);
  const [showWeighInModal, setShowWeighInModal] = useState(false);
  const [weighInValue, setWeighInValue] = useState<string>("");
  const [weighInToast, setWeighInToast] = useState<{
    open: boolean;
    message: string;
    color?: string;
  }>({
    open: false,
    message: "",
    color: "success",
  });
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const quoteHasLoadedRef = useRef(false);

  const [collapsedMeals, setCollapsedMeals] = useState<
    Record<MealKey, boolean>
  >({
    breakfast: true,
    lunch: true,
    dinner: true,
    snacks: true,
  });
  const collapsedInitKeyRef = useRef<string | null>(null);

  const [quote, setQuote] = useState<InspirationalQuote>(() =>
    getFallbackQuote()
  );
  const unitSystem = getUnitSystem(profile?.units);

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
      history.replace("/onboarding-profile");
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
    collapsedInitKeyRef.current = null;

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
      if (collapsedInitKeyRef.current !== activeDateKey) {
        setCollapsedMeals({
          breakfast: nextDay.breakfast.length === 0,
          lunch: nextDay.lunch.length === 0,
          dinner: nextDay.dinner.length === 0,
          snacks: nextDay.snacks.length === 0,
        });
        collapsedInitKeyRef.current = activeDateKey;
      }
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
    setWorkoutCalories(0);

    const ref = doc(db, "users", uid, "workouts", activeDateKey);
    const unsub = onSnapshot(ref, (snap) => {
      const raw = snap.data() as WorkoutDayDoc | undefined;
      const activities = raw?.activities ?? [];

      const totalBonus = activities.reduce((sum, activity) => {
        const calories =
          typeof activity?.calories === "number"
            ? activity.calories
            : (activity as Record<string, unknown>)?.caloriesBurned ?? 0;
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
  const summarySwiperRef = useRef<SwiperClass | null>(null);

  // Prefer stored caloriesTarget from profile; fall back to formula if missing
  const caloriesNeeded = useMemo(() => {
    if (!profile) return null;

    const stored = (profile as { caloriesTarget?: number }).caloriesTarget;
    if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
      return stored;
    }

    const { age, weight, height, gender, goal, activity } = profile;
    if (!age || !weight || !height || !gender) return null;

    const bmr =
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
          sugar: a.sugar + (it.total?.sugar || 0),
          fiber: a.fiber + (it.total?.fiber || 0),
          saturatedFat: a.saturatedFat + (it.total?.saturatedFat || 0),
        }),
        {
          calories: 0,
          carbs: 0,
          protein: 0,
          fat: 0,
          sugar: 0,
          fiber: 0,
          saturatedFat: 0,
        }
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
        sugar: a.sugar + m.sugar,
        fiber: a.fiber + m.fiber,
        saturatedFat: a.saturatedFat + m.saturatedFat,
      }),
      {
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        sugar: 0,
        fiber: 0,
        saturatedFat: 0,
      }
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

    const stored = (profile as { macroTargets?: { proteinG?: number; fatG?: number; carbsG?: number } }).macroTargets;

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

    const { weight } = profile;
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

  const pretty = (s: string) => s[0].toUpperCase() + s.slice(1);

  useEffect(() => {
    if (!uid) return;

    const templatesRef = collection(db, "users", uid, "mealTemplates");
    const templatesQuery = query(templatesRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(templatesQuery, (snapshot) => {
      const next = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data() as MealTemplate,
      }));
      setMealTemplates(next);
    });

    return () => unsubscribe();
  }, [uid]);

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
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      setToast({
        open: true,
        message: error.message || "Could not copy from yesterday.",
      });

      trackEvent("meal_copy_from_yesterday_error", {
        uid,
        today: todayKeyValue,
        yesterday: yesterdayKey,
        meal,
        error: error.message || String(e),
      });
    } finally {
      setCopyMenuMeal(null);
    }
  };

  const saveMealAsTemplate = async (meal: MealKey, name: string) => {
    if (!uid) return;

    const items = dayData[meal] || [];
    if (!items.length) {
      setToast({ open: true, message: "This meal has no foods to save." });
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setToast({ open: true, message: "Please provide a template name." });
      return;
    }

    trackEvent("meal_template_save_attempt", { uid, meal, name: trimmedName });

    try {
      await addDoc(collection(db, "users", uid, "mealTemplates"), {
        name: trimmedName,
        items,
        createdAt: new Date().toISOString(),
      } satisfies MealTemplate);
      setToast({ open: true, message: `Saved template: ${trimmedName}.` });
      trackEvent("meal_template_save_success", { uid, meal, name: trimmedName });
    } catch (error) {
      setToast({ open: true, message: "Failed to save template." });
      trackEvent("meal_template_save_error", {
        uid,
        meal,
        name: trimmedName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const applyTemplateToMeal = async (meal: MealKey, template: MealTemplate) => {
    if (!uid) return;
    const dayKey = activeDateKey;
    const baseTime = Date.now();
    const items = (template.items || []).map((item, index) => ({
      ...item,
      addedAt: new Date(baseTime + index).toISOString(),
    })) as DiaryEntry[];

    if (!items.length) {
      setToast({ open: true, message: "This template has no foods." });
      return;
    }

    trackEvent("meal_template_apply_attempt", {
      uid,
      meal,
      template: template.name,
    });

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", dayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const current: DiaryEntry[] = [...(data[meal] || [])];
        const updated = [...current, ...items];
        tx.set(ref, { [meal]: updated }, { merge: true });
      });

      setDayData((prev) => ({
        ...prev,
        [meal]: [...(prev[meal] || []), ...items],
      }));
      setToast({
        open: true,
        message: `Added template "${template.name}" to ${pretty(meal)}.`,
      });
      trackEvent("meal_template_apply_success", {
        uid,
        meal,
        template: template.name,
      });
    } catch (error) {
      setToast({ open: true, message: "Failed to add template." });
      trackEvent("meal_template_apply_error", {
        uid,
        meal,
        template: template.name,
        error: error instanceof Error ? error.message : String(error),
      });
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
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      setToast({
        open: true,
        message: error.message || "Could not copy entire day.",
      });

      trackEvent("day_copy_from_yesterday_error", {
        uid,
        today: todayKeyValue,
        yesterday: yesterdayKey,
        error: error.message || String(e),
      });
    } finally {
      setDayMenuOpen(false);
    }
  };

  const startLongPress = (
    meal: MealKey,
    index: number,
    name: string
  ) => {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setFoodMenuEntry({ meal, index, name });
      trackEvent("food_long_press_menu_open", {
        uid,
        date: activeDateKey,
        meal,
        index,
        name,
      });
    }, 500);
  };

  const stopLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const moveFood = async (meal: MealKey, index: number, direction: -1 | 1) => {
    if (!uid) return;
    const current = dayData[meal] || [];
    const target = index + direction;
    if (index < 0 || index >= current.length) return;
    if (target < 0 || target >= current.length) return;

    const nextMeal = [...current];
    [nextMeal[index], nextMeal[target]] = [nextMeal[target], nextMeal[index]];

    trackEvent("food_move_attempt", {
      uid,
      date: activeDateKey,
      meal,
      from: index,
      to: target,
    });

    setDayData({ ...dayData, [meal]: nextMeal });

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", activeDateKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const arr: DiaryEntry[] = [...((data as Partial<DayDiaryDoc>)[meal] || [])];
        if (index < 0 || index >= arr.length) return;
        if (target < 0 || target >= arr.length) return;
        [arr[index], arr[target]] = [arr[target], arr[index]];
        tx.set(ref, { ...data, [meal]: arr }, { merge: true });
      });

      trackEvent("food_move_success", {
        uid,
        date: activeDateKey,
        meal,
        from: index,
        to: target,
      });
    } catch {
      setDayData({ ...dayData, [meal]: current });
      setToast({ open: true, message: "Move failed." });

      trackEvent("food_move_error", {
        uid,
        date: activeDateKey,
        meal,
        from: index,
        to: target,
      });
    }
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

  const anyItems =
    dayData.breakfast.length +
    dayData.lunch.length +
    dayData.dinner.length +
    dayData.snacks.length >
    0;

  const hasEverLoggedFood = !!(profile as { hasEverLoggedFood?: boolean })?.hasEverLoggedFood;

  const fetchInspirationalQuote = useCallback(async () => {
    setQuoteLoading(true);
    const fallbackQuote = getFallbackQuote();
    try {
      const response = await fetch(ZEN_QUOTES_ENDPOINT);
      if (!response.ok) {
        throw new Error(`Failed to fetch quote: ${response.status}`);
      }
      const data = (await response.json()) as Array<{ q?: string; a?: string }>;
      const [first] = Array.isArray(data) ? data : [];
      const quoteText = typeof first?.q === "string" ? first.q.trim() : "";
      const quoteAuthor =
        typeof first?.a === "string" ? first.a.trim() : "Unknown";

      if (!quoteText) {
        throw new Error("Missing quote text");
      }

      setQuote({
        quote: quoteText,
        author: quoteAuthor || "Unknown",
      });

      if (uid) {
        trackEvent("inspirational_quote_loaded", {
          uid,
          date: activeDateKey,
          source: "api",
        });
      }
    } catch (error) {
      setQuote(fallbackQuote);
      if (uid) {
        trackEvent("inspirational_quote_loaded", {
          uid,
          date: activeDateKey,
          source: "fallback",
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    } finally {
      setQuoteLoading(false);
      quoteHasLoadedRef.current = true;
    }
  }, [activeDateKey, uid]);

  const refreshQuote = () => {
    void fetchInspirationalQuote();
  };

  const handleSummarySlideChange = useCallback(
    (swiper: SwiperClass) => {
      if (!showWellnessTip) return;
      if (quoteHasLoadedRef.current) return;
      if (swiper.activeIndex !== INSPIRATIONAL_QUOTE_SLIDE_INDEX) return;
      void fetchInspirationalQuote();
    },
    [fetchInspirationalQuote, showWellnessTip]
  );

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
    } catch (err: unknown) {
      console.error("Failed to copy summary", err);
      setToast({ open: true, message: "Could not copy summary." });
      const error = err instanceof Error ? err : new Error(String(err));
      trackEvent("day_summary_copy_failed", {
        uid,
        date: activeDateKey,
        error: error.message || String(err),
      });
    }
  };

  useEffect(() => {
    if (!uid) return;
    if (!anyItems) return;
    if ((profile as { hasEverLoggedFood?: boolean })?.hasEverLoggedFood === true) return;

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

  const openWeighInModal = () => {
    const fallback =
      typeof profile?.weight === "number"
        ? String(
            Math.round(fromMetricWeight(profile.weight, unitSystem) * 10) / 10
          )
        : "";
    setWeighInValue((prev) => prev || fallback);
    setShowWeighInModal(true);
    trackEvent("weigh_in_modal_open", { uid, date: activeDateKey });
  };

  const saveWeighIn = async () => {
    if (!uid) return;
    const weight = Number(weighInValue);
    if (!Number.isFinite(weight) || weight <= 0) {
      setWeighInToast({
        open: true,
        message: "Please enter a valid weight in kg.",
        color: "warning",
      });
      return;
    }

    const entry: WeighInEntry = {
      date: activeDateKey,
      weight: Math.round(toMetricWeight(weight, unitSystem) * 10) / 10,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, "users", uid, "weighins", activeDateKey), entry, {
        merge: true,
      });
      setWeighInToast({
        open: true,
        message: `Saved weigh-in for ${activeDateKey}.`,
        color: "success",
      });
      trackEvent("weigh_in_saved", {
        uid,
        date: activeDateKey,
        weight: entry.weight,
      });
      setShowWeighInModal(false);
    } catch {
      setWeighInToast({
        open: true,
        message: "Could not save weigh-in.",
        color: "danger",
      });
      trackEvent("weigh_in_save_error", { uid, date: activeDateKey });
    }
  };

  const streakMilestones = [3, 7, 14, 30];
  const nextStreakTarget = streakMilestones.find((target) => streak < target) ?? null;

  const nutritionTotals = useMemo(() => {
    const aggregated: Record<string, number> = {};
    Object.values(dayData).forEach((items) => {
      items.forEach((entry) => {
        Object.entries(entry.total || {}).forEach(([key, value]) => {
          if (key === "calories" || typeof value !== "number") return;
          if (!Number.isFinite(value)) return;
          aggregated[key] = (aggregated[key] ?? 0) + value;
        });
      });
    });
    return aggregated;
  }, [dayData]);

  const nutritionLabels: Record<string, { label: string; unit?: string }> = {
    carbs: { label: "Carbohydrates", unit: "g" },
    protein: { label: "Protein", unit: "g" },
    fat: { label: "Fat", unit: "g" },
    sugar: { label: "Sugar", unit: "g" },
    fiber: { label: "Fiber", unit: "g" },
    saturatedFat: { label: "Saturated fat", unit: "g" },
    salt: { label: "Salt", unit: "g" },
    sodium: { label: "Sodium", unit: "g" },
    "vitamin-a_100g": { label: "Vitamin A", unit: "µg" },
    "vitamin-c_100g": { label: "Vitamin C", unit: "mg" },
    "vitamin-d_100g": { label: "Vitamin D", unit: "µg" },
    "vitamin-e_100g": { label: "Vitamin E", unit: "mg" },
    "vitamin-k_100g": { label: "Vitamin K", unit: "µg" },
    "vitamin-b1_100g": { label: "Vitamin B1", unit: "mg" },
    "vitamin-b2_100g": { label: "Vitamin B2", unit: "mg" },
    "vitamin-b6_100g": { label: "Vitamin B6", unit: "mg" },
    "vitamin-b12_100g": { label: "Vitamin B12", unit: "µg" },
    "vitamin-b9_100g": { label: "Vitamin B9", unit: "µg" },
  };

  const nutritionEntries = useMemo(() => {
    const entries = Object.entries(nutritionTotals)
      .filter(([, value]) => value > 0)
      .map(([key, value]) => ({ key, value }));
    const priority = [
      "carbs",
      "protein",
      "fat",
      "sugar",
      "fiber",
      "saturatedFat",
      "salt",
      "sodium",
    ];

    entries.sort((a, b) => {
      const aIndex = priority.indexOf(a.key);
      const bIndex = priority.indexOf(b.key);
      if (aIndex === -1 && bIndex === -1) {
        return a.key.localeCompare(b.key);
      }
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return entries;
  }, [nutritionTotals]);

  const formatNutritionLabel = (key: string) => {
    if (nutritionLabels[key]?.label) return nutritionLabels[key].label;
    const cleaned = key.replace(/_100g|_serving/g, "").replace(/[_-]+/g, " ");
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatNutritionValue = (value: number) => {
    if (value < 1) return value.toFixed(2);
    if (value < 10) return value.toFixed(1);
    return value.toFixed(0);
  };

  useEffect(() => {
    if (!summarySwiperRef.current) return;
    summarySwiperRef.current.updateAutoHeight(300);
    summarySwiperRef.current.update();
  }, [
    profile,
    caloriesNeeded,
    macroTargets,
    totals.day,
    nutritionEntries,
    streak,
    showWellnessTip,
  ]);


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Home</IonTitle>
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
          <Swiper
            modules={[Pagination]}
            pagination={{ clickable: true }}
            slidesPerView={1}
            autoHeight
            className="fs-summary__swiper"
            observer
            observeParents
            observeSlideChildren
            onSwiper={(swiper) => {
              summarySwiperRef.current = swiper;
              handleSummarySlideChange(swiper);
            }}
            onSlideChange={handleSummarySlideChange}
          >
            <SwiperSlide>
              <div className="fs-summary__slide">
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
                        <div className="fs-metric-title">Calories Consumed</div>
                      </div>
                      <div className="fs-summary__right">
                        <div className="fs-metric-value">
                          {summaryDifferenceValue}
                        </div>
                        <div className="fs-metric-value">{kcalConsumed}</div>
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
                    {workoutCalories > 0 && (
                      <>
                        <div>
                          <div className="fs-summary__meta-label">
                            Activity bonus
                          </div>
                          <div className="fs-summary__meta-value">
                            +{workoutCalories} kcal
                          </div>
                        </div>
                        <div>
                          <div className="fs-summary__meta-label">Adjusted goal</div>
                          <div className="fs-summary__meta-value">{kcalGoal}</div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {profile && caloriesNeeded != null && macroTargets && (
                  <div
                    className="fs-macro-bars"
                    style={{ display: "grid", gap: 8, padding: "8px 16px 12px" }}
                  >
                    {[
                      {
                        k: "fat",
                        g: totals.day.fat,
                        tg: macroTargets.fatG,
                        l: "Fat",
                      },
                      {
                        k: "carbs",
                        g: totals.day.carbs,
                        tg: macroTargets.carbsG,
                        l: "Carbohydrates",
                      },
                      {
                        k: "protein",
                        g: totals.day.protein,
                        tg: macroTargets.proteinG,
                        l: "Protein",
                      },
                    ].map(({ k, g, tg, l }) => {
                      const pct = tg ? Math.min(1, g / tg) : 0;
                      const baseBarStyle = {
                        height: 8,
                        background: "rgba(148, 163, 184, 0.35)",
                        borderRadius: 9999,
                        overflow: "hidden",
                      } as const;

                      const fillStyle = {
                        width: `${pct * 100}%`,
                        height: "100%",
                        transition: "width 0.2s ease-out",
                      } as const;

                      const macroBars =
                        k === "fat"
                          ? (() => {
                              const total = Math.max(0, totals.day.fat);
                              const sat = Math.min(
                                total,
                                Math.max(0, totals.day.saturatedFat)
                              );
                              const rest = Math.max(0, total - sat);
                              const satPct = total > 0 ? sat / total : 0;
                              const restPct = total > 0 ? rest / total : 0;
                              return (
                                <div style={{ display: "flex", height: "100%" }}>
                                  {rest > 0 && (
                                    <div
                                      style={{
                                        width: `${restPct * 100}%`,
                                        background: "var(--ion-color-primary)",
                                      }}
                                    />
                                  )}
                                  {sat > 0 && (
                                    <div
                                      style={{
                                        width: `${satPct * 100}%`,
                                        background: "var(--ion-color-warning)",
                                      }}
                                    />
                                  )}
                                </div>
                              );
                            })()
                          : k === "carbs"
                            ? (() => {
                                const total = Math.max(0, totals.day.carbs);
                                const sugar = Math.min(
                                  total,
                                  Math.max(0, totals.day.sugar)
                                );
                                const fiber = Math.min(
                                  total - sugar,
                                  Math.max(0, totals.day.fiber)
                                );
                                const rest = Math.max(0, total - sugar - fiber);
                                const sugarPct = total > 0 ? sugar / total : 0;
                                const fiberPct = total > 0 ? fiber / total : 0;
                                const restPct = total > 0 ? rest / total : 0;
                                return (
                                  <div style={{ display: "flex", height: "100%" }}>
                                    {rest > 0 && (
                                      <div
                                        style={{
                                          width: `${restPct * 100}%`,
                                          background: "var(--ion-color-primary)",
                                        }}
                                      />
                                    )}
                                    {sugar > 0 && (
                                      <div
                                        style={{
                                          width: `${sugarPct * 100}%`,
                                          background: "var(--ion-color-warning)",
                                        }}
                                      />
                                    )}
                                    {fiber > 0 && (
                                      <div
                                        style={{
                                          width: `${fiberPct * 100}%`,
                                          background: "var(--ion-color-success)",
                                        }}
                                      />
                                    )}
                                  </div>
                                );
                              })()
                            : (
                                <div
                                  style={{
                                    ...fillStyle,
                                    background: "var(--ion-color-primary)",
                                  }}
                                />
                              );

                      return (
                        <div key={k} style={{ display: "grid", gap: 4 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                            }}
                          >
                            <span>{l}</span>
                            <span>
                              {g.toFixed(0)} / {tg} g
                            </span>
                          </div>
                          <div style={baseBarStyle}>
                            <div style={fillStyle}>{macroBars}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px 12px",
                        alignItems: "center",
                        fontSize: 11,
                        color: "var(--ion-color-medium)",
                      }}
                    >
                      {[
                        { label: "Saturated fat (in fat)", color: "#facc15" },
                        { label: "Sugar (in carbohydrates)", color: "#facc15" },
                        { label: "Fiber (in carbohydrates)", color: "#22c55e" },
                        { label: "Remaining carbs/fat/protein", color: "#3b82f6" },
                      ].map(({ label, color }) => (
                        <span
                          key={label}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 9999,
                              background: color,
                              display: "inline-block",
                            }}
                          />
                          <span>{label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SwiperSlide>

            <SwiperSlide>
              <div className="fs-summary__slide">
                <IonCardHeader className="fs-summary__hdr">
                  <IonCardTitle>Nutrition breakdown</IonCardTitle>
                </IonCardHeader>
                <IonCardContent className="fs-summary__nutrition">
                  {nutritionEntries.length ? (
                    <div className="fs-summary__nutrition-grid">
                      {nutritionEntries.map(({ key, value }) => {
                        const unit = nutritionLabels[key]?.unit;
                        return (
                          <div key={key} className="fs-summary__nutrition-item">
                            <span className="fs-summary__nutrition-label">
                              {formatNutritionLabel(key)}
                            </span>
                            <span className="fs-summary__nutrition-value">
                              {formatNutritionValue(value)}
                              {unit ? ` ${unit}` : ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <IonText color="medium">
                      No nutrition data logged yet.
                    </IonText>
                  )}
                </IonCardContent>
              </div>
            </SwiperSlide>

            <SwiperSlide>
              <div className="fs-summary__slide">
                <IonCardHeader className="fs-summary__hdr">
                  <IonCardTitle>Achievements</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {streakMilestones.map((target) => (
                      <IonChip
                        key={target}
                        color={streak >= target ? "success" : "medium"}
                      >
                        {target}-day streak
                      </IonChip>
                    ))}
                  </div>
                  {nextStreakTarget ? (
                    <IonText color="medium" style={{ display: "block", marginTop: 8 }}>
                      {nextStreakTarget - streak} more day
                      {nextStreakTarget - streak === 1 ? "" : "s"} to unlock the{" "}
                      {nextStreakTarget}-day badge.
                    </IonText>
                  ) : (
                    <IonText color="medium" style={{ display: "block", marginTop: 8 }}>
                      You’ve unlocked all streak badges 🎉
                    </IonText>
                  )}
                </IonCardContent>
              </div>
            </SwiperSlide>

            {showWellnessTip && (
              <SwiperSlide>
                <div className="fs-summary__slide">
                  <IonCardHeader className="fs-tip-card__hdr">
                    <div className="fs-tip-card__title">
                      <IonIcon icon={bulbOutline} aria-hidden="true" />
                      <IonCardTitle>Inspirational quote</IonCardTitle>
                    </div>
                  </IonCardHeader>
                  <IonCardContent className="fs-tip-card__content">
                    <p className="fs-tip-card__text">“{quote.quote}”</p>
                    <IonText color="medium">— {quote.author}</IonText>
                    <IonButton
                      size="small"
                      fill="outline"
                      onClick={refreshQuote}
                      disabled={quoteLoading}
                    >
                      {quoteLoading ? "Loading..." : "New quote"}
                    </IonButton>
                  </IonCardContent>
                </div>
              </SwiperSlide>
            )}
          </Swiper>
        </IonCard>

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
                className={`fs-meal ${!isCollapsed ? "is-open" : ""}`}
              >
                <IonCardHeader className="fs-meal__hdr">
                  <IonItem
                    lines="none"
                    className="fs-meal__row"
                    detail={false}
                    button
                    aria-expanded={!isCollapsed}
                    onClick={() => {
                      setCollapsedMeals((prev) => ({
                        ...prev,
                        [meal]: !prev[meal],
                      }));
                    }}
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
                      icon={chevronDownOutline}
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
                      style={{ marginBottom: 8 }}
                    >
                      More options
                    </IonButton>

                    {hasItems && (
                      <IonList>
                        {items.map((it, idx) => {
                          const t = it.total || {
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
                              onPointerDown={() => startLongPress(meal, idx, it.name)}
                              onPointerUp={stopLongPress}
                              onPointerLeave={stopLongPress}
                              onPointerCancel={stopLongPress}
                              onClick={() => {
                                if (longPressTriggeredRef.current) {
                                  longPressTriggeredRef.current = false;
                                  return;
                                }
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
                              {it.photoUrl && (
                                <IonThumbnail slot="start">
                                  <img src={it.photoUrl} alt={it.photoName || it.name} />
                                </IonThumbnail>
                              )}
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

                              <div className="kcal-badge" slot="end">
                                {kcal} kcal
                              </div>
                            </IonItem>
                          );
                        })}
                      </IonList>
                    )}
                  </IonCardContent>
                )}
              </IonCard>
            );
          })}

        <IonCard className="fs-weighin">
          <IonCardHeader>
            <IonCardTitle>Weigh-in</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p style={{ marginTop: 0 }}>
              Track your weight over time to see progress in Analytics.
            </p>
            <IonButton expand="block" onClick={openWeighInModal}>
              Log weigh-in
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonActionSheet
          isOpen={foodMenuEntry !== null}
          onDidDismiss={() => {
            setFoodMenuEntry(null);
            longPressTriggeredRef.current = false;
            trackEvent("food_long_press_menu_close", {
              uid,
              date: activeDateKey,
            });
          }}
          header={foodMenuEntry ? `Actions for ${foodMenuEntry.name}` : undefined}
          buttons={[
            {
              text: "Move up",
              cssClass:
                foodMenuEntry &&
                (dayData[foodMenuEntry.meal]?.length ?? 0) > 1
                  ? ""
                  : "action-sheet-disabled",
              handler: () => {
                if (!foodMenuEntry) return false;
                if ((dayData[foodMenuEntry.meal]?.length ?? 0) <= 1) return false;
                moveFood(foodMenuEntry.meal, foodMenuEntry.index, -1);
              },
            },
            {
              text: "Move down",
              cssClass:
                foodMenuEntry &&
                (dayData[foodMenuEntry.meal]?.length ?? 0) > 1
                  ? ""
                  : "action-sheet-disabled",
              handler: () => {
                if (!foodMenuEntry) return false;
                if ((dayData[foodMenuEntry.meal]?.length ?? 0) <= 1) return false;
                moveFood(foodMenuEntry.meal, foodMenuEntry.index, 1);
              },
            },
            {
              text: "Remove",
              role: "destructive",
              handler: () => {
                if (foodMenuEntry) {
                  deleteFood(foodMenuEntry.meal, foodMenuEntry.index);
                }
                setFoodMenuEntry(null);
                longPressTriggeredRef.current = false;
              },
            },
            {
              text: "Cancel",
              role: "cancel",
            },
          ]}
        />

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
              text: "Add from template",
              handler: () => {
                if (copyMenuMeal) {
                  setTemplateMenuMeal(copyMenuMeal);
                }
              },
            },
            {
              text: "Save this meal as template",
              handler: () => {
                if (!copyMenuMeal) return;
                setTemplateTargetMeal(copyMenuMeal);
                setTemplateName(`${pretty(copyMenuMeal)} - ${activeDateKey}`);
                setTemplatePromptOpen(true);
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
          isOpen={templateMenuMeal !== null}
          onDidDismiss={() => {
            setTemplateMenuMeal(null);
          }}
          header={
            templateMenuMeal
              ? `Add template to ${pretty(templateMenuMeal)}`
              : undefined
          }
          buttons={[
            ...(mealTemplates.length
              ? mealTemplates.map((template) => ({
                  text: template.data.name,
                  handler: () => {
                    if (templateMenuMeal) {
                      applyTemplateToMeal(templateMenuMeal, template.data);
                    }
                    setTemplateMenuMeal(null);
                  },
                }))
              : [
                  {
                    text: "No templates saved yet",
                    cssClass: "action-sheet-disabled",
                    handler: () => false,
                  },
                ]),
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
          isOpen={templatePromptOpen}
          header="Save meal as template"
          inputs={[
            {
              name: "templateName",
              type: "text",
              placeholder: "Template name",
              value: templateName,
            },
          ]}
          buttons={[
            {
              text: "Cancel",
              role: "cancel",
              handler: () => {
                setTemplatePromptOpen(false);
              },
            },
            {
              text: "Save",
              handler: (data) => {
                if (!templateTargetMeal) return;
                const name =
                  typeof data?.templateName === "string"
                    ? data.templateName
                    : templateName;
                void saveMealAsTemplate(templateTargetMeal, name);
                setTemplatePromptOpen(false);
                setTemplateTargetMeal(null);
              },
            },
          ]}
          onDidDismiss={() => {
            setTemplatePromptOpen(false);
            setTemplateTargetMeal(null);
          }}
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
        <IonToast
          isOpen={weighInToast.open}
          message={weighInToast.message}
          color={weighInToast.color}
          duration={2500}
          onDidDismiss={() =>
            setWeighInToast((prev) => ({ ...prev, open: false }))
          }
        />
      </IonContent>

      <IonModal
        isOpen={showWeighInModal}
        onDidDismiss={() => setShowWeighInModal(false)}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>Log weigh-in</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowWeighInModal(false)}>
                Close
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonItem>
            <IonLabel position="stacked">
              Weight ({weightLabel(unitSystem)})
            </IonLabel>
            <IonInput
              type="number"
              inputMode="decimal"
              value={weighInValue}
              placeholder="e.g. 72.5"
              onIonInput={(e) => setWeighInValue(e.detail.value || "")}
            />
          </IonItem>
          <IonItem lines="none">
            <IonLabel>
              Date: <strong>{activeDateKey}</strong>
            </IonLabel>
          </IonItem>
          <IonButton expand="block" className="ion-margin-top" onClick={saveWeighIn}>
            Save weigh-in
          </IonButton>
        </IonContent>
      </IonModal>

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
