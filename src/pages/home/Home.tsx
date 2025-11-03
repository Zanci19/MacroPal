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
  IonModal,
  IonDatetime,
} from "@ionic/react";
import {
  addCircleOutline,
  logOutOutline,
  sunnyOutline,
  restaurantOutline,
  cafeOutline,
  fastFoodOutline,
  flameOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  calendarOutline,
  bulbOutline,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router";
import { auth, db } from "../../firebase";
import { doc, getDoc, onSnapshot, runTransaction } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import "./Home.css";

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
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [uid, setUid] = useState<string | null>(null);
  const todayKey = useMemo(() => new Date().toISOString().split("T")[0], []);
  const isoFromParams = useCallback(
    (search: string): string => {
      const params = new URLSearchParams(search);
      const raw = params.get("date");
      if (!raw) return todayKey;
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayKey;
      return valid > todayKey ? todayKey : valid;
    },
    [todayKey]
  );
  const [activeDate, setActiveDate] = useState<string>(() => isoFromParams(location.search));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<string>(activeDate);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [caloriesNeeded, setCaloriesNeeded] = useState<number | null>(null);

  const [dayData, setDayData] = useState<Record<MealKey, DiaryEntry[]>>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  });

  const [streak, setStreak] = useState<number>(0);

  // last deleted for undo
  const [lastDeleted, setLastDeleted] = useState<{
    meal: MealKey;
    index: number;
    item: DiaryEntry;
    date: string;
  } | null>(null);

  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        history.replace("/login");
        return;
      }
      setUid(user.uid);

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || !userDoc.data()?.age) {
        history.replace("/setup-profile");
        return;
      }
      const p = userDoc.data() as Profile;
      setProfile(p);

      const { age, weight, height, gender, goal, activity } = p;
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
      setCaloriesNeeded(Math.max(800, Math.round(daily)));
    });

    return () => unsubAuth();
  }, [history]);

  useEffect(() => {
    const next = isoFromParams(location.search);
    setActiveDate((prev) => (prev === next ? prev : next));
  }, [isoFromParams, location.search]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    setDayData({ breakfast: [], lunch: [], dinner: [], snacks: [] });
    setLastDeleted(null);

    const ref = doc(db, "users", uid, "foods", activeDate);
    const unsubDoc = onSnapshot(ref, async (snap) => {
      const d = snap.data() || {};
      setDayData({
        breakfast: d.breakfast || [],
        lunch: d.lunch || [],
        dinner: d.dinner || [],
        snacks: d.snacks || [],
      });
      setLoading(false);

      // simple 14-day streak (based on actual today)
      const today = new Date();
      let s = 0;
      for (let i = 0; i < 14; i++) {
        const dt = new Date(today);
        dt.setDate(today.getDate() - i);
        const k = dt.toISOString().split("T")[0];
        const ds = await getDoc(doc(db, "users", uid, "foods", k));
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
    });

    return () => unsubDoc();
  }, [uid, activeDate]);

  const syncUrlDate = useCallback(
    (iso: string) => {
      const params = new URLSearchParams(location.search);
      if (iso === todayKey) params.delete("date");
      else params.set("date", iso);
      history.replace({
        pathname: location.pathname,
        search: params.toString() ? `?${params}` : "",
      });
    },
    [history, location.pathname, location.search, todayKey]
  );

  const changeDate = useCallback(
    (iso: string) => {
      setActiveDate(iso);
      setPendingDate(iso);
      syncUrlDate(iso);
    },
    [syncUrlDate]
  );

  const shiftDate = useCallback(
    (delta: number) => {
      const base = new Date(activeDate);
      base.setDate(base.getDate() + delta);
      const iso = base.toISOString().split("T")[0];
      if (iso > todayKey) return;
      changeDate(iso);
    },
    [activeDate, changeDate, todayKey]
  );

  const totals = useMemo(() => {
    const sum = (arr: DiaryEntry[]) =>
      arr.reduce(
        (a, it) => ({
          calories: a.calories + (it.total?.calories || 0),
          carbs: a.carbs + (it.total?.carbs || 0),
          protein: a.protein + (it.total?.protein || 0),
          fat: a.fat + (it.total?.fat || 0),
        }),
        { calories: 0, carbs: 0, protein: 0, fat: 0 }
      );

    const perMeal = {
      breakfast: sum(dayData.breakfast),
      lunch: sum(dayData.lunch),
      dinner: sum(dayData.dinner),
      snacks: sum(dayData.snacks),
    } as Record<MealKey, Macros>;
    const day = Object.values(perMeal).reduce(
      (a, m) => ({
        calories: a.calories + m.calories,
        carbs: a.carbs + m.carbs,
        protein: a.protein + m.protein,
        fat: a.fat + m.fat,
      }),
      { calories: 0, carbs: 0, protein: 0, fat: 0 }
    );

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

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      history.replace("/login");
    } catch {
      alert("Failed to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const deleteFood = async (meal: MealKey, index: number) => {
    if (!uid) return;
    const current = dayData[meal] || [];
    if (index < 0 || index >= current.length) return;
    const item = current[index];

    setDayData((prev) => {
      const arr = [...(prev[meal] || [])];
      arr.splice(index, 1);
      return { ...prev, [meal]: arr };
    });
    setLastDeleted({ meal, index, item, date: activeDate });
    setToast({ open: true, message: `Removed ${item.name}.` });

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", activeDate);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const arr: DiaryEntry[] = [...(data[meal] || [])];
        const idx = arr.findIndex((x) => x.addedAt === item.addedAt);
        if (idx >= 0) arr.splice(idx, 1);
        else if (index <= arr.length) arr.splice(index, 1);
        tx.set(ref, { [meal]: arr }, { merge: true });
      });
    } catch {
      setDayData((prev) => {
        const arr = [...(prev[meal] || [])];
        arr.splice(index, 0, item);
        return { ...prev, [meal]: arr };
      });
      setLastDeleted(null);
      setToast({ open: true, message: "Delete failed." });
    }
  };

  const undoDelete = async () => {
    if (!uid || !lastDeleted || lastDeleted.date !== activeDate) return;
    const { meal, index, item } = lastDeleted;

    setDayData((prev) => {
      const arr = [...(prev[meal] || [])];
      const insertAt = Math.min(Math.max(index, 0), arr.length);
      arr.splice(insertAt, 0, item);
      return { ...prev, [meal]: arr };
    });
    setLastDeleted(null);

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", activeDate);
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
      setDayData((prev) => {
        const arr = [...(prev[meal] || [])];
        const i2 = arr.findIndex((x) => x.addedAt === item.addedAt);
        if (i2 >= 0) arr.splice(i2, 1);
        return { ...prev, [meal]: arr };
      });
      setToast({ open: true, message: "Undo failed." });
    }
  };

  const ringColor =
    progress <= 0.9
      ? "var(--ion-color-success)"
      : progress <= 1.1
      ? "var(--ion-color-warning)"
      : "var(--ion-color-danger)";

  const formattedActiveDate = useMemo(() => {
    const dt = new Date(activeDate);
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(dt);
  }, [activeDate]);

  const relativeLabel = useMemo(() => {
    if (activeDate === todayKey) return "Today";
    const today = new Date(todayKey);
    const current = new Date(activeDate);
    const diffMs = today.setHours(0, 0, 0, 0) - current.setHours(0, 0, 0, 0);
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  }, [activeDate, todayKey]);

  const canGoForward = activeDate < todayKey;

  const macroInsights = useMemo(() => {
    if (!macroTargets || caloriesNeeded == null) return [] as string[];
    const insights: string[] = [];
    const diff = kcalGoal - kcalConsumed;
    if (kcalGoal > 0) {
      if (diff > 120) insights.push(`You still have ${diff} kcal available to reach your goal.`);
      else if (diff < -120)
        insights.push(`You've exceeded today's goal by ${Math.abs(diff)} kcal. Consider a lighter meal or more activity.`);
      else insights.push("You're right on track with your calories — great job!");
    }
    const macroDiffs: Array<[string, number, number]> = [
      ["carbs", totals.day.carbs, macroTargets.carbsG],
      ["protein", totals.day.protein, macroTargets.proteinG],
      ["fat", totals.day.fat, macroTargets.fatG],
    ];
    macroDiffs.forEach(([key, value, target]) => {
      if (!target) return;
      const diffMacro = target - value;
      const label = key === "carbs" ? "carbs" : key;
      if (diffMacro > 10) insights.push(`Add around ${Math.round(diffMacro)} g of ${label} to hit your target.`);
      else if (diffMacro < -10)
        insights.push(`You're about ${Math.round(Math.abs(diffMacro))} g over on ${label}. Balance the rest of the day accordingly.`);
    });
    return insights.slice(0, 3);
  }, [macroTargets, caloriesNeeded, kcalGoal, kcalConsumed, totals.day.carbs, totals.day.protein, totals.day.fat]);

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
        <div className="fs-date-bar">
          <IonButton fill="clear" onClick={() => shiftDate(-1)} aria-label="Previous day">
            <IonIcon icon={chevronBackOutline} />
          </IonButton>
          <button
            className="fs-date-pill"
            onClick={() => {
              setPendingDate(activeDate);
              setDatePickerOpen(true);
            }}
          >
            <IonIcon icon={calendarOutline} />
            <span className="fs-date-pill__primary">{formattedActiveDate}</span>
            <span className="fs-date-pill__secondary">{relativeLabel}</span>
          </button>
          <IonButton
            fill="clear"
            onClick={() => shiftDate(1)}
            aria-label="Next day"
            disabled={!canGoForward}
          >
            <IonIcon icon={chevronForwardOutline} />
          </IonButton>
        </div>

        {activeDate !== todayKey && (
          <IonButton expand="block" size="small" className="fs-today-btn" onClick={() => changeDate(todayKey)}>
            Jump back to today
          </IonButton>
        )}

        {/* Summary */}
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
                <div className="fs-macro">
                  <span className="fs-macro__label">Carbohydrates</span>
                  <span className="fs-macro__val">{totals.day.carbs.toFixed(1)} g</span>
                </div>
                <div className="fs-macro">
                  <span className="fs-macro__label">Protein</span>
                  <span className="fs-macro__val">{totals.day.protein.toFixed(1)} g</span>
                </div>
                <div className="fs-macro">
                  <span className="fs-macro__label">Fat</span>
                  <span className="fs-macro__val">{totals.day.fat.toFixed(1)} g</span>
                </div>
              </div>

              {(() => {
                const t = macroTargets;
                if (!t) return null;
                return (
                  <div className="fs-macro-bars" style={{ display: "grid", gap: 8, padding: "8px 16px 12px" }}>
                    {[
                      { k: "carbs", g: totals.day.carbs, tg: t.carbsG, l: "Carbohydrates" },
                      { k: "protein", g: totals.day.protein, tg: t.proteinG, l: "Protein" },
                      { k: "fat", g: totals.day.fat, tg: t.fatG, l: "Fat" },
                    ].map(({ k, g, tg, l }) => {
                      const pct = Math.min(1, tg ? g / tg : 0);
                      return (
                        <div key={k} style={{ display: "grid", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
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

        {macroInsights.length > 0 && (
          <IonCard className="fs-insights">
            <IonCardHeader className="fs-insights__hdr">
              <div className="fs-insights__title">
                <IonIcon icon={bulbOutline} aria-hidden="true" />
                <span>Smart suggestions</span>
              </div>
            </IonCardHeader>
            <IonCardContent>
              <ul className="fs-insights__list">
                {macroInsights.map((text, idx) => (
                  <li key={idx}>{text}</li>
                ))}
              </ul>
            </IonCardContent>
          </IonCard>
        )}

        {loading && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {/* Meals */}
        {!loading &&
          MEALS.map((meal) => {
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
                      onClick={() => history.push(`/add-food?meal=${meal}&date=${activeDate}`)}
                      aria-label={`Add to ${meal}`}
                    >
                      <IonIcon icon={addCircleOutline} />
                    </IonButton>
                  </IonItem>
                </IonCardHeader>

                {hasItems && (
                  <IonCardContent>
                    <p className="meal-total">
                      Total: {Math.round(totals.perMeal[meal].calories)} kcal · Carbohydrates
                      {" "}
                      {totals.perMeal[meal].carbs.toFixed(1)} g · Protein {totals.perMeal[meal].protein.toFixed(1)} g · Fat
                      {" "}
                      {totals.perMeal[meal].fat.toFixed(1)} g
                    </p>

                    <IonList>
                      {items.map((it, idx) => {
                        const kcal = Math.round(it.total.calories);
                        return (
                          <IonItem key={`${it.addedAt}-${idx}`} className="meal-item">
                            <IonLabel>
                              <h2>
                                {it.name}
                                {it.brand ? ` · ${it.brand}` : ""}
                              </h2>
                              <p>
                                Carbohydrates {it.total.carbs.toFixed(1)} g · Protein {it.total.protein.toFixed(1)} g · Fat
                                {" "}
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
                    </IonList>
                  </IonCardContent>
                )}
              </IonCard>
            );
          })}

        <IonToast
          isOpen={toast.open}
          message={toast.message}
          duration={2500}
          buttons={
            lastDeleted && lastDeleted.date === activeDate
              ? [
                  {
                    text: "Undo",
                    role: "cancel",
                    side: "end",
                    handler: () => undoDelete(),
                  },
                ]
              : undefined
          }
          onDidDismiss={() => setToast({ open: false, message: "" })}
        />

        <IonModal isOpen={datePickerOpen} onDidDismiss={() => setDatePickerOpen(false)} className="fs-date-modal">
          <div className="fs-date-modal__content">
            <IonDatetime
              value={pendingDate}
              presentation="date"
              max={todayKey}
              onIonChange={(ev) => {
                const val = ev.detail.value;
                if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
                  setPendingDate(val.slice(0, 10));
                }
              }}
            />
            <div className="fs-date-modal__actions">
              <IonButton fill="clear" onClick={() => setDatePickerOpen(false)}>
                Cancel
              </IonButton>
              <IonButton
                onClick={() => {
                  setDatePickerOpen(false);
                  if (pendingDate !== activeDate) {
                    const safe = pendingDate > todayKey ? todayKey : pendingDate;
                    changeDate(safe);
                  }
                }}
              >
                Apply
              </IonButton>
            </div>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Home;
