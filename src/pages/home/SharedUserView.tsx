import React, { useEffect, useMemo, useState } from "react";
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
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonButtons,
  IonBackButton,
  IonSegment,
  IonSegmentButton,
  IonChip,
  IonIcon,
  IonButton,
  IonGrid,
  IonRow,
  IonCol,
} from "@ionic/react";
import {
  chevronBackOutline,
  chevronForwardOutline,
  calendarOutline,
  flameOutline,
  restaurantOutline,
} from "ionicons/icons";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, trackEvent } from "../../firebase";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import type {
  MealKey,
  Macros,
  DayDiaryDoc,
  Profile,
} from "../../types";
import "./SharedUserView.css";

/* ── helpers ────────────────────────────── */
const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];
const MEAL_LABELS: Record<MealKey, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

function safeNum(n: unknown, dp = 1): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  const factor = Math.pow(10, dp);
  return Math.round(v * factor) / factor;
}

const todayKey = () => new Date().toISOString().split("T")[0];
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dateKey = (d: Date) => d.toISOString().split("T")[0];

type DailyTotals = Macros & { items: number };

function computeDaily(day: DayDiaryDoc): DailyTotals {
  let cal = 0;
  let carbs = 0;
  let protein = 0;
  let fat = 0;
  let items = 0;
  for (const meal of MEALS) {
    for (const entry of day[meal] || []) {
      cal += entry.total?.calories ?? 0;
      carbs += entry.total?.carbs ?? 0;
      protein += entry.total?.protein ?? 0;
      fat += entry.total?.fat ?? 0;
      items++;
    }
  }
  return { calories: safeNum(cal, 0), carbs: safeNum(carbs), protein: safeNum(protein), fat: safeNum(fat), items };
}

/* ── component ──────────────────────────── */
const SharedUserView: React.FC = () => {
  const { uid } = useParams<{ uid: string }>();
  const [displayName, setDisplayName] = useState<string>("User");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeDate, setActiveDate] = useState(() => new Date());
  const [dayData, setDayData] = useState<DayDiaryDoc>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"diary" | "summary">("diary");

  const activeDateKey = useMemo(() => dateKey(activeDate), [activeDate]);
  const isToday = activeDateKey === todayKey();

  /* ── fetch shared user profile once ──── */
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const data = snap.data();
          setProfile((data.profile as Profile) ?? null);
          // Prefer top-level displayName (set by Firebase Auth), then email, fallback
          const name = data.displayName || data.email || "User";
          setDisplayName(String(name));
        }
      } catch (err) {
        console.error("Failed to fetch shared user profile:", err);
      }
    })();
  }, [uid]);

  /* ── fetch diary for active date ─────── */
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid, "foods", activeDateKey));
        if (cancelled) return;
        if (snap.exists()) {
          const raw = snap.data() as Partial<DayDiaryDoc>;
          setDayData({
            breakfast: raw.breakfast ?? [],
            lunch: raw.lunch ?? [],
            dinner: raw.dinner ?? [],
            snacks: raw.snacks ?? [],
          });
        } else {
          setDayData({ breakfast: [], lunch: [], dinner: [], snacks: [] });
        }
      } catch (err) {
        console.error("Failed to fetch shared diary:", err);
        setDayData({ breakfast: [], lunch: [], dinner: [], snacks: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, activeDateKey]);

  const totals = useMemo(() => computeDaily(dayData), [dayData]);

  const goBack = () => setActiveDate((d) => addDays(d, -1));
  const goForward = () => {
    if (!isToday) setActiveDate((d) => addDays(d, 1));
  };

  const formatDateLabel = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  useEffect(() => {
    trackEvent("shared_user_view", { targetUid: uid, date: activeDateKey });
  }, [uid, activeDateKey]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={SETTINGS_ROUTES.sharing} icon={chevronBackOutline} text="" />
          </IonButtons>
          <IonTitle>{displayName}'s Diary</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding shared-user-page">
        {/* ── Date navigator ──────────────── */}
        <div className="shared-date-nav">
          <IonButton fill="clear" size="small" onClick={goBack}>
            <IonIcon icon={chevronBackOutline} />
          </IonButton>
          <IonChip outline>
            <IonIcon icon={calendarOutline} />
            <IonLabel>{isToday ? "Today" : formatDateLabel(activeDate)}</IonLabel>
          </IonChip>
          <IonButton fill="clear" size="small" onClick={goForward} disabled={isToday}>
            <IonIcon icon={chevronForwardOutline} />
          </IonButton>
        </div>

        {/* ── View toggle ──────────────────── */}
        <IonSegment
          value={view}
          onIonChange={(e) => setView(e.detail.value as "diary" | "summary")}
          className="shared-view-toggle"
        >
          <IonSegmentButton value="diary">
            <IonLabel>Diary</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="summary">
            <IonLabel>Summary</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {loading ? (
          <div className="shared-loading">
            <IonSpinner />
            <p>Loading diary…</p>
          </div>
        ) : view === "diary" ? (
          /* ── Diary view ─────────────────── */
          <div className="shared-diary-sections">
            {MEALS.map((meal) => {
              const entries = dayData[meal] || [];
              return (
                <IonCard key={meal}>
                  <IonCardHeader>
                    <IonCardTitle className="shared-meal-title">
                      {MEAL_LABELS[meal]}
                      <IonChip outline color="medium">
                        <IonLabel>
                          {safeNum(
                            entries.reduce(
                              (s, e) => s + (e.total?.calories ?? 0),
                              0,
                            ),
                            0,
                          )}{" "}
                          kcal
                        </IonLabel>
                      </IonChip>
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {entries.length === 0 ? (
                      <IonText color="medium">
                        <p className="shared-empty-text">No items logged</p>
                      </IonText>
                    ) : (
                      <IonList>
                        {entries.map((entry, idx) => (
                          <IonItem key={`${meal}-${idx}`} lines="full">
                            <IonLabel>
                              <h3>{entry.name}</h3>
                              {entry.brand && (
                                <p className="shared-brand">{entry.brand}</p>
                              )}
                              <p className="shared-entry-macros">
                                {safeNum(entry.total?.calories ?? 0, 0)} kcal
                                {" · "}
                                P: {safeNum(entry.total?.protein ?? 0)}g
                                {" · "}
                                C: {safeNum(entry.total?.carbs ?? 0)}g
                                {" · "}
                                F: {safeNum(entry.total?.fat ?? 0)}g
                              </p>
                            </IonLabel>
                          </IonItem>
                        ))}
                      </IonList>
                    )}
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        ) : (
          /* ── Summary view ───────────────── */
          <div className="shared-summary">
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="shared-meal-title">
                  <IonIcon icon={flameOutline} className="shared-summary-icon" />
                  Daily totals
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonGrid>
                  <IonRow>
                    <IonCol className="shared-stat">
                      <span className="shared-stat-value">{totals.calories}</span>
                      <span className="shared-stat-label">kcal</span>
                    </IonCol>
                    <IonCol className="shared-stat">
                      <span className="shared-stat-value shared-stat-protein">
                        {totals.protein}g
                      </span>
                      <span className="shared-stat-label">Protein</span>
                    </IonCol>
                    <IonCol className="shared-stat">
                      <span className="shared-stat-value shared-stat-carbs">
                        {totals.carbs}g
                      </span>
                      <span className="shared-stat-label">Carbs</span>
                    </IonCol>
                    <IonCol className="shared-stat">
                      <span className="shared-stat-value shared-stat-fat">{totals.fat}g</span>
                      <span className="shared-stat-label">Fat</span>
                    </IonCol>
                  </IonRow>
                </IonGrid>

                <div className="shared-items-count">
                  <IonIcon icon={restaurantOutline} />
                  <span>{totals.items} food items logged</span>
                </div>
              </IonCardContent>
            </IonCard>

            {/* Per-meal breakdown */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="shared-meal-title">Meal breakdown</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList>
                  {MEALS.map((meal) => {
                    const entries = dayData[meal] || [];
                    const mealCal = entries.reduce(
                      (s, e) => s + (e.total?.calories ?? 0),
                      0,
                    );
                    return (
                      <IonItem key={meal} lines="full">
                        <IonLabel>
                          <h3>{MEAL_LABELS[meal]}</h3>
                          <p>
                            {entries.length} item{entries.length !== 1 ? "s" : ""}
                          </p>
                        </IonLabel>
                        <IonChip slot="end" outline color="medium">
                          <IonLabel>{safeNum(mealCal, 0)} kcal</IonLabel>
                        </IonChip>
                      </IonItem>
                    );
                  })}
                </IonList>
              </IonCardContent>
            </IonCard>

            {/* Profile info if available */}
            {profile && (
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle className="shared-meal-title">Profile</IonCardTitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonList>
                    {profile.age && (
                      <IonItem lines="full">
                        <IonLabel>Age</IonLabel>
                        <IonText slot="end">{profile.age}</IonText>
                      </IonItem>
                    )}
                    {profile.weight && (
                      <IonItem lines="full">
                        <IonLabel>Weight</IonLabel>
                        <IonText slot="end">{profile.weight} kg</IonText>
                      </IonItem>
                    )}
                    {profile.height && (
                      <IonItem lines="full">
                        <IonLabel>Height</IonLabel>
                        <IonText slot="end">{profile.height} cm</IonText>
                      </IonItem>
                    )}
                    {profile.goal && (
                      <IonItem lines="full">
                        <IonLabel>Goal</IonLabel>
                        <IonText slot="end" className="shared-capitalize">
                          {profile.goal}
                        </IonText>
                      </IonItem>
                    )}
                    {profile.activity && (
                      <IonItem lines="full">
                        <IonLabel>Activity</IonLabel>
                        <IonText slot="end" className="shared-capitalize">
                          {profile.activity}
                        </IonText>
                      </IonItem>
                    )}
                  </IonList>
                </IonCardContent>
              </IonCard>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default SharedUserView;
