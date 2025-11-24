import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonAccordion,
  IonAccordionGroup,
  IonItem,
  IonLabel,
  IonBadge,
  IonButton,
  IonIcon,
  IonNote,
  IonChip,
  IonSpinner,
  IonAlert,
  IonList,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
} from "@ionic/react";
import { addCircleOutline, refreshOutline } from "ionicons/icons";
import { useHistory } from "react-router";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { db, trackEvent } from "../../firebase";
import { formatDateKey, shiftDateKey, todayDateKey } from "../../utils/date";
import type { MealKey, MealPlanDoc, MealPlanEntry } from "../../types";
import { useProfile } from "../../hooks/useProfile";

import "./Planner.css";

const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

const emptyPlan = (): MealPlanDoc => ({
  breakfast: [],
  lunch: [],
  dinner: [],
  snacks: [],
});

const Planner: React.FC = () => {
  const history = useHistory();
  const { uid, loading: profileLoading } = useProfile();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Record<string, MealPlanDoc>>({});
  const [adding, setAdding] = useState<{ date: string; meal: MealKey } | null>(
    null
  );

  const horizon = 7;
  const upcomingDates = useMemo(
    () =>
      Array.from({ length: horizon }, (_, i) => shiftDateKey(todayDateKey(), i)),
    []
  );

  const fetchPlans = useCallback(async () => {
    if (!uid) return;

    setLoading(true);
    const entries = await Promise.all(
      upcomingDates.map(async (dateKey) => {
        const ref = doc(db, "users", uid, "plans", dateKey);
        const snap = await getDoc(ref);
        const data = snap.data() as MealPlanDoc | undefined;
        return [dateKey, data ?? emptyPlan()] as const;
      })
    );
    setPlans(Object.fromEntries(entries));
    setLoading(false);
  }, [uid, upcomingDates]);

  useEffect(() => {
    if (profileLoading) return;
    if (!uid) {
      history.replace("/login");
      return;
    }

    void fetchPlans();
  }, [fetchPlans, history, profileLoading, uid]);

  const addEntry = async (
    dateKey: string,
    meal: MealKey,
    entry: MealPlanEntry
  ) => {
    setPlans((prev) => {
      const current = prev[dateKey] ?? emptyPlan();
      const updated: MealPlanDoc = {
        ...current,
        [meal]: [...(current[meal] ?? []), entry],
      };

      if (uid) {
        const ref = doc(db, "users", uid, "plans", dateKey);
        void setDoc(ref, updated, { merge: true });
      }

      return { ...prev, [dateKey]: updated };
    });
    trackEvent("planner_add_entry", { dateKey, meal });
  };

  const removeEntry = async (dateKey: string, meal: MealKey, idx: number) => {
    setPlans((prev) => {
      const current = prev[dateKey] ?? emptyPlan();
      const list = [...(current[meal] ?? [])];
      list.splice(idx, 1);
      const updated: MealPlanDoc = { ...current, [meal]: list };

      if (uid) {
        const ref = doc(db, "users", uid, "plans", dateKey);
        void setDoc(ref, updated, { merge: true });
      }

      return { ...prev, [dateKey]: updated };
    });
    trackEvent("planner_remove_entry", { dateKey, meal });
  };

  const planSummary = (plan: MealPlanDoc) =>
    MEALS.reduce((total, meal) => total + (plan[meal]?.length || 0), 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Meal Planner</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            color="medium"
            aria-label="Refresh plans"
            onClick={() => {
              trackEvent("planner_refresh");
              void fetchPlans();
            }}
          >
            <IonIcon icon={refreshOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonCard className="planner-hero">
          <IonCardHeader>
            <IonCardTitle>Plan ahead</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            Keep a lightweight sketch of what you want to eat over the next week.
            Plans stay separate from your daily log so you can tweak them without
            touching your streak.
          </IonCardContent>
        </IonCard>

        {loading ? (
          <div className="planner-loading">
            <IonSpinner name="crescent" />
          </div>
        ) : (
          <IonAccordionGroup className="planner-accordion" multiple>
            {upcomingDates.map((dateKey) => {
              const plan = plans[dateKey] ?? emptyPlan();
              return (
                <IonAccordion value={dateKey} key={dateKey} className="planner-day">
                  <IonItem slot="header" lines="full">
                    <IonLabel>
                      <div className="planner-date">{formatDateKey(dateKey)}</div>
                      <IonNote color="medium">{planSummary(plan)} planned items</IonNote>
                    </IonLabel>
                    <IonBadge color="tertiary">{dateKey}</IonBadge>
                  </IonItem>
                  <div className="planner-day-content" slot="content">
                    <IonList lines="none">
                      {MEALS.map((meal) => (
                        <IonItem key={meal} className="planner-meal" lines="full">
                          <IonLabel>
                            <div className="planner-meal-header">{meal}</div>
                            <div className="planner-meal-items">
                              {(plan[meal] || []).length === 0 && (
                                <IonNote color="medium">No plan yet</IonNote>
                              )}
                              {(plan[meal] || []).map((entry, idx) => (
                                <IonChip key={`${meal}-${idx}`} color="success">
                                  <IonLabel>
                                    <div className="planner-chip-title">{entry.title}</div>
                                    {entry.note && (
                                      <div className="planner-chip-note">{entry.note}</div>
                                    )}
                                  </IonLabel>
                                  <IonButton
                                    fill="clear"
                                    color="light"
                                    size="small"
                                    aria-label="Remove"
                                    onClick={() => removeEntry(dateKey, meal, idx)}
                                  >
                                    ✕
                                  </IonButton>
                                </IonChip>
                              ))}
                            </div>
                          </IonLabel>
                          <IonButton
                            slot="end"
                            fill="outline"
                            size="small"
                            onClick={() => setAdding({ date: dateKey, meal })}
                          >
                            <IonIcon icon={addCircleOutline} slot="start" />
                            Add
                          </IonButton>
                        </IonItem>
                      ))}
                    </IonList>
                  </div>
                </IonAccordion>
              );
            })}
          </IonAccordionGroup>
        )}

        <IonAlert
          isOpen={!!adding}
          header={adding ? `Add to ${adding.meal}` : "Add"}
          subHeader={adding?.date}
          onDidDismiss={() => setAdding(null)}
          inputs={[
            {
              name: "title",
              type: "text",
              attributes: { maxlength: 60 },
              placeholder: "Meal or recipe",
            },
            {
              name: "note",
              type: "textarea",
              attributes: { maxlength: 120 },
              placeholder: "Optional note",
            },
          ]}
          buttons={[
            {
              text: "Cancel",
              role: "cancel",
              handler: () => setAdding(null),
            },
            {
              text: "Save",
              handler: async (data) => {
                const title = String(data?.title || "").trim();
                const note = String(data?.note || "").trim();
                if (!adding || !title) return false;
                await addEntry(adding.date, adding.meal, {
                  title,
                  note: note || undefined,
                  createdAt: new Date().toISOString(),
                });
                setAdding(null);
                return true;
              },
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Planner;