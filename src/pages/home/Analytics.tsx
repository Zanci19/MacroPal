import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSpinner,
  IonButton,
  IonRefresher,
  IonRefresherContent,
  type RefresherEventDetail,
  useIonViewDidEnter,
  useIonViewDidLeave,
} from "@ionic/react";

import { db, trackEvent } from "../../firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { useDemoFirestore } from "../../hooks/useDemoFirestore";

// Recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Area,
} from "recharts";

import type {
  MealKey,
  Macros,
  DiaryEntry,
  DayDiaryDoc,
  WeighInEntry,
  NutrientTotals,
} from "../../types";
import { useProfile } from "../../hooks/useProfile";
import { getChartAnimationPreference } from "../../utils/preferences";
import { useHistory } from "react-router";
import { fromMetricWeight, getUnitSystem, weightLabel } from "../../utils/units";
import { toDateKey } from "../../utils/date";
import { sumNutrients } from "../../utils/nutrients";
import NutrientBreakdown from "../../components/NutrientBreakdown";

import "./Analytics.css";

/* ============================
   Types / constants
   ============================ */
type TF = "7d" | "30d" | "60d";

const TF_DAYS: Record<TF, number> = { "7d": 7, "30d": 30, "60d": 60 };

const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

type DayRoll = {
  key: string;
  data: DayDiaryDoc;
  roll: {
    macros: Macros;
    byMeal: Record<MealKey, Macros>;
    items: DiaryEntry[];
  };
};

const fmtDate = (iso: string) => iso.slice(5); // MM-DD
const dayKey = (d: Date) => toDateKey(d);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const ChartContainer: React.FC<{
  height: number;
  enabled?: boolean;
  children: React.ReactElement;
}> = ({ height, enabled = true, children }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setWidth(0);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const nextWidth = Math.floor(el.clientWidth);
      setWidth(nextWidth > 0 ? nextWidth : 0);
    };

    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [enabled, height]);

  return (
    <div ref={containerRef} style={{ width: "100%", minWidth: 0, height, minHeight: height }}>
      {enabled && width > 0
        ? React.cloneElement(children, { width, height } as Record<string, number>)
        : null}
    </div>
  );
};

/* Sum per-day macros (c/p/f) from all meals */
function sumDay(doc: DayDiaryDoc) {
  const all: DiaryEntry[] = MEALS.flatMap((m) => doc[m] || []);
  const macros: Macros = all.reduce(
    (a, it) => ({
      calories: a.calories + (it.total?.calories || 0),
      carbs: a.carbs + (it.total?.carbs || 0),
      protein: a.protein + (it.total?.protein || 0),
      fat: a.fat + (it.total?.fat || 0),
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0 }
  );

  const byMeal = MEALS.reduce((acc, m) => {
    const arr = doc[m] || [];
    acc[m] = arr.reduce(
      (a, it) => ({
        calories: a.calories + (it.total?.calories || 0),
        carbs: a.carbs + (it.total?.carbs || 0),
        protein: a.protein + (it.total?.protein || 0),
        fat: a.fat + (it.total?.fat || 0),
      }),
      { calories: 0, carbs: 0, protein: 0, fat: 0 } as Macros
    );
    return acc;
  }, {} as Record<MealKey, Macros>);

  return { macros, byMeal, items: all };
}

function movingAvg(vals: number[], w: number) {
  const out: number[] = [];
  let s = 0;
  for (let i = 0; i < vals.length; i++) {
    s += vals[i];
    if (i >= w) s -= vals[i - w];
    out.push(i >= w - 1 ? Math.round(s / w) : NaN);
  }
  return out;
}

/* ============================
   Component
   ============================ */
const Analytics: React.FC = () => {
  const history = useHistory();
  const { uid, loading: authLoading, profile } = useProfile();
  const { isDemoMode, getDocData, getCollectionDocs } = useDemoFirestore();

  const [loading, setLoading] = useState(true); // loading for analytics data
  const [tf, setTf] = useState<TF>("30d");
  const [days, setDays] = useState<DayRoll[]>([]);
  // Track how many days have been fetched so we don't re-fetch smaller ranges
  const fetchedCountRef = useRef(0);
  const [weightEntries, setWeightEntries] = useState<WeighInEntry[]>([]);
  const [isViewActive, setIsViewActive] = useState(true);
  const unitSystem = getUnitSystem(profile?.units);
  const chartsEnabled = isViewActive;
  const [chartAnimationsEnabled, setChartAnimationsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    return getChartAnimationPreference() && !prefersReducedMotion;
  });

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled: boolean }>;
      const prefersReducedMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      setChartAnimationsEnabled(customEvent.detail.enabled && !prefersReducedMotion);
    };

    window.addEventListener("mp_chart_animation_change", handler);
    return () => {
      window.removeEventListener("mp_chart_animation_change", handler);
    };
  }, []);

  useIonViewDidEnter(() => {
    setIsViewActive(true);
  });

  useIonViewDidLeave(() => {
    setIsViewActive(false);
  });

  // Fetch the most recent `count` days of diary and weight data
  const fetchDays = useCallback(async (count: number) => {
    if (!uid) {
      setDays([]);
      setWeightEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const today = new Date();
      const keys = Array.from({ length: count }, (_, i) =>
        dayKey(addDays(today, -i))
      );
      
      // Fetch food entries - use demo firestore in demo mode
      let list: DayRoll[];
      if (isDemoMode) {
        const reads = keys.map((k) => getDocData(`users/${uid}/foods/${k}`));
        const results = await Promise.all(reads);
        list = results
          .map((raw, i) => {
            const data: DayDiaryDoc = {
              breakfast: (raw as Partial<DayDiaryDoc>)?.breakfast ?? [],
              lunch: (raw as Partial<DayDiaryDoc>)?.lunch ?? [],
              dinner: (raw as Partial<DayDiaryDoc>)?.dinner ?? [],
              snacks: (raw as Partial<DayDiaryDoc>)?.snacks ?? [],
            };
            return { key: keys[i], data, roll: sumDay(data) };
          })
          .reverse(); // oldest first
      } else {
        const reads = keys.map((k) => getDoc(doc(db, "users", uid, "foods", k)));
        const snaps = await Promise.all(reads);
        list = snaps
          .map((s, i) => {
            const raw = (s.data() || {}) as Partial<DayDiaryDoc>;
            const data: DayDiaryDoc = {
              breakfast: raw.breakfast ?? [],
              lunch: raw.lunch ?? [],
              dinner: raw.dinner ?? [],
              snacks: raw.snacks ?? [],
            };
            return { key: keys[i], data, roll: sumDay(data) };
          })
          .reverse(); // oldest first
      }

      // Fetch weight entries - use demo firestore in demo mode
      let weighList: WeighInEntry[];
      if (isDemoMode) {
        const weighDocs = await getCollectionDocs(`users/${uid}/weighins`);
        weighList = weighDocs
          .map((d) => {
            const data = d.data as Partial<WeighInEntry>;
            const date = typeof data.date === "string" ? data.date : d.id;
            const weight =
              typeof data.weight === "number" ? data.weight : Number(data.weight);
            if (!date || !Number.isFinite(weight)) return null;
            return { ...data, date, weight } as WeighInEntry;
          })
          .filter((entry): entry is WeighInEntry => !!entry)
          .sort((a, b) => a.date.localeCompare(b.date));
      } else {
        const weighSnap = await getDocs(
          collection(db, "users", uid, "weighins")
        );
        weighList = weighSnap.docs
          .map((d) => {
            const data = d.data() as Partial<WeighInEntry>;
            const date = typeof data.date === "string" ? data.date : d.id;
            const weight =
              typeof data.weight === "number" ? data.weight : Number(data.weight);
            if (!date || !Number.isFinite(weight)) return null;
            return { ...data, date, weight } as WeighInEntry;
          })
          .filter((entry): entry is WeighInEntry => !!entry)
          .sort((a, b) => a.date.localeCompare(b.date));
      }

      setDays(list);
      setWeightEntries(weighList);
      fetchedCountRef.current = count;
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      trackEvent("analytics_fetch_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, [uid, isDemoMode, getDocData, getCollectionDocs]);

  const handleRefresh = useCallback(
    async (event: CustomEvent<RefresherEventDetail>) => {
      console.log(`[USER ACTION] Analytics: Pull-to-refresh triggered`);
      try {
        trackEvent("analytics_refresh");
        const needed = TF_DAYS[tf];
        fetchedCountRef.current = 0; // force re-fetch
        await fetchDays(needed);
      } finally {
        event.detail.complete();
      }
    },
    [fetchDays, tf]
  );

  // Only fetch when switching to a larger timeframe than already cached
  useEffect(() => {
    if (authLoading) return;
    const needed = TF_DAYS[tf];
    if (fetchedCountRef.current >= needed) return;
    void fetchDays(needed);
  }, [authLoading, tf, fetchDays]);

  // timeframe slice
  const view = useMemo(() => {
    if (days.length === 0) return [];
    if (tf === "7d") return days.slice(-7);
    if (tf === "30d") return days.slice(-30);
    return days.slice(-60);
  }, [days, tf]);

  // Only days with any intake (ignore 0-kcal “empty” days)
  const nonEmptyView = useMemo(
    () =>
      view.filter((d) => {
        const m = d.roll.macros;
        return (
          m.calories > 0 || m.carbs > 0 || m.protein > 0 || m.fat > 0
        );
      }),
    [view]
  );

  // series
  const kcalSeries = useMemo(
    () => view.map((d) => Math.round(d.roll.macros.calories)),
    [view]
  );
  const kcalMA7 = useMemo(() => movingAvg(kcalSeries, 7), [kcalSeries]);

  const macroEnergyByDay = useMemo(
    () =>
      view.map((d) => ({
        date: fmtDate(d.key),
        carbsK: d.roll.macros.carbs * 4,
        proteinK: d.roll.macros.protein * 4,
        fatK: d.roll.macros.fat * 9,
      })),
    [view]
  );

  const dayTable = useMemo(
    () =>
      view.map((d) => ({
        date: d.key,
        calories: Math.round(d.roll.macros.calories),
        carbs: +d.roll.macros.carbs.toFixed(1),
        protein: +d.roll.macros.protein.toFixed(1),
        fat: +d.roll.macros.fat.toFixed(1),
      })),
    [view]
  );

  const nonEmptyDayTable = useMemo(
    () =>
      dayTable.filter(
        (d) =>
          d.calories > 0 || d.carbs > 0 || d.protein > 0 || d.fat > 0
      ),
    [dayTable]
  );

  const hasFoodData = useMemo(
    () => nonEmptyDayTable.length > 0,
    [nonEmptyDayTable]
  );
  const hasWeightData = weightEntries.length > 0;
  const hasAnyData = hasFoodData || hasWeightData;

  // macro totals and averages (only on non-empty days)
  const totals = useMemo(
    () =>
      nonEmptyDayTable.reduce(
        (a, x) => ({
          calories: a.calories + x.calories,
          carbs: a.carbs + x.carbs,
          protein: a.protein + x.protein,
          fat: a.fat + x.fat,
        }),
        { calories: 0, carbs: 0, protein: 0, fat: 0 } as Macros
      ),
    [nonEmptyDayTable]
  );

  const avg = useMemo(() => {
    const n = Math.max(1, nonEmptyDayTable.length || 0);
    return {
      calories: Math.round(totals.calories / n),
      carbs: +(totals.carbs / n).toFixed(1),
      protein: +(totals.protein / n).toFixed(1),
      fat: +(totals.fat / n).toFixed(1),
    };
  }, [totals, nonEmptyDayTable.length]);

  // Daily-average of the full nutrient set (extended macros + micronutrients)
  // across logged days, for the Average-day breakdown.
  const nutrientAvg = useMemo(() => {
    const dayCount = nonEmptyView.length;
    if (!dayCount) return null;
    const items = nonEmptyView.flatMap((d) => d.roll.items || []);
    const totalsBag = sumNutrients(items as Array<{ total?: NutrientTotals }>);
    const out: Record<string, number> = {};
    Object.entries(totalsBag).forEach(([k, v]) => {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v / dayCount;
    });
    return out;
  }, [nonEmptyView]);

  const caloriesTarget = useMemo(() => {
    if (!profile) return null;
    const stored = (profile as { caloriesTarget?: number }).caloriesTarget;
    if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
      return stored;
    }

    const { age, weight, height, gender, goal, activity } = profile;
    if (!age || !weight || !height || !gender) return null;

    const bmr =
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

  const macroTargets = useMemo(() => {
    if (!profile || caloriesTarget == null) return null;
    const stored = (profile as { macroTargets?: { proteinG?: number; fatG?: number; carbsG?: number } }).macroTargets;

    if (
      stored &&
      typeof stored.proteinG === "number" &&
      typeof stored.fatG === "number" &&
      typeof stored.carbsG === "number"
    ) {
      return {
        proteinG: stored.proteinG,
        fatG: stored.fatG,
        carbsG: stored.carbsG,
      };
    }

    const { weight } = profile;
    if (!weight) return null;

    const proteinG = Math.round(1.8 * weight);
    const proteinK = proteinG * 4;

    const fatByWeight = 0.8 * weight;
    const fatByPercent = (0.25 * caloriesTarget) / 9;
    const fatG = Math.round(Math.max(50, fatByWeight, fatByPercent));
    const fatK = fatG * 9;

    const carbsG = Math.round(
      Math.max(0, caloriesTarget - proteinK - fatK) / 4
    );

    return { proteinG, fatG, carbsG };
  }, [profile, caloriesTarget]);

  // macro donut data
  const macroDonut = useMemo(
    () => [
      { name: "Carbohydrates", value: totals.carbs * 4 },
      { name: "Protein", value: totals.protein * 4 },
      { name: "Fat", value: totals.fat * 9 },
    ],
    [totals]
  );

  // per-meal energy share
  const mealShare = useMemo(() => {
    const acc: Record<MealKey, number> = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snacks: 0,
    };
    view.forEach((d) =>
      MEALS.forEach((m) => {
        acc[m] += d.roll.byMeal[m].calories;
      })
    );
    return acc;
  }, [view]);

  const bestDay = useMemo(
    () =>
      nonEmptyView.length
        ? [...nonEmptyView].sort(
          (a, b) => b.roll.macros.calories - a.roll.macros.calories
        )[0]
        : null,
    [nonEmptyView]
  );
  const lowDay = useMemo(
    () =>
      nonEmptyView.length
        ? [...nonEmptyView].sort(
          (a, b) => a.roll.macros.calories - b.roll.macros.calories
        )[0]
        : null,
    [nonEmptyView]
  );

  const topFoods = useMemo(() => {
    const map = new Map<
      string,
      { name: string; brand?: string; calories: number; count: number }
    >();
    nonEmptyView.forEach((d) =>
      d.roll.items.forEach((it) => {
        const key = `${(it.name || "").toLowerCase()}|${(
          it.brand || ""
        ).toLowerCase()}`;
        const prev =
          map.get(key) || {
            name: it.name,
            brand: it.brand || undefined,
            calories: 0,
            count: 0,
          };
        prev.calories += it.total?.calories || 0;
        prev.count += 1;
        map.set(key, prev);
      })
    );
    return [...map.values()]
      .sort((a, b) => b.calories - a.calories)
      .slice(0, 10);
  }, [nonEmptyView]);

  const timeframeDays = TF_DAYS[tf];
  const weightView = useMemo(() => {
    if (!weightEntries.length) return [];
    const end = new Date();
    const start = addDays(end, -(timeframeDays - 1));
    const startKey = dayKey(start);
    const endKey = dayKey(end);
    return weightEntries
      .filter((entry) => entry.date >= startKey && entry.date <= endKey)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [weightEntries, timeframeDays]);

  const weightChartData = useMemo(
    () =>
      weightView.map((entry) => ({
        date: fmtDate(entry.date),
        weight:
          Math.round(fromMetricWeight(entry.weight, unitSystem) * 10) / 10,
      })),
    [weightView, unitSystem]
  );

  const latestWeight = weightView.length
    ? weightView[weightView.length - 1]
    : null;

  const viewDay = (date: string) => {
    console.log(`[USER ACTION] Analytics: View day button clicked`, { date });
    history.push(`/app/home?date=${date}`);
  };

  // Ordered so macro bars (Carbs=0, Protein=1, Fat=2) match the app's macro colors,
  // while still giving charts a cohesive, distinct set of hues.
  const palette = [
    "#f59e0b", // amber  — carbs
    "#2f6be0", // blue   — protein
    "#f43f5e", // rose   — fat
    "#10b981", // emerald
    "#8b5cf6", // violet
    "#64748b", // slate
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Analytics</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding tabbed-content" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingIcon="chevron-down-outline"
            refreshingSpinner="crescent"
          />
        </IonRefresher>

        {(authLoading || loading) && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {!authLoading && !loading && (
          <>
            {hasAnyData ? (
              <>
                {/* ── Controls bar ── */}
                <div className="an-controls">
                  <IonSegment
                    value={tf}
                    onIonChange={(e) => {
                      console.log(`[USER ACTION] Analytics: Time period segment changed`, { newValue: e.detail.value });
                      setTf((e.detail.value as TF) ?? "30d");
                    }}
                  >
                    <IonSegmentButton value="7d">
                      <IonLabel>7 days</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="30d">
                      <IonLabel>30 days</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="60d">
                      <IonLabel>60 days</IonLabel>
                    </IonSegmentButton>
                  </IonSegment>
                </div>

                {/* ── At-a-glance summary strip ── */}
                {hasFoodData && (
                  <div className="an-summary-strip">
                    <div className="an-summary-stat">
                      <span className="an-summary-stat__value">{avg.calories}</span>
                      <span className="an-summary-stat__label">Avg kcal</span>
                    </div>
                    <div className="an-summary-stat">
                      <span className="an-summary-stat__value">{nonEmptyDayTable.length}</span>
                      <span className="an-summary-stat__label">Days logged</span>
                    </div>
                    <div className="an-summary-stat">
                      <span className="an-summary-stat__value">
                        {Math.round(totals.calories / 1000)}k
                      </span>
                      <span className="an-summary-stat__label">Total kcal</span>
                    </div>
                    {caloriesTarget != null && (
                      <div className="an-summary-stat">
                        <span
                          className="an-summary-stat__value"
                          style={{
                            color: avg.calories > caloriesTarget ? "var(--ion-color-danger)" : "var(--ion-color-success)",
                          }}
                        >
                          {avg.calories > caloriesTarget ? "+" : ""}
                          {avg.calories - caloriesTarget}
                        </span>
                        <span className="an-summary-stat__label">vs goal</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Body (weight) ── */}
                {hasWeightData && (
                  <>
                    <div className="an-section-label">Body</div>
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">Weigh-ins</IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          {latestWeight
                            ? `Latest: ${
                                Math.round(
                                  fromMetricWeight(latestWeight.weight, unitSystem) * 10
                                ) / 10
                              } ${weightLabel(unitSystem)} · ${latestWeight.date}`
                            : `No entries in the last ${tf}`}
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        {weightChartData.length ? (
                          <ChartContainer height={220} enabled={chartsEnabled}>
                            <LineChart data={weightChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--mp-border)" />
                              <XAxis
                                dataKey="date"
                                tick={{ fill: "var(--mp-text-muted)", fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fill: "var(--mp-text-muted)", fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                contentStyle={{
                                  background: "var(--mp-surface)",
                                  border: "1px solid var(--mp-border)",
                                  borderRadius: 8,
                                  color: "var(--mp-text)",
                                  fontSize: 12,
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="weight"
                                name={`Weight (${weightLabel(unitSystem)})`}
                                stroke={palette[4]}
                                dot={false}
                                strokeWidth={2}
                                isAnimationActive={chartAnimationsEnabled}
                              />
                            </LineChart>
                          </ChartContainer>
                        ) : (
                          <div style={{ fontSize: 14, color: "var(--mp-text-muted)" }}>
                            No weigh-ins in this range yet. Log one from Home to see it here.
                          </div>
                        )}
                      </IonCardContent>
                    </IonCard>
                  </>
                )}

                {hasFoodData ? (
                  <>
                    {/* ── Overview ── */}
                    <div className="an-section-label">Overview</div>
                    <IonGrid>
                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">Average day</IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                {avg.calories} kcal · {nonEmptyDayTable.length} days logged
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              {(() => {
                                const total = (avg.carbs + avg.protein + avg.fat) || 1;
                                return (
                                  <div className="an-macro-bars">
                                    {[
                                      { label: "Carbs", value: avg.carbs, color: palette[0] },
                                      { label: "Protein", value: avg.protein, color: palette[1] },
                                      { label: "Fat", value: avg.fat, color: palette[2] },
                                    ].map((m) => (
                                      <div key={m.label} className="an-macro-bar__row">
                                        <span className="an-macro-bar__label">{m.label}</span>
                                        <div className="an-macro-bar__track">
                                          <div
                                            className="an-macro-bar__fill"
                                            style={{
                                              width: `${(m.value / total) * 100}%`,
                                              background: m.color,
                                            }}
                                          />
                                        </div>
                                        <span className="an-macro-bar__value">
                                          {m.value.toFixed(0)} g
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                              {nutrientAvg && (
                                <div className="an-nutrient-breakdown">
                                  <NutrientBreakdown
                                    totals={nutrientAvg}
                                    subtitle={`Daily average · ${nonEmptyView.length} days`}
                                  />
                                </div>
                              )}
                            </IonCardContent>
                          </IonCard>
                        </IonCol>

                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Calories by meal
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                Share across the last {tf}
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              <ChartContainer height={200} enabled={chartsEnabled}>
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: "Breakfast", value: mealShare.breakfast },
                                      { name: "Lunch", value: mealShare.lunch },
                                      { name: "Dinner", value: mealShare.dinner },
                                      { name: "Snacks", value: mealShare.snacks },
                                    ]}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={54}
                                    outerRadius={86}
                                    paddingAngle={2}
                                    cx="50%"
                                    cy="50%"
                                    isAnimationActive={chartAnimationsEnabled}
                                  >
                                    {["Breakfast", "Lunch", "Dinner", "Snacks"].map((_, i) => (
                                      <Cell key={i} fill={palette[i % palette.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{
                                      background: "var(--mp-surface)",
                                      border: "1px solid var(--mp-border)",
                                      borderRadius: 8,
                                      color: "var(--mp-text)",
                                      fontSize: 12,
                                    }}
                                    itemStyle={{ color: "var(--mp-text)" }}
                                    labelStyle={{ color: "var(--mp-text)" }}
                                  />
                                </PieChart>
                              </ChartContainer>
                              <div className="an-legend">
                                {[
                                  { label: "Breakfast", color: palette[0] },
                                  { label: "Lunch", color: palette[1] },
                                  { label: "Dinner", color: palette[2] },
                                  { label: "Snacks", color: palette[3] },
                                ].map((it) => (
                                  <div key={it.label} className="an-legend__item">
                                    <span
                                      className="an-legend__dot"
                                      style={{ background: it.color }}
                                    />
                                    <span>{it.label}</span>
                                  </div>
                                ))}
                              </div>
                            </IonCardContent>
                          </IonCard>
                        </IonCol>
                      </IonRow>
                    </IonGrid>

                    {/* ── Trends ── */}
                    <div className="an-section-label">Trends</div>

                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">Calories over time</IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Daily intake and 7-day moving average
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <ChartContainer height={260} enabled={chartsEnabled}>
                          <ComposedChart
                            data={view.map((d, i) => ({
                              date: fmtDate(d.key),
                              kcal: kcalSeries[i],
                              ma7: isNaN(kcalMA7[i]) ? null : kcalMA7[i],
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--mp-border)" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "var(--mp-text-muted)", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: "var(--mp-text-muted)", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "var(--mp-surface)",
                                border: "1px solid var(--mp-border)",
                                borderRadius: 8,
                                color: "var(--mp-text)",
                                fontSize: 12,
                              }}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: 12, color: "var(--mp-text-muted)" }}
                            />
                            <Area
                              type="monotone"
                              dataKey="kcal"
                              name="Calories"
                              fill={palette[0]}
                              stroke={palette[0]}
                              opacity={0.25}
                              isAnimationActive={chartAnimationsEnabled}
                            />
                            <Line
                              type="monotone"
                              dataKey="ma7"
                              name="MA7"
                              stroke={palette[1]}
                              dot={false}
                              strokeWidth={2}
                              isAnimationActive={chartAnimationsEnabled}
                            />
                          </ComposedChart>
                        </ChartContainer>
                      </IonCardContent>
                    </IonCard>

                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">Macro energy split</IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Carbohydrates, protein and fat as kcal per day
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <ChartContainer height={240} enabled={chartsEnabled}>
                          <BarChart data={macroEnergyByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--mp-border)" />
                            <XAxis
                              dataKey="date"
                              tick={{ fill: "var(--mp-text-muted)", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: "var(--mp-text-muted)", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "var(--mp-surface)",
                                border: "1px solid var(--mp-border)",
                                borderRadius: 8,
                                color: "var(--mp-text)",
                                fontSize: 12,
                              }}
                            />
                            <Legend
                              wrapperStyle={{ fontSize: 12, color: "var(--mp-text-muted)" }}
                            />
                            <Bar
                              dataKey="carbsK"
                              stackId="a"
                              name="Carbs kcal"
                              fill={palette[0]}
                              isAnimationActive={chartAnimationsEnabled}
                            />
                            <Bar
                              dataKey="proteinK"
                              stackId="a"
                              name="Protein kcal"
                              fill={palette[1]}
                              isAnimationActive={chartAnimationsEnabled}
                            />
                            <Bar
                              dataKey="fatK"
                              stackId="a"
                              name="Fat kcal"
                              fill={palette[2]}
                              isAnimationActive={chartAnimationsEnabled}
                            />
                          </BarChart>
                        </ChartContainer>
                      </IonCardContent>
                    </IonCard>

                    {/* ── Macro Analysis ── */}
                    <div className="an-section-label">Macro Analysis</div>

                    <IonGrid>
                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Macro energy ratio
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                Share of total kcal from each macro
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              <ChartContainer height={200} enabled={chartsEnabled}>
                                <PieChart>
                                  <Pie
                                    data={macroDonut}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={54}
                                    outerRadius={86}
                                    paddingAngle={1}
                                    cx="50%"
                                    cy="50%"
                                    isAnimationActive={chartAnimationsEnabled}
                                  >
                                    {macroDonut.map((_, i) => (
                                      <Cell key={i} fill={palette[i % palette.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{
                                      background: "var(--mp-surface)",
                                      border: "1px solid var(--mp-border)",
                                      borderRadius: 8,
                                      color: "var(--mp-text)",
                                      fontSize: 12,
                                    }}
                                    itemStyle={{ color: "var(--mp-text)" }}
                                    labelStyle={{ color: "var(--mp-text)" }}
                                  />
                                </PieChart>
                              </ChartContainer>
                              <div className="an-legend">
                                {[
                                  { label: "Carbohydrates", color: palette[0] },
                                  { label: "Protein", color: palette[1] },
                                  { label: "Fat", color: palette[2] },
                                ].map((it) => (
                                  <div key={it.label} className="an-legend__item">
                                    <span
                                      className="an-legend__dot"
                                      style={{ background: it.color }}
                                    />
                                    <span>{it.label}</span>
                                  </div>
                                ))}
                              </div>
                            </IonCardContent>
                          </IonCard>
                        </IonCol>

                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Macro gram profile
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                Average daily grams across timeframe
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              <ChartContainer height={200} enabled={chartsEnabled}>
                                <RadarChart
                                  data={[
                                    { metric: "Carbohydrates", g: avg.carbs },
                                    { metric: "Protein", g: avg.protein },
                                    { metric: "Fat", g: avg.fat },
                                  ]}
                                >
                                  <PolarGrid stroke="var(--mp-border)" />
                                  <PolarAngleAxis
                                    dataKey="metric"
                                    tick={{ fill: "var(--mp-text-muted)", fontSize: 11 }}
                                  />
                                  <PolarRadiusAxis
                                    tick={{ fill: "var(--mp-text-muted)", fontSize: 10 }}
                                  />
                                  <Radar
                                    name="Avg g"
                                    dataKey="g"
                                    stroke={palette[0]}
                                    fill={palette[0]}
                                    fillOpacity={0.35}
                                    isAnimationActive={chartAnimationsEnabled}
                                  />
                                  <Tooltip
                                    contentStyle={{
                                      background: "var(--mp-surface)",
                                      border: "1px solid var(--mp-border)",
                                      borderRadius: 8,
                                      color: "var(--mp-text)",
                                      fontSize: 12,
                                    }}
                                  />
                                </RadarChart>
                              </ChartContainer>
                            </IonCardContent>
                          </IonCard>
                        </IonCol>
                      </IonRow>
                    </IonGrid>

                    {/* ── Goals ── */}
                    <div className="an-section-label">Goals</div>

                    <IonGrid>
                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Calorie target
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                {caloriesTarget
                                  ? `${avg.calories} kcal avg vs ${caloriesTarget} kcal goal`
                                  : "Set a calorie goal in your profile"}
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              {caloriesTarget ? (
                                <div className="an-goal-wrap">
                                  <div className="an-goal-percent">
                                    {Math.round((avg.calories / caloriesTarget) * 100)}%
                                  </div>
                                  <div className="an-goal-bar__track">
                                    <div
                                      className="an-goal-bar__fill"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          (avg.calories / caloriesTarget) * 100
                                        )}%`,
                                        background:
                                          avg.calories > caloriesTarget
                                            ? "var(--ion-color-danger)"
                                            : palette[0],
                                      }}
                                    />
                                  </div>
                                  <div className="an-goal-bar__meta">
                                    <span className="an-goal-bar__label">0</span>
                                    <span
                                      className="an-goal-bar__value"
                                      style={{
                                        color:
                                          avg.calories > caloriesTarget
                                            ? "var(--ion-color-danger)"
                                            : "var(--ion-color-success)",
                                      }}
                                    >
                                      {avg.calories > caloriesTarget
                                        ? `+${avg.calories - caloriesTarget} over goal`
                                        : `${caloriesTarget - avg.calories} under goal`}
                                    </span>
                                    <span className="an-goal-bar__label">
                                      {caloriesTarget}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ fontSize: 14, color: "var(--mp-text-muted)" }}>
                                  Set a calorie target in your profile to see it here.
                                </div>
                              )}
                            </IonCardContent>
                          </IonCard>
                        </IonCol>

                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Macro targets
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                Average daily intake vs goals
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              {macroTargets ? (
                                <div className="an-macro-bars">
                                  {[
                                    {
                                      label: "Carbs",
                                      avg: Math.round(avg.carbs),
                                      target: macroTargets.carbsG,
                                      color: palette[0],
                                    },
                                    {
                                      label: "Protein",
                                      avg: Math.round(avg.protein),
                                      target: macroTargets.proteinG,
                                      color: palette[1],
                                    },
                                    {
                                      label: "Fat",
                                      avg: Math.round(avg.fat),
                                      target: macroTargets.fatG,
                                      color: palette[2],
                                    },
                                  ].map((m) => (
                                    <div key={m.label}>
                                      <div className="an-goal-macro__header">
                                        <span className="an-goal-macro__name">{m.label}</span>
                                        <span
                                          className="an-goal-macro__stat"
                                          style={{
                                            color:
                                              m.avg > m.target ? "var(--ion-color-danger)" : "var(--mp-text)",
                                          }}
                                        >
                                          {m.avg} / {m.target} g
                                        </span>
                                      </div>
                                      <div className="an-macro-bar__track">
                                        <div
                                          className="an-macro-bar__fill"
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              m.target ? (m.avg / m.target) * 100 : 0
                                            )}%`,
                                            background:
                                              m.avg > m.target ? "var(--ion-color-danger)" : m.color,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: 14, color: "var(--mp-text-muted)" }}>
                                  Set macro targets in your profile to see them here.
                                </div>
                              )}
                            </IonCardContent>
                          </IonCard>
                        </IonCol>
                      </IonRow>
                    </IonGrid>

                    {/* ── Performance ── */}
                    <div className="an-section-label">Performance</div>

                    <IonGrid>
                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Highest intake
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                {bestDay
                                  ? `${bestDay.key} · ${Math.round(
                                      bestDay.roll.macros.calories
                                    )} kcal`
                                  : "—"}
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              {bestDay ? (
                                <div className="an-stat-grid">
                                  <div className="an-stat-cell">
                                    <div
                                      className="an-stat-cell__value"
                                      style={{ color: palette[0] }}
                                    >
                                      {bestDay.roll.macros.carbs.toFixed(0)}
                                    </div>
                                    <div className="an-stat-cell__label">Carbs g</div>
                                  </div>
                                  <div className="an-stat-cell">
                                    <div
                                      className="an-stat-cell__value"
                                      style={{ color: palette[1] }}
                                    >
                                      {bestDay.roll.macros.protein.toFixed(0)}
                                    </div>
                                    <div className="an-stat-cell__label">Protein g</div>
                                  </div>
                                  <div className="an-stat-cell">
                                    <div
                                      className="an-stat-cell__value"
                                      style={{ color: palette[2] }}
                                    >
                                      {bestDay.roll.macros.fat.toFixed(0)}
                                    </div>
                                    <div className="an-stat-cell__label">Fat g</div>
                                  </div>
                                </div>
                              ) : (
                                "—"
                              )}
                            </IonCardContent>
                          </IonCard>
                        </IonCol>

                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Lowest intake
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                {lowDay
                                  ? `${lowDay.key} · ${Math.round(
                                      lowDay.roll.macros.calories
                                    )} kcal`
                                  : "—"}
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              {lowDay ? (
                                <div className="an-stat-grid">
                                  <div className="an-stat-cell">
                                    <div
                                      className="an-stat-cell__value"
                                      style={{ color: palette[0] }}
                                    >
                                      {lowDay.roll.macros.carbs.toFixed(0)}
                                    </div>
                                    <div className="an-stat-cell__label">Carbs g</div>
                                  </div>
                                  <div className="an-stat-cell">
                                    <div
                                      className="an-stat-cell__value"
                                      style={{ color: palette[1] }}
                                    >
                                      {lowDay.roll.macros.protein.toFixed(0)}
                                    </div>
                                    <div className="an-stat-cell__label">Protein g</div>
                                  </div>
                                  <div className="an-stat-cell">
                                    <div
                                      className="an-stat-cell__value"
                                      style={{ color: palette[2] }}
                                    >
                                      {lowDay.roll.macros.fat.toFixed(0)}
                                    </div>
                                    <div className="an-stat-cell__label">Fat g</div>
                                  </div>
                                </div>
                              ) : (
                                "—"
                              )}
                            </IonCardContent>
                          </IonCard>
                        </IonCol>
                      </IonRow>
                    </IonGrid>

                    {/* ── History ── */}
                    <div className="an-section-label">History</div>

                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">
                          Top foods by calories
                        </IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Most-consumed across the last {tf}
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <div className="an-foods-header">
                          <div>#</div>
                          <div>Food</div>
                          <div>Calories</div>
                          <div>Logs</div>
                        </div>
                        {topFoods.map((f, i) => (
                          <div key={i} className="an-foods-row">
                            <div className="an-foods-rank">{i + 1}</div>
                            <div>
                              <div className="an-foods-name">{f.name}</div>
                              {f.brand && (
                                <div className="an-foods-brand">{f.brand}</div>
                              )}
                            </div>
                            <div className="an-foods-kcal">{Math.round(f.calories)}</div>
                            <div className="an-foods-count">{f.count}×</div>
                          </div>
                        ))}
                      </IonCardContent>
                    </IonCard>

                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">Daily log</IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          All logged days in the selected range
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        {nonEmptyDayTable.map((d) => (
                          <div key={d.date} className="an-day-row">
                            <span className="an-day-row__date">{d.date.slice(5)}</span>
                            <div className="an-day-row__pills">
                              <span className="an-day-pill an-day-pill--kcal">
                                {d.calories} kcal
                              </span>
                              <span className="an-day-pill">C {d.carbs.toFixed(0)}</span>
                              <span className="an-day-pill">P {d.protein.toFixed(0)}</span>
                              <span className="an-day-pill">F {d.fat.toFixed(0)}</span>
                            </div>
                            <IonButton
                              size="small"
                              fill="outline"
                              onClick={() => {
                                console.log(
                                  `[USER ACTION] Analytics: View day button clicked (from list)`,
                                  { date: d.date }
                                );
                                viewDay(d.date);
                              }}
                            >
                              View
                            </IonButton>
                          </div>
                        ))}
                      </IonCardContent>
                    </IonCard>
                  </>
                ) : (
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle className="mp-card-title">Nutrition insights</IonCardTitle>
                      <IonCardSubtitle className="mp-card-subtitle">
                        Log meals to unlock calorie and macro analytics.
                      </IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      Add some meals in Home to see calorie trends, macro splits, and top
                      foods here.
                    </IonCardContent>
                  </IonCard>
                )}
              </>
            ) : (
              <div className="an-empty">
                <div className="an-empty__emoji">📊</div>
                <p className="an-empty__title">No analytics yet</p>
                <p className="an-empty__subtitle">
                  Start logging meals in Home to unlock your nutrition insights.
                </p>
              </div>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Analytics;
