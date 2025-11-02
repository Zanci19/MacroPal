import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonButtons,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { flameOutline, logOutOutline } from "ionicons/icons";
import { useHistory } from "react-router";
import { doc, runTransaction } from "firebase/firestore";
import { signOut } from "firebase/auth";

import { auth, db } from "../../firebase";
import { useAuthGate } from "../../hooks/useAuthGate";
import { useDiary } from "../../hooks/useDiary";
import { useStreak } from "../../hooks/useStreak";
import { PROFILE_MISSING_ERROR, useUserProfile } from "../../hooks/useUserProfile";
import { DiaryEntry, MealKey, Profile } from "../../types/nutrition";
import {
  calculateCalorieGoal,
  calculateMacroTargets,
  computeDiaryTotals,
  getTodayKey,
  MEALS,
} from "../../utils/nutrition";
import ProgressRing from "../../components/home/ProgressRing";
import MealCard from "../../components/home/MealCard";

import "./Home.css";

const useTodayKey = () => {
  const [todayKey, setTodayKey] = useState(getTodayKey());

  useEffect(() => {
    const updateAtMidnight = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      return next.getTime() - now.getTime();
    };

    const timeout = setTimeout(() => setTodayKey(getTodayKey()), updateAtMidnight());
    return () => clearTimeout(timeout);
  }, [todayKey]);

  return todayKey;
};

const useCalorieAndMacroGoals = (profile: Profile | null) => {
  return useMemo(() => {
    if (!profile) {
      return { calorieGoal: null, macroTargets: null };
    }

    const calorieGoal = calculateCalorieGoal(profile);
    const macroTargets = calculateMacroTargets(profile, calorieGoal);

    return { calorieGoal, macroTargets };
  }, [profile]);
};

const Home: React.FC = () => {
  const history = useHistory();
  const todayKey = useTodayKey();

  const { user, loading: authLoading } = useAuthGate();
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!authLoading && !uid) {
      history.replace("/login");
    }
  }, [authLoading, history, uid]);

  const { profile, loading: profileLoading, error: profileError } = useUserProfile(uid);

  useEffect(() => {
    const shouldRedirectToSetup =
      !profileLoading &&
      ((profile && !profile.age) || profileError?.message === PROFILE_MISSING_ERROR);
    if (shouldRedirectToSetup) {
      history.replace("/setup-profile");
    }
  }, [history, profile, profileError, profileLoading]);

  const { data: diaryDataFromServer, loading: diaryLoading } = useDiary(uid, todayKey);
  const [dayData, setDayData] = useState(diaryDataFromServer);

  useEffect(() => {
    setDayData(diaryDataFromServer);
  }, [diaryDataFromServer]);

  const streak = useStreak(uid, 14);
  const { calorieGoal, macroTargets } = useCalorieAndMacroGoals(profile ?? null);

  const totals = useMemo(() => computeDiaryTotals(dayData), [dayData]);

  const caloriesConsumed = Math.round(Math.max(0, totals.day.calories));
  const caloriesRemaining = Math.max(0, Math.round((calorieGoal ?? 0) - caloriesConsumed));
  const progress = calorieGoal ? Math.min(1, caloriesConsumed / calorieGoal) : 0;

  const [loggingOut, setLoggingOut] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<{
    meal: MealKey;
    index: number;
    item: DiaryEntry;
  } | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string }>(
    { open: false, message: "" }
  );

  const ringColor =
    progress <= 0.9
      ? "var(--ion-color-success)"
      : progress <= 1.1
      ? "var(--ion-color-warning)"
      : "var(--ion-color-danger)";

  const showLoadingState = authLoading || profileLoading;
  const showSpinner = showLoadingState || diaryLoading || !profile || calorieGoal == null;

  const handleLogout = useCallback(async () => {
    try {
      setLoggingOut(true);
      await signOut(auth);
      history.replace("/login");
    } catch {
      alert("Failed to log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }, [history]);

  const deleteFood = useCallback(
    async (meal: MealKey, index: number) => {
      if (!uid) return;
      const current = dayData[meal] || [];
      if (index < 0 || index >= current.length) return;

      const item = current[index];
      const previousState = dayData;
      const nextState = { ...dayData, [meal]: current.filter((_, idx) => idx !== index) };
      setDayData(nextState);
      setLastDeleted({ meal, index, item });
      setToast({ open: true, message: `Removed ${item.name}.` });

      try {
        await runTransaction(db, async (tx) => {
          const ref = doc(db, "users", uid, "foods", todayKey);
          const snap = await tx.get(ref);
          const data = snap.data() || {};
          const arr: DiaryEntry[] = Array.isArray(data[meal]) ? [...data[meal]] : [];
          const idx = arr.findIndex((entry) => entry.addedAt === item.addedAt);
          if (idx >= 0) {
            arr.splice(idx, 1);
          } else if (index <= arr.length) {
            arr.splice(index, 1);
          }
          tx.set(ref, { [meal]: arr }, { merge: true });
        });
      } catch {
        setDayData(previousState);
        setLastDeleted(null);
        setToast({ open: true, message: "Delete failed." });
      }
    },
    [dayData, todayKey, uid]
  );

  const undoDelete = useCallback(async () => {
    if (!uid || !lastDeleted) return;
    const { meal, index, item } = lastDeleted;

    const current = dayData[meal] || [];
    const insertAt = Math.min(Math.max(index, 0), current.length);
    const updated = {
      ...dayData,
      [meal]: [...current.slice(0, insertAt), item, ...current.slice(insertAt)],
    };
    setDayData(updated);
    setLastDeleted(null);

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "foods", todayKey);
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const arr: DiaryEntry[] = Array.isArray(data[meal]) ? [...data[meal]] : [];
        const exists = arr.some((entry) => entry.addedAt === item.addedAt);
        if (!exists) {
          const pos = Math.min(Math.max(index, 0), arr.length);
          arr.splice(pos, 0, item);
          tx.set(ref, { [meal]: arr }, { merge: true });
        }
      });
    } catch {
      setToast({ open: true, message: "Undo failed." });
    }
  }, [dayData, lastDeleted, todayKey, uid]);

  const macroBars = useMemo(() => {
    if (!macroTargets) return null;
    return (
      <div className="fs-macro-bars" style={{ display: "grid", gap: 8, padding: "8px 16px 12px" }}>
        {(
          [
            { key: "carbs", label: "Carbohydrates", value: totals.day.carbs, target: macroTargets.carbsG },
            { key: "protein", label: "Protein", value: totals.day.protein, target: macroTargets.proteinG },
            { key: "fat", label: "Fat", value: totals.day.fat, target: macroTargets.fatG },
          ] as const
        ).map(({ key, label, value, target }) => {
          const pct = target ? Math.min(1, value / target) : 0;
          return (
            <div key={key} style={{ display: "grid", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>{label}</span>
                <span>
                  {value.toFixed(0)} / {target} g
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
  }, [macroTargets, totals.day.carbs, totals.day.fat, totals.day.protein]);

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
            {showSpinner ? (
              <div className="ion-text-center" style={{ padding: 24 }}>
                <IonSpinner name="dots" />
              </div>
            ) : (
              <>
                <div className="fs-summary__left" style={{ color: ringColor }}>
                  <ProgressRing progress={progress} />
                </div>
                <div className="fs-summary__mid">
                  <div className="fs-metric-title">Calories Remaining</div>
                  <div className="fs-metric-title">Calories Consumed</div>
                </div>
                <div className="fs-summary__right">
                  <div className="fs-metric-value">{caloriesRemaining}</div>
                  <div className="fs-metric-value">{caloriesConsumed}</div>
                </div>
              </>
            )}
          </IonCardContent>

          {!showSpinner && (
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
              {macroBars}
            </>
          )}
        </IonCard>

        {showSpinner && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {!showSpinner &&
          MEALS.map((meal) => (
            <MealCard
              key={meal}
              meal={meal}
              items={dayData[meal] || []}
              totals={totals.perMeal[meal]}
              onAdd={() => history.push(`/add-food?meal=${meal}`)}
              onDelete={(index) => deleteFood(meal, index)}
            />
          ))}

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
    </IonPage>
  );
};

export default Home;
