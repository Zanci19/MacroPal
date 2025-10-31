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
} from "@ionic/react";
import {
  addCircleOutline,
  logOutOutline,
  trashOutline,
  sunnyOutline,
  restaurantOutline,
  cafeOutline,
  fastFoodOutline,
} from "ionicons/icons";
import { useHistory } from "react-router";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc, arrayRemove } from "firebase/firestore";
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

/** Simple SVG circular progress ring (uses currentColor) */
const ProgressRing: React.FC<{
  size?: number;
  stroke?: number;
  progress: number; // 0..1
}> = ({ size = 64, stroke = 8, progress }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress || 0));
  const dash = clamped * circumference;

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-pct">{Math.round(clamped * 100)}%</div>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [caloriesNeeded, setCaloriesNeeded] = useState<number | null>(null);

  const [dayData, setDayData] = useState<Record<MealKey, DiaryEntry[]>>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  });

  // Auth + Profile fetch + subscribe to today's foods
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        history.replace("/login");
        return;
      }

      // Load profile
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || !userDoc.data()?.age) {
        history.replace("/setup-profile");
        return;
      }
      const data = userDoc.data() as Profile;
      setProfile(data);

      // === Mifflin-St Jeor ===
      const { age, weight, height, gender, goal, activity } = data;

      let bmr =
        gender === "male"
          ? 10 * weight + 6.25 * height - 5 * age + 5
          : 10 * weight + 6.25 * height - 5 * age - 161;

      let activityMultiplier = 1.2;
      switch (activity) {
        case "light":
          activityMultiplier = 1.375;
          break;
        case "moderate":
          activityMultiplier = 1.55;
          break;
        case "very":
          activityMultiplier = 1.725;
          break;
        case "extra":
          activityMultiplier = 1.9;
          break;
        default:
          activityMultiplier = 1.2; // sedentary
      }

      let dailyCalories = bmr * activityMultiplier;

      if (goal === "lose") dailyCalories -= 500;
      else if (goal === "gain") dailyCalories += 500;

      dailyCalories = Math.max(800, Math.round(dailyCalories)); // sensible minimum
      setCaloriesNeeded(dailyCalories);

      // Subscribe to today's diary
      const today = new Date().toISOString().split("T")[0];
      const ref = doc(db, "users", user.uid, "foods", today);
      const unsubDoc = onSnapshot(ref, (snap) => {
        const d = snap.data() || {};
        setDayData({
          breakfast: d.breakfast || [],
          lunch: d.lunch || [],
          dinner: d.dinner || [],
          snacks: d.snacks || [],
        });
        setLoading(false);
      });

      return () => unsubDoc();
    });

    return () => unsubAuth();
  }, [history]);

  // Totals
  const totals = useMemo(() => {
    const sum = (arr: DiaryEntry[]) =>
      arr.reduce(
        (acc, it) => ({
          calories: acc.calories + (it.total?.calories || 0),
          carbs: acc.carbs + (it.total?.carbs || 0),
          protein: acc.protein + (it.total?.protein || 0),
          fat: acc.fat + (it.total?.fat || 0),
        }),
        { calories: 0, carbs: 0, protein: 0, fat: 0 }
      );

    const perMeal = {
      breakfast: sum(dayData.breakfast),
      lunch: sum(dayData.lunch),
      dinner: sum(dayData.dinner),
      snacks: sum(dayData.snacks),
    };

    const day = Object.values(perMeal).reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        carbs: acc.carbs + m.carbs,
        protein: acc.protein + m.protein,
        fat: acc.fat + m.fat,
      }),
      { calories: 0, carbs: 0, protein: 0, fat: 0 }
    );

    return { perMeal, day };
  }, [dayData]);

  const kcalConsumed = Math.max(0, Math.round(totals.day.calories));
  const kcalGoal = caloriesNeeded ?? 0;
  const kcalLeft = Math.max(0, Math.round(kcalGoal - kcalConsumed));
  const progress = kcalGoal > 0 ? Math.min(1, kcalConsumed / kcalGoal) : 0;

  const pretty = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Ionicon map
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
    } catch (err) {
      console.error(err);
      alert("Failed to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  const removeFood = async (meal: MealKey, entry: DiaryEntry) => {
    if (!auth.currentUser) return;
    const ok = window.confirm(`Remove "${entry.name}" from ${pretty(meal)}?`);
    if (!ok) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      const ref = doc(db, "users", auth.currentUser.uid, "foods", today);
      await updateDoc(ref, { [meal]: arrayRemove(entry) });
    } catch (err) {
      console.error(err);
      alert("Could not remove the item. Try again.");
    }
  };

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
        {/* ====== Summary header ====== */}
        <IonCard className="fs-summary">
          <IonCardHeader className="fs-summary__hdr">
            <IonCardTitle>Today</IonCardTitle>
          </IonCardHeader>

          <IonCardContent className="fs-summary__row">
            {!profile || caloriesNeeded == null ? (
              <div className="ion-text-center" style={{ padding: 24 }}>
                <IonSpinner name="dots" />
              </div>
            ) : (
              <>
                {/* Left: ring (blue <100%, red >=100%) */}
                <div
                  className="fs-summary__left"
                  style={{ color: progress < 1 ? "var(--ion-color-primary, #3b82f6)" : "var(--mp-bad, #ef4444)" }}
                >
                  <ProgressRing size={64} stroke={8} progress={progress} />
                </div>

                {/* Middle: metric titles */}
                <div className="fs-summary__mid">
                  <div className="fs-metric-title">Calories Remaining</div>
                  <div className="fs-metric-title">Calories Consumed</div>
                </div>

                {/* Right: metric values */}
                <div className="fs-summary__right">
                  <div className="fs-metric-value">{kcalLeft}</div>
                  <div className="fs-metric-value">{kcalConsumed}</div>
                </div>
              </>
            )}
          </IonCardContent>

          {/* Macros row */}
          {profile && caloriesNeeded != null && (
            <div className="fs-macros">
              <div className="fs-macro">
                <span className="fs-macro__label">C</span>
                <span className="fs-macro__val">{totals.day.carbs.toFixed(1)} g</span>
              </div>
              <div className="fs-macro">
                <span className="fs-macro__label">P</span>
                <span className="fs-macro__val">{totals.day.protein.toFixed(1)} g</span>
              </div>
              <div className="fs-macro">
                <span className="fs-macro__label">F</span>
                <span className="fs-macro__val">{totals.day.fat.toFixed(1)} g</span>
              </div>
            </div>
          )}
        </IonCard>

        {loading && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {/* ====== Meals ====== */}
        {!loading &&
          MEALS.map((meal) => {
            const hasItems = (dayData[meal] || []).length > 0;
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
                      onClick={() => history.push(`/add-food?meal=${meal}`)}
                      aria-label={`Add to ${meal}`}
                    >
                      <IonIcon icon={addCircleOutline} />
                    </IonButton>
                  </IonItem>
                </IonCardHeader>

                {hasItems && (
                  <IonCardContent>
                    <p className="meal-total">
                      Total: {Math.round(totals.perMeal[meal].calories)} kcal · C {totals.perMeal[meal].carbs.toFixed(1)} g · P{" "}
                      {totals.perMeal[meal].protein.toFixed(1)} g · F {totals.perMeal[meal].fat.toFixed(1)} g
                    </p>

                    <IonList>
                      {dayData[meal].map((it, idx) => {
                        const kcal = Math.round(it.total.calories);
                        return (
                          <IonItem key={`${it.addedAt}-${idx}`} className="meal-item">
                            <IonLabel>
                              <h2>
                                {it.name}
                                {it.brand ? ` · ${it.brand}` : ""}
                              </h2>
                              <p>
                                C {it.total.carbs.toFixed(1)} g · P {it.total.protein.toFixed(1)} g · F {it.total.fat.toFixed(1)} g
                              </p>
                            </IonLabel>

                            <div className="kcal-badge" slot="end">
                              {kcal} kcal
                            </div>

                            <IonButton
                              slot="end"
                              fill="clear"
                              color="danger"
                              aria-label={`Remove ${it.name}`}
                              onClick={() => removeFood(meal, it)}
                              className="row-remove"
                            >
                              <IonIcon icon={trashOutline} />
                            </IonButton>
                          </IonItem>
                        );
                      })}
                    </IonList>
                  </IonCardContent>
                )}
              </IonCard>
            );
          })}
      </IonContent>
    </IonPage>
  );
};

export default Home;
