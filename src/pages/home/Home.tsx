// src/pages/home/Home.tsx
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
} from "@ionic/react";
import {
  addCircleOutline,
  sunnyOutline,
  restaurantOutline,
  cafeOutline,
  fastFoodOutline,
  flameOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  calendarOutline,
  ellipsisVertical,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router";
import { db } from "../../firebase";
import { doc, getDoc, onSnapshot, runTransaction } from "firebase/firestore";
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
} from "../../types";

import { useProfile } from "../../hooks/useProfile";

const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

const ProgressRing: React.FC<{ size?: number; stroke?: number; progress: number }> = ({
  size = 64,
  stroke = 8,
  progress,
}) => {
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

  const [collapsedMeals, setCollapsedMeals] = useState<Record<MealKey, boolean>>({
    breakfast: false,
    lunch: false,
    dinner: false,
    snacks: false,
  });

  const refreshStreak = useCallback(async (userId: string) => {
    const todayKeyValue = todayDateKey();
    let s = 0;
    for (let i = 0; i < 14; i++) {
      const offset = shiftDateKey(todayKeyValue, -i);
      const ds = await getDoc(doc(db, "users", userId, "foods", offset));
      const dd = ds.data();
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
  }, []);

  useEffect(() => {
    if (profileLoading) return;

    if (!uid) {
      history.replace("/login");
      return;
    }

    if (!profile || !profile.age) {
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
      setDayData({
        breakfast: raw?.breakfast ?? [],
        lunch: raw?.lunch ?? [],
        dinner: raw?.dinner ?? [],
        snacks: raw?.snacks ?? [],
      });
      setLoading(false);
      refreshStreak(uid);
    });

    return () => unsub();
  }, [uid, activeDateKey, refreshStreak]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("date") === activeDateKey) return;
    params.set("date", activeDateKey);
    history.replace({ pathname: location.pathname, search: `?${params.toString()}` });
  }, [activeDateKey, history, location.pathname, location.search]);

  const todayKey = todayDateKey();
  const isToday = activeDateKey === todayKey;
  const activeDateLabel = formatDateKey(activeDateKey, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const caloriesNeeded = useMemo(() => {
    if (!profile) return null;
    const { age, weight, height, gender, goal, activity } = profile;

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
  const kcalGoal = caloriesNeeded ?? 0;
  const kcalLeft = Math.max(0, Math.round(kcalGoal - kcalConsumed));
  const progress = kcalGoal > 0 ? Math.min(1, kcalConsumed / kcalGoal) : 0;
  const kcalDelta = kcalConsumed - kcalGoal;
  const summaryDifferenceLabel = isToday
    ? "Calories Remaining"
    : kcalDelta >= 0
    ? "Over target"
    : "Under target";
  const summaryDifferenceValue = isToday ? kcalLeft : Math.abs(kcalDelta);

  const macroTargets = useMemo(() => {
    if (!profile || !caloriesNeeded) return null;
    const proteinG = Math.round(1.8 * profile.weight);
    const fatG = Math.max(45, Math.round(0.8 * profile.weight));
    const proteinK = proteinG * 4;
    const fatK = fatG * 9;
    const carbsG = Math.round(Math.max(0, kcalGoal - proteinK - fatK) / 4);
    return { proteinG, fatG, carbsG };
  }, [profile, caloriesNeeded, kcalGoal]);

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
    } catch {
      const reverted = [...(dayData[meal] || [])];
      reverted.splice(index, 0, item);
      setDayData({ ...dayData, [meal]: reverted });
      setLastDeleted(null);
      setToast({ open: true, message: "Delete failed." });
    }
  };

  const undoDelete = async () => {
    if (!uid || !lastDeleted) return;
    const { meal, index, item } = lastDeleted;
    const dayKey = activeDateKey;

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
    } catch {
      const arr2 = [...(dayData[meal] || [])];
      const i2 = arr2.findIndex((x) => x.addedAt === item.addedAt);
      if (i2 >= 0) {
        arr2.splice(i2, 1);
        setDayData({ ...dayData, [meal]: arr2 });
      }
      setToast({ open: true, message: "Undo failed." });
    }
  };

  const clearMeal = async (meal: MealKey) => {
    if (!uid) return;
    if (!window.confirm(`Remove all foods from ${meal}?`)) return;

    const dayKey = activeDateKey;

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
    } catch {
      setToast({ open: true, message: "Could not clear this meal." });
    }
  };

  const copyMealFromYesterday = async (meal: MealKey) => {
    if (!uid) return;

    const todayKeyValue = activeDateKey;
    const yesterdayKey = shiftDateKey(todayKeyValue, -1);

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

      setToast({ open: true, message: `Copied ${pretty(meal)} from yesterday.` });
    } catch (e: any) {
      setToast({
        open: true,
        message: e?.message || "Could not copy from yesterday.",
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
    } catch {
      setToast({ open: true, message: "Could not clear this day." });
    }
  };

  const copyDayFromYesterday = async () => {
    if (!uid) return;

    const todayKeyValue = activeDateKey;
    const yesterdayKey = shiftDateKey(todayKeyValue, -1);

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

      setToast({ open: true, message: "Copied entire day from yesterday." });
    } catch (e: any) {
      setToast({
        open: true,
        message: e?.message || "Could not copy entire day.",
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
    } catch {
      setToast({ open: true, message: "Reorder failed." });
    }
  };

  const ringColor =
    progress <= 0.9
      ? "var(--ion-color-success)"
      : progress <= 1.1
      ? "var(--ion-color-warning)"
      : "var(--ion-color-danger)";

  const goRelativeDay = (delta: number) => {
    setActiveDateKey((prev) => clampDateKeyToToday(shiftDateKey(prev, delta)));
  };

  const openPicker = () => {
    setPendingDateKey(activeDateKey);
    setShowDatePicker(true);
  };

  const confirmPicker = () => {
    setActiveDateKey(clampDateKeyToToday(pendingDateKey));
    setShowDatePicker(false);
  };

  const handleDateChange = (value: string | null | undefined) => {
    if (!value) return;
    const key = value.split("T")[0];
    if (isDateKey(key)) {
      setPendingDateKey(clampDateKeyToToday(key));
    }
  };

  const toggleMealCollapsed = (meal: MealKey) => {
    setCollapsedMeals((prev) => ({
      ...prev,
      [meal]: !prev[meal],
    }));
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Home</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="home-content ion-padding">
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
            onClick={() => setDayMenuOpen(true)}
            aria-label="Day options"
          >
            <IonIcon icon={ellipsisVertical} />
          </IonButton>
        </div>

        <IonCard className="fs-summary">
          <IonCardHeader className="fs-summary__hdr">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <IonCardTitle>Today</IonCardTitle>
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
                  <div className="fs-metric-title">{summaryDifferenceLabel}</div>
                  <div className="fs-metric-title">Calories Consumed</div>
                </div>
                <div className="fs-summary__right">
                  <div className="fs-metric-value">{summaryDifferenceValue}</div>
                  <div className="fs-metric-value">{kcalConsumed}</div>
                </div>
              </>
            )}
          </IonCardContent>

          {profile && caloriesNeeded != null && (
            <>
              {(() => {
                const t = macroTargets;
                if (!t) return null;
                return (
                  <div
                    className="fs-macro-bars"
                    style={{ display: "grid", gap: 8, padding: "8px 16px 12px" }}
                  >
                    {[
                      { k: "carbs", g: totals.day.carbs, tg: t.carbsG, l: "Carbohydrates" },
                      { k: "protein", g: totals.day.protein, tg: t.proteinG, l: "Protein" },
                      { k: "fat", g: totals.day.fat, tg: t.fatG, l: "Fat" },
                    ].map(({ k, g, tg, l }) => {
                      const pct = Math.min(1, tg ? g / tg : 0);
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
                          <div
                            style={{
                              height: 8,
                              background: "var(--ion-color-light)",
                              borderRadius: 9999,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${pct * 100}%`,
                                height: "100%",
                                background: "var(--ion-color-primary)",
                              }}
                            />
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

        {loading && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {!loading &&
          MEALS.map((meal) => {
            const items = dayData[meal] || [];
            const hasItems = items.length > 0;
            const isCollapsed = collapsedMeals[meal];

            return (
              <IonCard key={meal} className={`fs-meal ${hasItems ? "is-open" : ""}`}>
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
                    <h2 className="fs-meal__title-text">{pretty(meal)}</h2>
                    <IonButton
                      slot="end"
                      className="fs-meal__add"
                      fill="clear"
                      onClick={(e) => {
                        e.stopPropagation();
                        history.push(`/add-food?meal=${meal}&date=${activeDateKey}`);
                      }}
                      aria-label={`Add to ${meal}`}
                    >
                      <IonIcon icon={addCircleOutline} />
                    </IonButton>
                  </IonItem>
                </IonCardHeader>

                {hasItems && !isCollapsed && (
                  <IonCardContent>
                    <p className="meal-total">
                      Total: {Math.round(totals.perMeal[meal].calories)} kcal · Carbohydrates{" "}
                      {totals.perMeal[meal].carbs.toFixed(1)} g · Protein{" "}
                      {totals.perMeal[meal].protein.toFixed(1)} g · Fat{" "}
                      {totals.perMeal[meal].fat.toFixed(1)} g
                    </p>

                    <IonButton
                      size="small"
                      fill="outline"
                      onClick={() => setCopyMenuMeal(meal)}
                      style={{ marginBottom: 8 }}
                    >
                      More options
                    </IonButton>

                    <IonList>
                      <IonReorderGroup
                        disabled={false}
                        onIonItemReorder={(ev) => handleReorder(meal, ev as any)}
                      >
                        {items.map((it, idx) => {
                          const kcal = Math.round(it.total.calories);
                          return (
                            <IonItem key={`${it.addedAt}-${idx}`} className="meal-item">
                              <IonReorder slot="start" />
                              <IonLabel>
                                <h2>
                                  {it.name}
                                  {it.brand ? ` · ${it.brand}` : ""}
                                </h2>
                                <p>
                                  Carbohydrates {it.total.carbs.toFixed(1)} g · Protein{" "}
                                  {it.total.protein.toFixed(1)} g · Fat{" "}
                                  {it.total.fat.toFixed(1)} g
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

                              <div className="kcal-badge" slot="end">
                                {kcal} kcal
                              </div>
                            </IonItem>
                          );
                        })}
                      </IonReorderGroup>
                    </IonList>
                  </IonCardContent>
                )}
              </IonCard>
            );
          })}

        <IonActionSheet
          isOpen={copyMenuMeal !== null}
          onDidDismiss={() => setCopyMenuMeal(null)}
          header={copyMenuMeal ? `Actions for ${pretty(copyMenuMeal)}` : undefined}
          buttons={[
            {
              text: "Copy from yesterday",
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
          onDidDismiss={() => setDayMenuOpen(false)}
          header="Day actions"
          buttons={[
            {
              text: "Copy entire day from yesterday",
              handler: () => {
                copyDayFromYesterday();
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

      <IonModal isOpen={showDatePicker} onDidDismiss={() => setShowDatePicker(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Select a day</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonDatetime
            presentation="date"
            value={`${pendingDateKey}T00:00:00`}
            max={`${todayKey}T23:59:59`}
            onIonChange={(e) => handleDateChange(e.detail.value?.toString())}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => setShowDatePicker(false)}
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
