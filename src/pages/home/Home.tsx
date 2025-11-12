// src/pages/home/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  IonProgressBar,
  IonText,
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
  waterOutline,
  refreshOutline,
} from "ionicons/icons";
import { useHistory } from "react-router";
import { auth, db } from "../../firebase";
import {
  doc, getDoc, onSnapshot, runTransaction, setDoc
} from "firebase/firestore";
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
  waterTarget?: number;
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

  const [hydrationMl, setHydrationMl] = useState<number>(0);
  const [hydrationToast, setHydrationToast] = useState<{
    open: boolean;
    message: string;
    color?: string;
  }>({ open: false, message: "", color: "success" });

  // last deleted for undo
  const [lastDeleted, setLastDeleted] = useState<{
    meal: MealKey; index: number; item: DiaryEntry;
  } | null>(null);

  const [toast, setToast] = useState<{ open: boolean; message: string }>(
    { open: false, message: "" }
  );

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
        setHydrationMl(typeof d.hydrationMl === "number" ? d.hydrationMl : 0);
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
    if (!profile || !caloriesNeeded || !profile.weight) return null;
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

  const hydrationTarget = profile?.waterTarget && profile.waterTarget > 0 ? profile.waterTarget : 2000;
  const hydrationProgress = hydrationTarget > 0 ? Math.min(1, hydrationMl / hydrationTarget) : 0;
  const hydrationStatus = hydrationTarget > 0
    ? hydrationMl >= hydrationTarget
      ? `Goal met! ${hydrationMl - hydrationTarget} ml over`
      : `${Math.max(0, hydrationTarget - hydrationMl)} ml to go`
    : "Set a water goal in Settings.";

  const updateHydration = async (delta: number) => {
    if (!uid || !todayKey || delta === 0) return;
    const prev = hydrationMl;
    const optimistic = Math.max(0, prev + delta);
    setHydrationMl(optimistic);

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", todayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const current = typeof data.hydrationMl === "number" ? data.hydrationMl : 0;
        const next = Math.max(0, current + delta);
        tx.set(ref, { hydrationMl: next }, { merge: true });
      });

      const message = delta > 0
        ? `Logged ${delta} ml of water.`
        : `Removed ${Math.abs(delta)} ml.`;
      setHydrationToast({ open: true, message, color: "success" });
    } catch (err) {
      console.error(err);
      setHydrationMl(prev);
      setHydrationToast({ open: true, message: "Couldn't update water log.", color: "danger" });
    }
  };

  const resetHydration = async () => {
    if (!uid || !todayKey) return;
    const prev = hydrationMl;
    setHydrationMl(0);

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", todayKey);
        await tx.get(ref);
        tx.set(ref, { hydrationMl: 0 }, { merge: true });
      });
      setHydrationToast({ open: true, message: "Hydration reset.", color: "medium" });
    } catch (err) {
      console.error(err);
      setHydrationMl(prev);
      setHydrationToast({ open: true, message: "Couldn't reset hydration.", color: "danger" });
    }
  };

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
    setToast({ open: true, message: `Removed ${item.name}.` });

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
      setToast({ open: true, message: "Delete failed." });
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
      setToast({ open: true, message: "Undo failed." });
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

        <IonCard className="hydration-card">
          <IonCardHeader className="hydration-card__hdr">
            <IonCardTitle>Hydration</IonCardTitle>
            <IonChip
              color={hydrationProgress >= 1 ? "success" : "medium"}
              style={{ marginInlineStart: "auto" }}
            >
              <IonIcon icon={waterOutline} />
              <span style={{ marginLeft: 6 }}>Goal {hydrationTarget} ml</span>
            </IonChip>
          </IonCardHeader>
          <IonCardContent>
            <div className="hydration-stats">
              <div>
                <div className="hydration-label">Drank</div>
                <div className="hydration-value">{hydrationMl} ml</div>
              </div>
              <div>
                <div className="hydration-label">Remaining</div>
                <div className="hydration-value">
                  {hydrationTarget > 0 ? Math.max(0, hydrationTarget - hydrationMl) : "—"} ml
                </div>
              </div>
            </div>

            <div className="hydration-progress">
              <IonProgressBar value={hydrationProgress} color={hydrationProgress >= 1 ? "success" : undefined} />
              <IonText color="medium">
                <p className="hydration-status">{hydrationStatus}</p>
              </IonText>
            </div>

            <div className="hydration-actions">
              <IonButton fill="outline" onClick={() => updateHydration(-250)} disabled={hydrationMl === 0}>
                −250 ml
              </IonButton>
              <IonButton onClick={() => updateHydration(250)}>+250 ml</IonButton>
              <IonButton onClick={() => updateHydration(500)}>+500 ml</IonButton>
              <IonButton fill="clear" color="medium" onClick={resetHydration}>
                <IonIcon slot="start" icon={refreshOutline} />Reset
              </IonButton>
            </div>
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
          isOpen={hydrationToast.open}
          message={hydrationToast.message}
          color={hydrationToast.color}
          duration={1800}
          onDidDismiss={() => setHydrationToast({ open: false, message: "" })}
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;
