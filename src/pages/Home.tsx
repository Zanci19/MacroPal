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
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonChip,
} from "@ionic/react";
import { addCircleOutline, logOutOutline, trashOutline } from "ionicons/icons";
import { useHistory } from "react-router";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot, updateDoc, arrayRemove } from "firebase/firestore";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
type Macros = { calories: number; carbs: number; protein: number; fat: number };

type DiaryEntry = {
  fdcId: number;
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

/** Simple SVG circular progress ring */
const ProgressRing: React.FC<{
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  labelTop?: string;
  labelBottom?: string;
}> = ({ size = 140, stroke = 12, progress, labelTop, labelBottom }) => {
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
          strokeOpacity="0.15"
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.7 }}>{labelTop}</div>
        <div style={{ fontWeight: 700, fontSize: 20 }}>{Math.round(clamped * 100)}%</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{labelBottom}</div>
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
  const [macroTargets, setMacroTargets] = useState<{ protein: number; carbs: number; fats: number } | null>(null);

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

      dailyCalories = Math.max(800, Math.round(dailyCalories)); // clamp to sensible minimum
      setCaloriesNeeded(dailyCalories);

      // === Macro targets ===
      const proteinPerKg = goal === "lose" ? 2.2 : goal === "gain" ? 2.0 : 1.8;
      const protein = weight * proteinPerKg;
      const proteinCalories = protein * 4;

      const fatCalories = dailyCalories * 0.25;
      const fats = fatCalories / 9;

      const carbsCalories = dailyCalories - (proteinCalories + fatCalories);
      const carbs = carbsCalories / 4;

      setMacroTargets({
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fats: Math.round(fats),
      });

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

  const goToAdd = (meal: MealKey) => {
    history.push(`/add-food?meal=${meal}`);
  };

  const pretty = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

      <IonContent className="ion-padding">
        {/* Dashboard */}
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Today</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {!profile || caloriesNeeded == null ? (
              <div className="ion-text-center" style={{ padding: 24 }}>
                <IonSpinner name="dots" />
              </div>
            ) : (
              <IonGrid>
                <IonRow className="ion-align-items-center ion-justify-content-between">
                  <IonCol size="12" sizeMd="5" className="ion-text-center">
                    <ProgressRing
                      size={140}
                      stroke={12}
                      progress={progress}
                      labelTop="Consumed"
                      labelBottom={`${kcalConsumed} / ${kcalGoal} kcal`}
                    />
                  </IonCol>

                  <IonCol size="12" sizeMd="7">
                    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <IonText>
                        <h2 style={{ margin: 0 }}>{kcalConsumed} kcal eaten</h2>
                        <p style={{ margin: "4px 0 0", opacity: 0.8 }}>{kcalLeft} kcal left</p>
                      </IonText>
                    </div>

                    {/* Macro chips - targets for the day */}
                    {macroTargets && (
                      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <IonChip>
                          <IonText>
                            <strong>Protein target:</strong> {macroTargets.protein} g
                          </IonText>
                        </IonChip>
                        <IonChip>
                          <IonText>
                            <strong>Carbs target:</strong> {macroTargets.carbs} g
                          </IonText>
                        </IonChip>
                        <IonChip>
                          <IonText>
                            <strong>Fat target:</strong> {macroTargets.fats} g
                          </IonText>
                        </IonChip>
                      </div>
                    )}

                    {/* Macro chips - consumed so far */}
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <IonChip>
                        <IonText>
                          <strong>Protein eaten:</strong> {totals.day.protein.toFixed(1)} g
                        </IonText>
                      </IonChip>
                      <IonChip>
                        <IonText>
                          <strong>Carbs eaten:</strong> {totals.day.carbs.toFixed(1)} g
                        </IonText>
                      </IonChip>
                      <IonChip>
                        <IonText>
                          <strong>Fat eaten:</strong> {totals.day.fat.toFixed(1)} g
                        </IonText>
                      </IonChip>
                    </div>
                  </IonCol>
                </IonRow>
              </IonGrid>
            )}
          </IonCardContent>
        </IonCard>

        {loading && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {/* Meals */}
        {!loading &&
          MEALS.map((meal) => (
            <IonCard key={meal}>
              <IonCardHeader style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <IonCardTitle>{pretty(meal)}</IonCardTitle>
                <IonButton fill="clear" onClick={() => history.push(`/add-food?meal=${meal}`)} aria-label={`Add to ${meal}`}>
                  <IonIcon icon={addCircleOutline} />
                </IonButton>
              </IonCardHeader>

              <IonCardContent>
                {/* Totals line per meal */}
                <p style={{ marginTop: 0, opacity: 0.8 }}>
                  Total: {Math.round(totals.perMeal[meal].calories)} kcal · C {totals.perMeal[meal].carbs.toFixed(1)} g · P{" "}
                  {totals.perMeal[meal].protein.toFixed(1)} g · F {totals.perMeal[meal].fat.toFixed(1)} g
                </p>

                {/* Items list */}
                {dayData[meal]?.length ? (
                  <IonList>
                    {dayData[meal].map((it, idx) => (
                      <IonItem key={`${it.addedAt}-${idx}`}>
                        <IonLabel>
                          <h2>
                            {it.name}
                            {it.brand ? ` · ${it.brand}` : ""}
                          </h2>
                          <p>
                            {Math.round(it.total.calories)} kcal · C {it.total.carbs.toFixed(1)} g · P{" "}
                            {it.total.protein.toFixed(1)} g · F {it.total.fat.toFixed(1)} g
                          </p>
                        </IonLabel>

                        {/* Remove button on the right */}
                        <IonButton
                          slot="end"
                          fill="clear"
                          color="danger"
                          aria-label={`Remove ${it.name}`}
                          onClick={() => removeFood(meal, it)}
                        >
                          <IonIcon icon={trashOutline} />
                        </IonButton>
                      </IonItem>
                    ))}
                  </IonList>
                ) : (
                  <p style={{ margin: 0, opacity: 0.6 }}>No items yet. Tap the + to add.</p>
                )}
              </IonCardContent>
            </IonCard>
          ))}
      </IonContent>
    </IonPage>
  );
};

export default Home;
