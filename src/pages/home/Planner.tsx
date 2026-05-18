import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonAccordion,
  IonAccordionGroup,
  IonItem,
  IonLabel,
  IonBadge,
  IonButton,
  IonIcon,
  IonNote,
  IonSpinner,
  IonAlert,
  IonList,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonToast,
} from "@ionic/react";
import {
  addCircleOutline,
  calendarOutline,
  refreshOutline,
  searchOutline,
  trashOutline,
} from "ionicons/icons";
import { useHistory } from "react-router";

import { trackEvent } from "../../firebase";
import { formatDateKey, shiftDateKey, todayDateKey } from "../../utils/date";
import type { MealKey, MealPlanDoc, MealPlanEntry } from "../../types";
import { useProfile } from "../../hooks/useProfile";
import { useDemoFirestore } from "../../hooks/useDemoFirestore";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";

import "./Planner.css";

const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];
const HORIZON_DAYS = 7;

const emptyPlan = (): MealPlanDoc => ({
  breakfast: [],
  lunch: [],
  dinner: [],
  snacks: [],
});

const prettyMeal = (meal: MealKey) =>
  meal === "snacks" ? "Snacks" : meal[0].toUpperCase() + meal.slice(1);

const validEntries = (entries: unknown): MealPlanEntry[] => {
  if (!Array.isArray(entries)) return [];

  return entries.reduce<MealPlanEntry[]>((result, entry) => {
    if (typeof entry !== "object" || entry === null) return result;
    const value = entry as Partial<MealPlanEntry>;
    const title = typeof value.title === "string" ? value.title.trim() : "";
    if (!title) return result;

    const nextEntry: MealPlanEntry = {
      title,
      createdAt:
        typeof value.createdAt === "string"
          ? value.createdAt
          : new Date().toISOString(),
    };

    if (typeof value.note === "string" && value.note.trim()) {
      nextEntry.note = value.note.trim();
    }

    result.push(nextEntry);
    return result;
  }, []);
};

const normalizePlan = (data: unknown): MealPlanDoc => {
  const source =
    typeof data === "object" && data !== null
      ? (data as Partial<Record<MealKey, unknown>>)
      : {};

  return {
    breakfast: validEntries(source.breakfast),
    lunch: validEntries(source.lunch),
    dinner: validEntries(source.dinner),
    snacks: validEntries(source.snacks),
  };
};

const planSummary = (plan: MealPlanDoc) =>
  MEALS.reduce((total, meal) => total + (plan[meal]?.length || 0), 0);

const dateTitle = (dateKey: string) => {
  const today = todayDateKey();
  if (dateKey === today) return "Today";
  if (dateKey === shiftDateKey(today, 1)) return "Tomorrow";
  return formatDateKey(dateKey, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const Planner: React.FC = () => {
  const history = useHistory();
  const { uid, loading: profileLoading } = useProfile();
  const { getDocData, setDocData } = useDemoFirestore();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Record<string, MealPlanDoc>>({});
  const [adding, setAdding] = useState<{ date: string; meal: MealKey } | null>(
    null
  );
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    color?: string;
  }>({ open: false, message: "", color: "success" });

  const upcomingDates = useMemo(
    () =>
      Array.from({ length: HORIZON_DAYS }, (_, i) =>
        shiftDateKey(todayDateKey(), i)
      ),
    []
  );

  const savePlan = useCallback(
    async (dateKey: string, plan: MealPlanDoc) => {
      if (!uid) return;
      await setDocData(`users/${uid}/plans/${dateKey}`, plan, { merge: true });
    },
    [setDocData, uid]
  );

  const fetchPlans = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const entries = await Promise.all(
        upcomingDates.map(async (dateKey) => {
          const data = await getDocData(`users/${uid}/plans/${dateKey}`);
          return [dateKey, normalizePlan(data)] as const;
        })
      );
      setPlans(Object.fromEntries(entries));
    } catch (error) {
      console.error("Failed to load meal plans:", error);
      setToast({
        open: true,
        message: "Could not load meal plans.",
        color: "danger",
      });
      trackEvent("planner_load_error", {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [getDocData, uid, upcomingDates]);

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
    const current = plans[dateKey] ?? emptyPlan();
    const updated: MealPlanDoc = {
      ...current,
      [meal]: [...(current[meal] ?? []), entry],
    };

    setPlans((prev) => ({ ...prev, [dateKey]: updated }));
    try {
      await savePlan(dateKey, updated);
      setToast({
        open: true,
        message: `Added ${entry.title} to ${prettyMeal(meal)}.`,
        color: "success",
      });
      trackEvent("planner_add_entry", { dateKey, meal });
    } catch (error) {
      setPlans((prev) => ({ ...prev, [dateKey]: current }));
      setToast({
        open: true,
        message: "Could not save this planned meal.",
        color: "danger",
      });
      trackEvent("planner_add_error", {
        dateKey,
        meal,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const removeEntry = async (dateKey: string, meal: MealKey, idx: number) => {
    const current = plans[dateKey] ?? emptyPlan();
    const list = [...(current[meal] ?? [])];
    const [removed] = list.splice(idx, 1);
    const updated: MealPlanDoc = { ...current, [meal]: list };

    setPlans((prev) => ({ ...prev, [dateKey]: updated }));
    try {
      await savePlan(dateKey, updated);
      setToast({
        open: true,
        message: removed?.title ? `Removed ${removed.title}.` : "Removed item.",
        color: "medium",
      });
      trackEvent("planner_remove_entry", { dateKey, meal });
    } catch (error) {
      setPlans((prev) => ({ ...prev, [dateKey]: current }));
      setToast({
        open: true,
        message: "Could not remove this planned meal.",
        color: "danger",
      });
      trackEvent("planner_remove_error", {
        dateKey,
        meal,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openAddFood = (dateKey: string, meal: MealKey, title: string) => {
    const params = new URLSearchParams();
    params.set("meal", meal);
    params.set("date", dateKey);
    params.set("q", title);
    trackEvent("planner_log_entry", { dateKey, meal });
    history.push({
      pathname: "/add-food",
      search: `?${params.toString()}`,
    });
  };

  const totalPlannedItems = useMemo(
    () =>
      Object.values(plans).reduce(
        (total, plan) => total + planSummary(plan),
        0
      ),
    [plans]
  );
  const plannedDays = useMemo(
    () => Object.values(plans).filter((plan) => planSummary(plan) > 0).length,
    [plans]
  );
  const todayPlanCount = planSummary(plans[todayDateKey()] ?? emptyPlan());

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={SETTINGS_ROUTES.root} text="" />
          </IonButtons>
          <IonTitle>Meal Planner</IonTitle>
          <IonButtons slot="end">
            <IonButton
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
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="home-content tabbed-content">
        <div className="planner-content">
          <section className="planner-hero">
            <div>
              <p className="planner-eyebrow">Next {HORIZON_DAYS} days</p>
              <h1>Plan meals before the day gets busy.</h1>
              <p>
                Keep ideas separate from your diary, then search and log them
                when it is time to eat.
              </p>
            </div>
            <div className="planner-hero__stats" aria-label="Planner summary">
              <div>
                <strong>{totalPlannedItems}</strong>
                <span>planned items</span>
              </div>
              <div>
                <strong>{plannedDays}</strong>
                <span>days covered</span>
              </div>
              <div>
                <strong>{todayPlanCount}</strong>
                <span>today</span>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="planner-loading">
              <IonSpinner name="crescent" />
            </div>
          ) : (
            <IonAccordionGroup className="planner-accordion" multiple>
              {upcomingDates.map((dateKey) => {
                const plan = plans[dateKey] ?? emptyPlan();
                const itemCount = planSummary(plan);

                return (
                  <IonAccordion
                    value={dateKey}
                    key={dateKey}
                    className="planner-day"
                  >
                    <IonItem
                      slot="header"
                      lines="none"
                      className="planner-day-header"
                    >
                      <IonIcon slot="start" icon={calendarOutline} />
                      <IonLabel>
                        <div className="planner-date">{dateTitle(dateKey)}</div>
                        <IonNote color="medium">
                          {formatDateKey(dateKey)} · {itemCount} planned{" "}
                          {itemCount === 1 ? "item" : "items"}
                        </IonNote>
                      </IonLabel>
                      <IonBadge color={itemCount ? "tertiary" : "medium"}>
                        {itemCount}
                      </IonBadge>
                    </IonItem>

                    <div className="planner-day-content" slot="content">
                      <IonList lines="none" className="planner-meal-list">
                        {MEALS.map((meal) => {
                          const entries = plan[meal] || [];

                          return (
                            <IonCard key={meal} className="planner-meal-card">
                              <IonCardHeader>
                                <div className="planner-meal-card__header">
                                  <div>
                                    <IonCardTitle>
                                      {prettyMeal(meal)}
                                    </IonCardTitle>
                                    <IonCardSubtitle>
                                      {entries.length
                                        ? `${entries.length} planned`
                                        : "No plan yet"}
                                    </IonCardSubtitle>
                                  </div>
                                  <IonButton
                                    fill="outline"
                                    size="small"
                                    onClick={() => setAdding({ date: dateKey, meal })}
                                  >
                                    <IonIcon icon={addCircleOutline} slot="start" />
                                    Add
                                  </IonButton>
                                </div>
                              </IonCardHeader>

                              <IonCardContent>
                                {entries.length ? (
                                  <div className="planner-entry-list">
                                    {entries.map((entry, idx) => (
                                      <div
                                        key={`${entry.createdAt}-${idx}`}
                                        className="planner-entry"
                                      >
                                        <div>
                                          <h3>{entry.title}</h3>
                                          {entry.note && <p>{entry.note}</p>}
                                        </div>
                                        <div className="planner-entry__actions">
                                          <IonButton
                                            fill="clear"
                                            size="small"
                                            onClick={() =>
                                              openAddFood(dateKey, meal, entry.title)
                                            }
                                          >
                                            <IonIcon icon={searchOutline} slot="start" />
                                            Log
                                          </IonButton>
                                          <IonButton
                                            fill="clear"
                                            color="danger"
                                            size="small"
                                            aria-label={`Remove ${entry.title}`}
                                            onClick={() =>
                                              void removeEntry(dateKey, meal, idx)
                                            }
                                          >
                                            <IonIcon icon={trashOutline} slot="icon-only" />
                                          </IonButton>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="planner-empty-meal">
                                    Add a meal idea for {prettyMeal(meal)}.
                                  </div>
                                )}
                              </IonCardContent>
                            </IonCard>
                          );
                        })}
                      </IonList>
                    </div>
                  </IonAccordion>
                );
              })}
            </IonAccordionGroup>
          )}
        </div>

        <IonAlert
          isOpen={!!adding}
          header={adding ? `Add to ${prettyMeal(adding.meal)}` : "Add"}
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

        <IonToast
          isOpen={toast.open}
          message={toast.message}
          color={toast.color}
          duration={2200}
          onDidDismiss={() => setToast((prev) => ({ ...prev, open: false }))}
        />
      </IonContent>
    </IonPage>
  );
};

export default Planner;
