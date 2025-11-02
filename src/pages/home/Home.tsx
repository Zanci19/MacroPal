// src/pages/home/Home.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent,
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonButton, IonIcon, IonList, IonItem, IonLabel, IonSpinner, IonChip, IonToast,
  IonInput, IonTextarea, IonModal, IonSelect, IonSelectOption
} from "@ionic/react";
import {
  addCircleOutline, logOutOutline,
  sunnyOutline, restaurantOutline, cafeOutline, fastFoodOutline,
  flameOutline, trashOutline, waterOutline, createOutline, analyticsOutline,
  scaleOutline, flashOutline
} from "ionicons/icons";
import { useHistory } from "react-router";
import { auth, db } from "../../firebase";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import "./Home.css";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
type Macros = { calories: number; carbs: number; protein: number; fat: number };

type DiaryEntry = {
  fdcId: number;
  code?: string;
  name: string;
  brand?: string | null;
  dataType?: string | null;
  base?: { amount: number; unit: string; label: string };
  selection?: {
    mode: "serving" | "weight";
    note: string;
    servingsQty?: number | null;
    weightQty?: number | null;
  };
  perBase?: Macros;
  total: Macros;
  addedAt: string;
  [k: string]: any;
};

type Profile = {
  age: number;
  weight: number; // kg
  height: number; // cm
  gender: "male" | "female";
  goal: "lose" | "maintain" | "gain";
  activity: "sedentary" | "light" | "moderate" | "very" | "extra";
  [k: string]: any;
};

const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

/** Progress ring */
const ProgressRing: React.FC<{ size?: number; stroke?: number; progress: number }> = ({
  size = 64, stroke = 8, progress
}) => {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress || 0));
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="currentColor" strokeOpacity="0.18" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${p*C} ${C - p*C}`} transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
      <div className="ring-center"><div className="ring-pct">{Math.round(p*100)}%</div></div>
    </div>
  );
};

const Home: React.FC = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [uid, setUid] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState<string>(() => new Date().toISOString().split("T")[0]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [caloriesNeeded, setCaloriesNeeded] = useState<number | null>(null);

  const [dayData, setDayData] = useState<Record<MealKey, DiaryEntry[]>>({
    breakfast: [], lunch: [], dinner: [], snacks: [],
  });

  const [streak, setStreak] = useState<number>(0);

  // last deleted for undo
  const [lastDeleted, setLastDeleted] = useState<{
    meal: MealKey; index: number; item: DiaryEntry;
  } | null>(null);

  const [toast, setToast] = useState<{ open: boolean; message: string; allowUndo?: boolean }>(
    { open: false, message: "", allowUndo: false }
  );

  const [hydration, setHydration] = useState<{ waterMl: number; targetMl: number; lastUpdated?: string }>(
    { waterMl: 0, targetMl: 2000 }
  );
  const [hydrationTargetInput, setHydrationTargetInput] = useState<string>("2000");
  const [hydrationSaving, setHydrationSaving] = useState(false);

  const [dailyNote, setDailyNote] = useState<string>("");
  const [savingNote, setSavingNote] = useState(false);

  const [weeklyTotals, setWeeklyTotals] = useState<
    { date: string; label: string; calories: number; protein: number; carbs: number; fat: number }[]
  >([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  const [weightEntries, setWeightEntries] = useState<{ date: string; weight: number }[]>([]);
  const [weightInput, setWeightInput] = useState<string>("");
  const [savingWeight, setSavingWeight] = useState(false);

  const [quickAdd, setQuickAdd] = useState({
    open: false,
    meal: null as MealKey | null,
    name: "",
    calories: "",
    carbs: "",
    protein: "",
    fat: "",
    note: "",
  });
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { history.replace("/login"); return; }
      setUid(user.uid);

      // profile
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || !userDoc.data()?.age) { history.replace("/setup-profile"); return; }
      const p = userDoc.data() as Profile; setProfile(p);

      // calories
      const { age, weight, height, gender, goal, activity } = p;
      let bmr = gender === "male"
        ? 10*weight + 6.25*height - 5*age + 5
        : 10*weight + 6.25*height - 5*age - 161;
      const mult = activity === "light" ? 1.375 : activity === "moderate" ? 1.55 : activity === "very" ? 1.725 : activity === "extra" ? 1.9 : 1.2;
      let daily = bmr * mult; if (goal === "lose") daily -= 500; else if (goal === "gain") daily += 500;
      setCaloriesNeeded(Math.max(800, Math.round(daily)));

      // diary subscribe
      const key = new Date().toISOString().split("T")[0];
      setTodayKey(key);
      const ref = doc(db, "users", user.uid, "foods", key);
      const unsubDoc = onSnapshot(ref, async (snap) => {
        const d = snap.data() || {};
        setDayData({
          breakfast: d.breakfast || [], lunch: d.lunch || [], dinner: d.dinner || [], snacks: d.snacks || [],
        });
        const recommendedWater = Math.max(1500, Math.round((p?.weight || 60) * 35));
        const waterTargetMl = typeof d.waterTargetMl === "number" && d.waterTargetMl > 0
          ? d.waterTargetMl
          : recommendedWater;
        const waterMl = typeof d.waterMl === "number" && d.waterMl >= 0 ? d.waterMl : 0;
        setHydration({ waterMl, targetMl: waterTargetMl, lastUpdated: d.waterUpdatedAt });
        setHydrationTargetInput(String(waterTargetMl || ""));
        setDailyNote(typeof d.note === "string" ? d.note : "");
        setLoading(false);

        // simple 14-day streak
        const today = new Date();
        let s = 0;
        for (let i=0;i<14;i++){
          const dt = new Date(today); dt.setDate(today.getDate()-i);
          const k = dt.toISOString().split("T")[0];
          const ds = await getDoc(doc(db, "users", user.uid, "foods", k));
          const dd = ds.data();
          const any = !!(dd?.breakfast?.length || dd?.lunch?.length || dd?.dinner?.length || dd?.snacks?.length);
          if (any) s++; else break;
        }
        setStreak(s);
      });

      return () => { unsubDoc(); };
    });

    return () => unsubAuth();
  }, [history]);

  const loadWeights = useCallback(async () => {
    if (!uid) return;
    try {
      const q = query(
        collection(db, "users", uid, "weights"),
        orderBy("date", "desc"),
        limit(14)
      );
      const snap = await getDocs(q);
      const entries = snap.docs
        .map((docSnap) => {
          const data = docSnap.data() as { weight?: number; date?: string };
          const wtRaw = typeof data.weight === "number" ? data.weight : Number(data.weight);
          if (!isFinite(wtRaw)) return null;
          const date = data.date || docSnap.id;
          return { date, weight: Number(wtRaw.toFixed(1)) };
        })
        .filter(Boolean) as { date: string; weight: number }[];
      setWeightEntries(entries);
    } catch (err) {
      console.error(err);
    }
  }, [uid]);

  useEffect(() => {
    loadWeights();
  }, [loadWeights]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    const fetchWeekly = async () => {
      setWeeklyLoading(true);
      try {
        const todayDate = new Date(todayKey);
        const days: { date: string; label: string; calories: number; protein: number; carbs: number; fat: number }[] = [];
        for (let i = 6; i >= 0; i -= 1) {
          const dt = new Date(todayDate);
          dt.setDate(todayDate.getDate() - i);
          const key = dt.toISOString().split("T")[0];
          const ds = await getDoc(doc(db, "users", uid, "foods", key));
          const data = (ds.data() || {}) as Record<string, unknown>;
          const meals: DiaryEntry[][] = MEALS.map((meal) => (
            (data[meal] as DiaryEntry[] | undefined) || []
          ));
          const totals = meals.reduce(
            (acc, arr) => {
              arr.forEach((item) => {
                acc.calories += item.total?.calories || 0;
                acc.carbs += item.total?.carbs || 0;
                acc.protein += item.total?.protein || 0;
                acc.fat += item.total?.fat || 0;
              });
              return acc;
            },
            { calories: 0, carbs: 0, protein: 0, fat: 0 }
          );
          days.push({
            date: key,
            label: dt.toLocaleDateString(undefined, { weekday: "short" }),
            calories: Math.round(totals.calories),
            protein: Number(totals.protein.toFixed(1)),
            carbs: Number(totals.carbs.toFixed(1)),
            fat: Number(totals.fat.toFixed(1)),
          });
        }
        if (!cancelled) setWeeklyTotals(days);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setWeeklyLoading(false);
      }
    };
    fetchWeekly();
    return () => { cancelled = true; };
  }, [uid, todayKey, dayData]);

  // totals
  const totals = useMemo(() => {
    const sum = (arr: DiaryEntry[]) =>
      arr.reduce((a, it) => ({
        calories: a.calories + (it.total?.calories || 0),
        carbs: a.carbs + (it.total?.carbs || 0),
        protein: a.protein + (it.total?.protein || 0),
        fat: a.fat + (it.total?.fat || 0),
      }), { calories: 0, carbs: 0, protein: 0, fat: 0 });

    const perMeal = {
      breakfast: sum(dayData.breakfast),
      lunch: sum(dayData.lunch),
      dinner: sum(dayData.dinner),
      snacks: sum(dayData.snacks),
    };
    const day = Object.values(perMeal).reduce((a,m)=>({
      calories: a.calories+m.calories, carbs: a.carbs+m.carbs, protein: a.protein+m.protein, fat: a.fat+m.fat
    }), { calories:0, carbs:0, protein:0, fat:0 });

    return { perMeal, day };
  }, [dayData]);

  const kcalConsumed = Math.round(Math.max(0, totals.day.calories));
  const kcalGoal = caloriesNeeded ?? 0;
  const kcalLeft = Math.max(0, Math.round(kcalGoal - kcalConsumed));
  const progress = kcalGoal > 0 ? Math.min(1, kcalConsumed / kcalGoal) : 0;

  const macroTargets = useMemo(() => {
    if (!profile || !caloriesNeeded) return null;
    const proteinG = Math.round(1.8 * profile.weight);
    const fatG = Math.max(45, Math.round(0.8 * profile.weight));
    const proteinK = proteinG * 4, fatK = fatG * 9;
    const carbsG = Math.round(Math.max(0, kcalGoal - proteinK - fatK) / 4);
    return { proteinG, fatG, carbsG };
  }, [profile, caloriesNeeded, kcalGoal]);

  const pretty = (s: string) => s[0].toUpperCase() + s.slice(1);

  const mealIcon: Record<MealKey, string> = {
    breakfast: sunnyOutline, lunch: restaurantOutline, dinner: cafeOutline, snacks: fastFoodOutline,
  };

  const hydrationProgress = hydration.targetMl > 0
    ? Math.min(1, hydration.waterMl / hydration.targetMl)
    : 0;

  const latestWeight = weightEntries[0]?.weight;
  const previousWeight = weightEntries[1]?.weight;
  const weightDelta = latestWeight != null && previousWeight != null
    ? Number((latestWeight - previousWeight).toFixed(1))
    : null;

  const insights = useMemo(() => {
    const messages: string[] = [];
    const perMeal = totals.perMeal;
    const richestMeal = MEALS.reduce((best, meal) =>
      perMeal[meal].calories > perMeal[best].calories ? meal : best,
    MEALS[0]);
    if (perMeal[richestMeal].calories > 0) {
      messages.push(`${pretty(richestMeal)} is your biggest meal today at ${Math.round(perMeal[richestMeal].calories)} kcal.`);
    }
    if (macroTargets) {
      const proteinLeft = Math.round(macroTargets.proteinG - totals.day.protein);
      if (proteinLeft > 0) {
        messages.push(`You need ${proteinLeft} g more protein to hit your goal.`);
      } else {
        messages.push(`You've exceeded your protein goal by ${Math.abs(proteinLeft)} g — great job!`);
      }
      const carbLeft = Math.round(macroTargets.carbsG - totals.day.carbs);
      if (carbLeft < -20) {
        messages.push(`Carbs are ${Math.abs(carbLeft)} g over target; consider lighter options later.`);
      }
    }
    if (hydration.targetMl > 0) {
      const pct = Math.round(hydrationProgress * 100);
      if (pct < 50) {
        messages.push("Hydration is under 50% of your goal — drink some water.");
      } else {
        messages.push(`Hydration goal is ${pct}% complete.`);
      }
    }
    if (weeklyTotals.length) {
      const avg = weeklyTotals.reduce((acc, cur) => acc + cur.calories, 0) / weeklyTotals.length;
      const diff = Math.round(totals.day.calories - avg);
      if (Math.abs(diff) >= 10) {
        messages.push(`Today you are ${diff >= 0 ? "above" : "below"} the 7-day average by ${Math.abs(diff)} kcal.`);
      }
    }
    return Array.from(new Set(messages)).slice(0, 4);
  }, [totals, macroTargets, hydration.targetMl, hydrationProgress, weeklyTotals]);

  const toastButtons = toast.allowUndo && lastDeleted
    ? [{
        text: "Undo",
        role: "cancel" as const,
        side: "end" as const,
        handler: () => undoDelete(),
      }]
    : undefined;

  const handleLogout = async () => {
    try { setLoggingOut(true); await signOut(auth); history.replace("/login"); }
    catch { alert("Failed to log out. Please try again."); }
    finally { setLoggingOut(false); }
  };

  // delete with optimistic UI and remember for undo
  const deleteFood = async (meal: MealKey, index: number) => {
    if (!uid) return;
    const current = dayData[meal] || [];
    if (index < 0 || index >= current.length) return;
    const item = current[index];

    // optimistic local update
    const nextMealArr = [...current];
    nextMealArr.splice(index, 1);
    setDayData({ ...dayData, [meal]: nextMealArr });
    setLastDeleted({ meal, index, item });
    setToast({ open: true, message: `Removed ${item.name}.`, allowUndo: true });

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", todayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const arr: DiaryEntry[] = [...(data[meal] || [])];
        // defensive find by addedAt if indices shifted
        const idx = arr.findIndex((x) => x.addedAt === item.addedAt);
        if (idx >= 0) arr.splice(idx, 1);
        else if (index <= arr.length) arr.splice(index, 1);
        tx.set(ref, { [meal]: arr }, { merge: true });
      });
    } catch {
      // revert on failure
      const reverted = [...(dayData[meal] || [])];
      reverted.splice(index, 0, item);
      setDayData({ ...dayData, [meal]: reverted });
      setLastDeleted(null);
      setToast({ open: true, message: "Delete failed.", allowUndo: false });
    }
  };

  const undoDelete = async () => {
    if (!uid || !lastDeleted) return;
    const { meal, index, item } = lastDeleted;

    // optimistic local restore
    const arr = [...(dayData[meal] || [])];
    const insertAt = Math.min(Math.max(index, 0), arr.length);
    arr.splice(insertAt, 0, item);
    setDayData({ ...dayData, [meal]: arr });
    setLastDeleted(null);

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", todayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const cur: DiaryEntry[] = [...(data[meal] || [])];

        // if already present, skip duplicate
        const exists = cur.some((x) => x.addedAt === item.addedAt);
        if (!exists) {
          const pos = Math.min(Math.max(index, 0), cur.length);
          cur.splice(pos, 0, item);
          tx.set(ref, { [meal]: cur }, { merge: true });
        }
      });
    } catch {
      // if backend restore fails, remove the optimistic insert
      const arr2 = [...(dayData[meal] || [])];
      const i2 = arr2.findIndex((x) => x.addedAt === item.addedAt);
      if (i2 >= 0) { arr2.splice(i2, 1); setDayData({ ...dayData, [meal]: arr2 }); }
      setToast({ open: true, message: "Undo failed.", allowUndo: false });
    }
  };

  const adjustWater = async (delta: number) => {
    if (!uid) return;
    const prev = hydration.waterMl;
    const next = Math.max(0, Math.round(prev + delta));
    setHydration((h) => ({ ...h, waterMl: next }));
    try {
      await setDoc(
        doc(db, "users", uid, "foods", todayKey),
        { waterMl: next, waterUpdatedAt: new Date().toISOString() },
        { merge: true }
      );
      setToast({ open: true, message: `Water logged: ${next} ml`, allowUndo: false });
    } catch (err) {
      console.error(err);
      setHydration((h) => ({ ...h, waterMl: prev }));
      setToast({ open: true, message: "Unable to update water", allowUndo: false });
    }
  };

  const saveWaterTarget = async () => {
    if (!uid) return;
    const target = Math.max(500, Math.round(Number(hydrationTargetInput) || 0));
    const prev = hydration.targetMl;
    setHydration((h) => ({ ...h, targetMl: target }));
    setHydrationSaving(true);
    try {
      await setDoc(
        doc(db, "users", uid, "foods", todayKey),
        { waterTargetMl: target },
        { merge: true }
      );
      setHydrationTargetInput(String(target));
      setToast({ open: true, message: `Saved hydration goal (${target} ml)`, allowUndo: false });
    } catch (err) {
      console.error(err);
      setHydration((h) => ({ ...h, targetMl: prev }));
      setToast({ open: true, message: "Unable to save hydration goal", allowUndo: false });
    } finally {
      setHydrationSaving(false);
    }
  };

  const saveDailyNote = async () => {
    if (!uid) return;
    setSavingNote(true);
    try {
      await setDoc(
        doc(db, "users", uid, "foods", todayKey),
        { note: dailyNote, noteUpdatedAt: new Date().toISOString() },
        { merge: true }
      );
      setToast({ open: true, message: "Saved daily reflection", allowUndo: false });
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: "Unable to save note", allowUndo: false });
    } finally {
      setSavingNote(false);
    }
  };

  const saveWeight = async () => {
    if (!uid) return;
    const parsed = Number(weightInput);
    if (!isFinite(parsed) || parsed <= 0) {
      setToast({ open: true, message: "Enter a valid weight", allowUndo: false });
      return;
    }
    setSavingWeight(true);
    try {
      await setDoc(
        doc(db, "users", uid, "weights", todayKey),
        {
          weight: Number(parsed.toFixed(1)),
          date: todayKey,
          recordedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setWeightInput("");
      await loadWeights();
      setToast({ open: true, message: "Weight logged", allowUndo: false });
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: "Unable to save weight", allowUndo: false });
    } finally {
      setSavingWeight(false);
    }
  };

  const openQuickAdd = (meal: MealKey) => {
    setQuickAdd({
      open: true,
      meal,
      name: "",
      calories: "",
      carbs: "",
      protein: "",
      fat: "",
      note: "",
    });
  };

  const closeQuickAdd = () => {
    setQuickAdd((prev) => ({ ...prev, open: false }));
  };

  const handleQuickAddSave = async () => {
    if (!uid || !quickAdd.meal) return;
    const meal = quickAdd.meal;
    const name = quickAdd.name.trim() || "Quick add calories";
    const calories = Math.max(0, Math.round(Number(quickAdd.calories) || 0));
    const parseMacro = (val: string) => {
      const num = Number(val);
      if (!isFinite(num) || num < 0) return 0;
      return Number(num.toFixed(1));
    };
    const carbs = parseMacro(quickAdd.carbs);
    const protein = parseMacro(quickAdd.protein);
    const fat = parseMacro(quickAdd.fat);
    const note = quickAdd.note.trim();
    const entry: DiaryEntry = {
      fdcId: Number(new Date().valueOf()),
      name,
      brand: note ? note : "Quick Add",
      dataType: "QUICK_ADD",
      base: { amount: 1, unit: "serving", label: "Custom" },
      selection: { mode: "serving", note },
      perBase: { calories, carbs, protein, fat },
      total: { calories, carbs, protein, fat },
      addedAt: new Date().toISOString(),
    };

    setQuickAddSaving(true);
    setDayData((prevState) => ({
      ...prevState,
      [meal]: [...(prevState[meal] || []), entry],
    }));
    try {
      await setDoc(
        doc(db, "users", uid, "foods", todayKey),
        { [meal]: arrayUnion(entry) },
        { merge: true }
      );
      setToast({ open: true, message: `Added ${name}`, allowUndo: false });
      closeQuickAdd();
    } catch (err) {
      console.error(err);
      setDayData((prevState) => {
        const current = [...(prevState[meal] || [])];
        const idx = current.findIndex((it) => it.addedAt === entry.addedAt);
        if (idx >= 0) current.splice(idx, 1);
        return { ...prevState, [meal]: current };
      });
      setToast({ open: true, message: "Unable to quick add", allowUndo: false });
    } finally {
      setQuickAddSaving(false);
    }
  };

  const ringColor = progress <= 0.9 ? "var(--ion-color-success)"
                   : progress <= 1.1 ? "var(--ion-color-warning)"
                   : "var(--ion-color-danger)";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Home</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleLogout} disabled={loggingOut}>
              <IonIcon slot="start" icon={logOutOutline} />
              {loggingOut ? "Signing out..." : "Logout"}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="home-content ion-padding">
        {/* Summary */}
        <IonCard className="fs-summary">
          <IonCardHeader className="fs-summary__hdr">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <IonCardTitle>Today</IonCardTitle>
              {streak > 1 && (
                <IonChip color="success" style={{ marginInlineStart: 8 }}>
                  <IonIcon icon={flameOutline} /><span style={{ marginLeft: 4 }}>{streak}-day streak</span>
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
                  <div className="fs-metric-title">Calories Remaining</div>
                  <div className="fs-metric-title">Calories Consumed</div>
                </div>
                <div className="fs-summary__right">
                  <div className="fs-metric-value">{kcalLeft}</div>
                  <div className="fs-metric-value">{kcalConsumed}</div>
                </div>
              </>
            )}
          </IonCardContent>

          {profile && caloriesNeeded != null && (
            <>
              <div className="fs-macros">
                <div className="fs-macro"><span className="fs-macro__label">Carbohydrates</span><span className="fs-macro__val">{totals.day.carbs.toFixed(1)} g</span></div>
                <div className="fs-macro"><span className="fs-macro__label">Protein</span><span className="fs-macro__val">{totals.day.protein.toFixed(1)} g</span></div>
                <div className="fs-macro"><span className="fs-macro__label">Fat</span><span className="fs-macro__val">{totals.day.fat.toFixed(1)} g</span></div>
              </div>

              {(() => {
                const t = macroTargets; if (!t) return null;
                return (
                  <div className="fs-macro-bars" style={{ display: "grid", gap: 8, padding: "8px 16px 12px" }}>
                    {[{k:"carbs",g:totals.day.carbs,tg:t.carbsG,l:"Carbohydrates"},
                      {k:"protein",g:totals.day.protein,tg:t.proteinG,l:"Protein"},
                      {k:"fat",g:totals.day.fat,tg:t.fatG,l:"Fat"}].map(({k,g,tg,l})=>{
                        const pct = Math.min(1, tg ? g/tg : 0);
                        return (
                          <div key={k} style={{ display: "grid", gap: 4 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                              <span>{l}</span><span>{g.toFixed(0)} / {tg} g</span>
                            </div>
                            <div style={{ height:8, background:"var(--ion-color-light)", borderRadius:9999, overflow:"hidden" }}>
                              <div style={{ width:`${pct*100}%`, height:"100%", background:"var(--ion-color-primary)" }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })()}
            </>
          )}
        </IonCard>

        <IonCard className="fs-quick">
          <IonCardHeader className="fs-card__hdr">
            <IonCardTitle><IonIcon icon={flashOutline} />Quick actions</IonCardTitle>
          </IonCardHeader>
          <IonCardContent className="fs-quick__content">
            <IonButton expand="block" fill="clear" onClick={() => history.push("/scan-barcode")}>
              <IonIcon slot="start" icon={flashOutline} />Scan a barcode
            </IonButton>
            <IonButton expand="block" fill="clear" onClick={() => history.push("/add-food")}>
              <IonIcon slot="start" icon={addCircleOutline} />Browse food database
            </IonButton>
            <IonButton expand="block" fill="clear" onClick={() => openQuickAdd("snacks")}>
              <IonIcon slot="start" icon={fastFoodOutline} />Quick add calories
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard className="fs-hydration">
          <IonCardHeader className="fs-card__hdr">
            <IonCardTitle><IonIcon icon={waterOutline} />Hydration tracker</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div className="fs-hydration__row">
              <div className="fs-hydration__progress">
                <ProgressRing size={72} stroke={8} progress={hydrationProgress} />
                <div className="fs-hydration__center">
                  <IonIcon icon={waterOutline} />
                  <strong>{Math.round(hydrationProgress * 100)}%</strong>
                  <span>{hydration.waterMl}/{hydration.targetMl} ml</span>
                </div>
              </div>
              <div className="fs-hydration__actions">
                <div className="fs-hydration__buttons">
                  {[250, 350, 500].map((ml) => (
                    <IonButton key={ml} size="small" onClick={() => adjustWater(ml)}>
                      +{ml} ml
                    </IonButton>
                  ))}
                  <IonButton size="small" color="medium" onClick={() => adjustWater(-250)}>
                    -250 ml
                  </IonButton>
                </div>
                <IonItem lines="none" className="fs-hydration__item">
                  <IonLabel position="stacked">Daily goal (ml)</IonLabel>
                  <IonInput
                    type="number"
                    value={hydrationTargetInput}
                    onIonChange={(e) => setHydrationTargetInput(e.detail.value || "")}
                    inputmode="numeric"
                  />
                </IonItem>
                <IonButton
                  expand="block"
                  onClick={saveWaterTarget}
                  disabled={hydrationSaving}
                >
                  Save hydration goal
                </IonButton>
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        <IonCard className="fs-weekly">
          <IonCardHeader className="fs-card__hdr">
            <IonCardTitle><IonIcon icon={analyticsOutline} />7-day calorie trend</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {weeklyLoading ? (
              <div className="ion-text-center" style={{ padding: 16 }}>
                <IonSpinner name="lines" />
              </div>
            ) : weeklyTotals.length ? (
              <div className="fs-weekly__chart">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyTotals}>
                    <XAxis dataKey="label" stroke="var(--mp-text-muted)" tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--mp-text-muted)" tickLine={false} axisLine={false} width={36} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.05)" }}
                      contentStyle={{ background: "var(--mp-surface)", borderRadius: 12, border: "1px solid var(--mp-border)", color: "var(--mp-text)" }}
                      formatter={(value: number) => [`${Math.round(value)} kcal`, "Calories"]}
                    />
                    <Bar dataKey="calories" fill="var(--ion-color-primary)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="fs-weekly__meta">
                  <span>Average: {Math.round(weeklyTotals.reduce((acc, cur) => acc + cur.calories, 0) / weeklyTotals.length)} kcal</span>
                  <span>Highest: {Math.max(...weeklyTotals.map((d) => d.calories))} kcal</span>
                </div>
              </div>
            ) : (
              <p>No data for the past week yet.</p>
            )}
          </IonCardContent>
        </IonCard>

        {insights.length > 0 && (
          <IonCard className="fs-insights">
            <IonCardHeader className="fs-card__hdr">
              <IonCardTitle><IonIcon icon={analyticsOutline} />Coach insights</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <ul>
                {insights.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </IonCardContent>
          </IonCard>
        )}

        <IonCard className="fs-weight">
          <IonCardHeader className="fs-card__hdr">
            <IonCardTitle><IonIcon icon={scaleOutline} />Weight check-in</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div className="fs-weight__summary">
              <IonIcon icon={scaleOutline} />
              <div>
                <div className="fs-weight__current">
                  {latestWeight != null ? `${latestWeight.toFixed(1)} kg` : "No entry yet"}
                </div>
                {weightDelta != null && (
                  <div className={`fs-weight__delta ${weightDelta > 0 ? "is-up" : weightDelta < 0 ? "is-down" : ""}`}>
                    {weightDelta > 0 ? "+" : weightDelta < 0 ? "" : "±"}{Math.abs(weightDelta)} kg since last entry
                  </div>
                )}
              </div>
            </div>
            <IonItem lines="none" className="fs-weight__item">
              <IonLabel position="stacked">Today's weight (kg)</IonLabel>
              <IonInput
                type="number"
                value={weightInput}
                inputmode="decimal"
                onIonChange={(e) => setWeightInput(e.detail.value || "")}
              />
            </IonItem>
            <IonButton expand="block" onClick={saveWeight} disabled={savingWeight}>
              Log weight
            </IonButton>
            {weightEntries.length > 0 && (
              <div className="fs-weight__history">
                <h3>Recent entries</h3>
                <ul>
                  {weightEntries.map((entry) => (
                    <li key={entry.date}>
                      <span>{entry.date}</span>
                      <span>{entry.weight.toFixed(1)} kg</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard className="fs-note">
          <IonCardHeader className="fs-card__hdr">
            <IonCardTitle><IonIcon icon={createOutline} />Daily reflection</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="none" className="fs-note__item">
              <IonLabel position="stacked">How did today feel?</IonLabel>
              <IonTextarea
                autoGrow
                value={dailyNote}
                onIonChange={(e) => setDailyNote(e.detail.value || "")}
                maxlength={400}
              />
            </IonItem>
            <IonButton expand="block" onClick={saveDailyNote} disabled={savingNote}>
              <IonIcon slot="start" icon={createOutline} />Save note
            </IonButton>
          </IonCardContent>
        </IonCard>

        {loading && <div className="ion-text-center" style={{ padding: 24 }}><IonSpinner name="dots" /></div>}

        {/* Meals */}
        {!loading && MEALS.map((meal) => {
          const items = dayData[meal] || [];
          const hasItems = items.length > 0;
          return (
            <IonCard key={meal} className={`fs-meal ${hasItems ? "is-open" : ""}`}>
              <IonCardHeader className="fs-meal__hdr">
                <IonItem lines="none" className="fs-meal__row" detail={false}>
                  <IonIcon slot="start" className="fs-meal__icon" icon={mealIcon[meal]} aria-hidden="true" />
                  <h2 className="fs-meal__title-text">{pretty(meal)}</h2>
                  <IonButton
                    slot="end"
                    className="fs-meal__add"
                    fill="clear"
                    onClick={() => openQuickAdd(meal)}
                    aria-label={`Quick add to ${meal}`}
                  >
                    <IonIcon icon={flashOutline} />
                  </IonButton>
                  <IonButton slot="end" className="fs-meal__add" fill="clear"
                    onClick={() => history.push(`/add-food?meal=${meal}`)} aria-label={`Add to ${meal}`}>
                    <IonIcon icon={addCircleOutline} />
                  </IonButton>
                </IonItem>
              </IonCardHeader>

              {hasItems && (
                <IonCardContent>
                  <p className="meal-total">
                    Total: {Math.round(totals.perMeal[meal].calories)} kcal · Carbohydrates {totals.perMeal[meal].carbs.toFixed(1)} g ·
                    {" "}Protein {totals.perMeal[meal].protein.toFixed(1)} g · Fat {totals.perMeal[meal].fat.toFixed(1)} g
                  </p>

                  <IonList>
                    {items.map((it, idx) => {
                      const kcal = Math.round(it.total.calories);
                      return (
                        <IonItem key={`${it.addedAt}-${idx}`} className="meal-item">
                          <IonLabel>
                            <h2>
                              {it.name}{it.brand ? ` · ${it.brand}` : ""}
                            </h2>
                            <p>
                              Carbohydrates {it.total.carbs.toFixed(1)} g ·
                              {" "}Protein {it.total.protein.toFixed(1)} g ·
                              {" "}Fat {it.total.fat.toFixed(1)} g
                            </p>
                          </IonLabel>

                          <IonButton
                            slot="end"
                            fill="clear"
                            aria-label={`Remove ${it.name}`}
                            onClick={() => deleteFood(meal, idx)}
                            className="del-btn"
                          >
                            <IonIcon icon={trashOutline} />
                          </IonButton>

                          <div className="kcal-badge" slot="end">{kcal} kcal</div>
                        </IonItem>
                      );
                    })}
                  </IonList>
                </IonCardContent>
              )}
            </IonCard>
          );
        })}

        <IonModal isOpen={quickAdd.open} onDidDismiss={closeQuickAdd}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Quick add calories</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={closeQuickAdd}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem lines="full">
              <IonLabel position="stacked">Meal</IonLabel>
              <IonSelect
                value={quickAdd.meal ?? "snacks"}
                onIonChange={(e) => setQuickAdd((prev) => ({
                  ...prev,
                  meal: (e.detail.value as MealKey) || prev.meal || "snacks",
                }))}
              >
                {MEALS.map((meal) => (
                  <IonSelectOption key={meal} value={meal}>{pretty(meal)}</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput
                value={quickAdd.name}
                placeholder="e.g. Protein shake"
                onIonChange={(e) => setQuickAdd((prev) => ({ ...prev, name: e.detail.value || "" }))}
              />
            </IonItem>
            <IonItem lines="full">
              <IonLabel position="stacked">Calories</IonLabel>
              <IonInput
                type="number"
                inputmode="numeric"
                value={quickAdd.calories}
                onIonChange={(e) => setQuickAdd((prev) => ({ ...prev, calories: e.detail.value || "" }))}
              />
            </IonItem>
            <div className="fs-quick__grid">
              <IonItem lines="full">
                <IonLabel position="stacked">Carbs (g)</IonLabel>
                <IonInput
                  type="number"
                  inputmode="decimal"
                  value={quickAdd.carbs}
                  onIonChange={(e) => setQuickAdd((prev) => ({ ...prev, carbs: e.detail.value || "" }))}
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Protein (g)</IonLabel>
                <IonInput
                  type="number"
                  inputmode="decimal"
                  value={quickAdd.protein}
                  onIonChange={(e) => setQuickAdd((prev) => ({ ...prev, protein: e.detail.value || "" }))}
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Fat (g)</IonLabel>
                <IonInput
                  type="number"
                  inputmode="decimal"
                  value={quickAdd.fat}
                  onIonChange={(e) => setQuickAdd((prev) => ({ ...prev, fat: e.detail.value || "" }))}
                />
              </IonItem>
            </div>
            <IonItem lines="full">
              <IonLabel position="stacked">Notes</IonLabel>
              <IonTextarea
                autoGrow
                value={quickAdd.note}
                onIonChange={(e) => setQuickAdd((prev) => ({ ...prev, note: e.detail.value || "" }))}
              />
            </IonItem>
            <IonButton expand="block" onClick={handleQuickAddSave} disabled={quickAddSaving}>
              <IonIcon slot="start" icon={fastFoodOutline} />Save entry
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={toast.open}
          message={toast.message}
          duration={2500}
          buttons={toastButtons}
          onDidDismiss={() => setToast({ open: false, message: "", allowUndo: false })}
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;
