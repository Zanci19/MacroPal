import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  IonIcon,
  IonChip,
  IonActionSheet,
} from "@ionic/react";
import { shareOrDownload } from "../../utils/exportUtils";
import {
  downloadOutline,
  barChartOutline,
  pieChartOutline,
  trendingUpOutline,
  timeOutline,
  analyticsOutline,
  medalOutline,
  refreshOutline,
} from "ionicons/icons";

import { db, trackEvent } from "../../firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

// Recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
} from "../../types";
import { useProfile } from "../../hooks/useProfile";
import { getChartAnimationPreference } from "../../utils/preferences";
import { useHistory } from "react-router";
import { fromMetricWeight, getUnitSystem, weightLabel } from "../../utils/units";

import "./Analytics.css";

/* ============================
   Types / constants
   ============================ */
type TF = "7d" | "30d" | "60d";

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
const dayKey = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
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

  const [loading, setLoading] = useState(true); // loading for analytics data
  const [tf, setTf] = useState<TF>("30d");
  const [days, setDays] = useState<DayRoll[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeighInEntry[]>([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const unitSystem = getUnitSystem(profile?.units);
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

  // Fetch last 60 days whenever we have a uid and auth has settled
  const fetchDays = useCallback(async () => {
    if (!uid) {
      setDays([]);
      setWeightEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const today = new Date();
      const keys = Array.from({ length: 60 }, (_, i) =>
        dayKey(addDays(today, -i))
      );
      const reads = keys.map((k) => getDoc(doc(db, "users", uid, "foods", k)));
      const snaps = await Promise.all(reads);

      const list: DayRoll[] = snaps
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

      const weighSnap = await getDocs(
        collection(db, "users", uid, "weighins")
      );
      const weighList = weighSnap.docs
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

      setDays(list);
      setWeightEntries(weighList);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!authLoading) {
      void fetchDays();
    }
  }, [authLoading, fetchDays]);

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

  const timeframeDays = tf === "7d" ? 7 : tf === "30d" ? 30 : 60;
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
    history.push(`/app/home?date=${date}`);
  };

  // export
  const buildPdf = (content: string) => {
    const escaped = content
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    const lines = escaped.split("\n");
    const textBlock = lines
      .map((line, idx) => `${idx === 0 ? "" : "T* "}(${line}) Tj`)
      .join("\n");

    const objects: string[] = [];
    objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
    objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
    objects.push(
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj"
    );
    objects.push(
      `4 0 obj << /Length ${textBlock.length + 63} >> stream\nBT\n/F1 12 Tf\n72 760 Td\n14 TL\n${textBlock}\nET\nendstream\nendobj`
    );
    objects.push(
      "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj"
    );

    let offset = 0;
    const xref = ["0000000000 65535 f "];
    const body = objects
      .map((obj) => {
        const entry = `${offset}`.padStart(10, "0") + " 00000 n ";
        xref.push(entry);
        const chunk = `${obj}\n`;
        offset += chunk.length;
        return chunk;
      })
      .join("");

    const xrefOffset = offset;
    const xrefTable = `xref\n0 ${xref.length}\n${xref.join("\n")}\n`;
    const trailer = `trailer << /Size ${xref.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return `%PDF-1.4\n${body}${xrefTable}${trailer}`;
  };

  const exportPDF = async () => {
    const header = `MacroPal Summary (${tf})`;
    const rows = dayTable.map(
      (r) =>
        `${r.date} | ${r.calories} kcal | C ${r.carbs} g | P ${r.protein} g | F ${r.fat} g`
    );
    const footer = `Totals: ${totals.calories} kcal | C ${totals.carbs.toFixed(
      1
    )} g | P ${totals.protein.toFixed(1)} g | F ${totals.fat.toFixed(1)} g`;
    const content = [header, "", ...rows, "", footer].join("\n");
    const pdfText = buildPdf(content);
    const blob = new Blob([pdfText], { type: "application/pdf" });
    const fileName = `macropal_${tf}_summary.pdf`;
    const file = new File([blob], fileName, { type: "application/pdf" });
    await shareOrDownload(file, fileName);
  };

  const exportJSON = async () => {
    const payload = { timeframe: tf, days: dayTable, totals, avg };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const fileName = `macropal_${tf}_summary.json`;
    const file = new File([blob], fileName, { type: "application/json" });
    await shareOrDownload(file, fileName);
  };

  const exportCSV = async () => {
    const header = ["Date", "Calories", "Carbs (g)", "Protein (g)", "Fat (g)"];
    const rows = dayTable.map((row) => [
      row.date,
      row.calories,
      row.carbs,
      row.protein,
      row.fat,
    ]);
    rows.push(["Totals", totals.calories, totals.carbs, totals.protein, totals.fat]);
    rows.push(["Average", avg.calories, avg.carbs, avg.protein, avg.fat]);

    const escapeCell = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const fileName = `macropal_${tf}_summary.csv`;
    const file = new File([blob], fileName, { type: "text/csv" });
    await shareOrDownload(file, fileName);
  };

  const palette = [
    "#3b82f6",
    "#22c55e",
    "#eab308",
    "#ef4444",
    "#a855f7",
    "#64748b",
  ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Analytics</IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            color="medium"
            aria-label="Refresh analytics"
            onClick={() => {
              trackEvent("analytics_refresh");
              void fetchDays();
            }}
          >
            <IonIcon icon={refreshOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding tabbed-content" fullscreen>
        {(authLoading || loading) && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {!authLoading && !loading && (
          <>
            {hasAnyData ? (
              <>
                {/* Controls */}
                <IonGrid>
                  <IonRow className="ion-align-items-center">
                    <IonCol size="12" sizeMd="7">
                      <IonSegment
                        value={tf}
                        onIonChange={(e) =>
                          setTf((e.detail.value as TF) ?? "30d")
                        }
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
                    </IonCol>
                    <IonCol
                      size="12"
                      sizeMd="5"
                      className="ion-text-right ion-padding-top"
                    >
                      <IonButton
                        fill="outline"
                        style={{ marginBottom: 8 }}
                        disabled={!hasFoodData}
                        onClick={() => setExportMenuOpen(true)}
                      >
                        <IonIcon icon={downloadOutline} slot="start" />
                        Export
                      </IonButton>
                    </IonCol>
                  </IonRow>
                </IonGrid>

                {hasWeightData && (
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle className="mp-card-title">
                        Weigh-ins
                        <IonChip color="medium" style={{ marginLeft: 8 }}>
                          <IonIcon icon={timeOutline} />
                          &nbsp;{tf}
                        </IonChip>
                      </IonCardTitle>
                      <IonCardSubtitle className="mp-card-subtitle">
                        {latestWeight
                          ? `Latest ${
                              Math.round(
                                fromMetricWeight(latestWeight.weight, unitSystem) *
                                  10
                              ) / 10
                            } ${weightLabel(unitSystem)} on ${latestWeight.date}`
                          : "Track your weight trend over time."}
                      </IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {weightChartData.length ? (
                        <div style={{ width: "100%", height: 260 }}>
                          <ResponsiveContainer>
                            <LineChart data={weightChartData}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
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
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, opacity: 0.75 }}>
                          No weigh-ins in this range yet. Log one from Home to see it
                          here.
                        </div>
                      )}
                    </IonCardContent>
                  </IonCard>
                )}

                {hasFoodData ? (
                  <>
                    {/* Overview cards */}
                    <IonGrid>
                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Average day
                                <IonChip color="success" style={{ marginLeft: 8 }}>
                                  <IonIcon icon={trendingUpOutline} />
                                  &nbsp;{avg.calories} kcal
                                </IonChip>
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                Across the selected range
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              <div>Carbohydrates: {avg.carbs.toFixed(0)} g</div>
                              <div>Protein: {avg.protein.toFixed(0)} g</div>
                              <div>Fat: {avg.fat.toFixed(0)} g</div>
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
                                Aggregate share
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              <div style={{ width: "100%", height: 260 }}>
                                <ResponsiveContainer>
                                  <PieChart>
                                    <Pie
                                      data={[
                                        {
                                          name: "Breakfast",
                                          value: mealShare.breakfast,
                                        },
                                        { name: "Lunch", value: mealShare.lunch },
                                        { name: "Dinner", value: mealShare.dinner },
                                        { name: "Snacks", value: mealShare.snacks },
                                      ]}
                                      dataKey="value"
                                      nameKey="name"
                                      innerRadius={58}
                                      outerRadius={96}
                                      paddingAngle={2}
                                      cx="50%"
                                      cy="50%"
                                      isAnimationActive={chartAnimationsEnabled}
                                    >
                                      {["Breakfast", "Lunch", "Dinner", "Snacks"].map(
                                        (_, i) => (
                                          <Cell
                                            key={i}
                                            fill={palette[i % palette.length]}
                                          />
                                        )
                                      )}
                                    </Pie>
                                    <Tooltip />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>

                              {/* Custom legend below chart */}
                              <div
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  justifyContent: "center",
                                  flexWrap: "wrap",
                                  marginTop: 8,
                                  fontSize: 12,
                                }}
                              >
                                {[
                                  { label: "Breakfast", color: palette[0] },
                                  { label: "Lunch", color: palette[1] },
                                  { label: "Dinner", color: palette[2] },
                                  { label: "Snacks", color: palette[3] },
                                ].map((it) => (
                                  <div
                                    key={it.label}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        background: it.color,
                                      }}
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

                    {/* Calories trend + MA7 */}
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">
                          Calories trend
                          <IonChip color="medium" style={{ marginLeft: 8 }}>
                            <IonIcon icon={timeOutline} />
                            &nbsp;{tf}
                          </IonChip>
                        </IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Daily calories and 7-day moving average
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <div style={{ width: "100%", height: 300 }}>
                          <ResponsiveContainer>
                            <ComposedChart
                              data={view.map((d, i) => ({
                                date: fmtDate(d.key),
                                kcal: kcalSeries[i],
                                ma7: isNaN(kcalMA7[i]) ? null : kcalMA7[i],
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
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
                          </ResponsiveContainer>
                        </div>
                      </IonCardContent>
                    </IonCard>

                    {/* Macro energy stacked bars */}
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">
                          Macro energy split
                          <IonChip color="tertiary" style={{ marginLeft: 8 }}>
                            <IonIcon icon={barChartOutline} />
                            &nbsp;kcal by day
                          </IonChip>
                        </IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Carbohydrates, protein, fat as kcal
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <div style={{ width: "100%", height: 260 }}>
                          <ResponsiveContainer>
                            <BarChart data={macroEnergyByDay}>
                              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                              <XAxis dataKey="date" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar
                                dataKey="carbsK"
                                stackId="a"
                                name="Carbohydrates kcal"
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
                          </ResponsiveContainer>
                        </div>
                      </IonCardContent>
                    </IonCard>

                    {/* Macro ratio donut and radar vs averages */}
                    <IonGrid>
                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Macro energy ratio
                                <IonChip color="primary" style={{ marginLeft: 8 }}>
                                  <IonIcon icon={pieChartOutline} />
                                  &nbsp;Total mix
                                </IonChip>
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                Share of kcal from macros
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              <div style={{ width: "100%", height: 260 }}>
                                <ResponsiveContainer>
                                  <PieChart>
                                    <Pie
                                      data={macroDonut}
                                      dataKey="value"
                                      nameKey="name"
                                      innerRadius={58}
                                      outerRadius={96}
                                      paddingAngle={1}
                                      cx="50%"
                                      cy="50%"
                                      isAnimationActive={chartAnimationsEnabled}
                                    >
                                      {macroDonut.map((_, i) => (
                                        <Cell
                                          key={i}
                                          fill={palette[i % palette.length]}
                                        />
                                      ))}
                                    </Pie>
                                    <Tooltip />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>

                              {/* Custom legend below chart */}
                              <div
                                style={{
                                  display: "flex",
                                  gap: 12,
                                  justifyContent: "center",
                                  flexWrap: "wrap",
                                  marginTop: 8,
                                  fontSize: 12,
                                }}
                              >
                                {[
                                  { label: "Carbohydrates", color: palette[0] },
                                  { label: "Protein", color: palette[1] },
                                  { label: "Fat", color: palette[2] },
                                ].map((it) => (
                                  <div
                                    key={it.label}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        background: it.color,
                                      }}
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
                                Macro grams vs average
                                <IonChip color="success" style={{ marginLeft: 8 }}>
                                  <IonIcon icon={analyticsOutline} />
                                  &nbsp;Radar
                                </IonChip>
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                Average daily grams across timeframe
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              <div style={{ width: "100%", height: 260 }}>
                                <ResponsiveContainer>
                                  <RadarChart
                                    data={[
                                      { metric: "Carbohydrates", g: avg.carbs },
                                      { metric: "Protein", g: avg.protein },
                                      { metric: "Fat", g: avg.fat },
                                    ]}
                                  >
                                    <PolarGrid />
                                    <PolarAngleAxis dataKey="metric" />
                                    <PolarRadiusAxis />
                                    <Radar
                                      name="Avg g"
                                      dataKey="g"
                                      stroke={palette[0]}
                                      fill={palette[0]}
                                      fillOpacity={0.35}
                                      isAnimationActive={chartAnimationsEnabled}
                                    />
                                    <Legend />
                                    <Tooltip />
                                  </RadarChart>
                                </ResponsiveContainer>
                              </div>
                            </IonCardContent>
                          </IonCard>
                        </IonCol>
                      </IonRow>
                    </IonGrid>

                    {/* Calorie target */}
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">
                          Calorie target
                          <IonChip color="tertiary" style={{ marginLeft: 8 }}>
                            <IonIcon icon={barChartOutline} />
                            &nbsp;Goal
                          </IonChip>
                        </IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Current average vs target
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        {caloriesTarget ? (
                          <div style={{ width: "100%", height: 220 }}>
                            <ResponsiveContainer>
                              <BarChart
                                data={[
                                  {
                                    metric: "Calories",
                                    average: avg.calories,
                                    target: caloriesTarget,
                                  },
                                ]}
                              >
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="metric" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar
                                  dataKey="average"
                                  name="Current avg (kcal)"
                                  fill={palette[0]}
                                  isAnimationActive={chartAnimationsEnabled}
                                />
                                <Bar
                                  dataKey="target"
                                  name="Target (kcal)"
                                  fill={palette[3]}
                                  isAnimationActive={chartAnimationsEnabled}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div style={{ fontSize: 14, opacity: 0.75 }}>
                            Set a calorie target in your profile to see it here.
                          </div>
                        )}
                      </IonCardContent>
                    </IonCard>

                    {/* Macro targets */}
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">
                          Macro targets
                          <IonChip color="secondary" style={{ marginLeft: 8 }}>
                            <IonIcon icon={analyticsOutline} />
                            &nbsp;Goals
                          </IonChip>
                        </IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Current averages vs targets
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        {macroTargets ? (
                          <div style={{ width: "100%", height: 260 }}>
                            <ResponsiveContainer>
                              <BarChart
                                data={[
                                  {
                                    metric: "Carbohydrates",
                                    average: Math.round(avg.carbs),
                                    target: macroTargets.carbsG,
                                  },
                                  {
                                    metric: "Protein",
                                    average: Math.round(avg.protein),
                                    target: macroTargets.proteinG,
                                  },
                                  {
                                    metric: "Fat",
                                    average: Math.round(avg.fat),
                                    target: macroTargets.fatG,
                                  },
                                ]}
                              >
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="metric" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar
                                  dataKey="average"
                                  name="Current avg (g)"
                                  fill={palette[0]}
                                  isAnimationActive={chartAnimationsEnabled}
                                />
                                <Bar
                                  dataKey="target"
                                  name="Target (g)"
                                  fill={palette[1]}
                                  isAnimationActive={chartAnimationsEnabled}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div style={{ fontSize: 14, opacity: 0.75 }}>
                            Set macro targets in your profile to see them here.
                          </div>
                        )}
                      </IonCardContent>
                    </IonCard>

                    {/* Best and lowest days */}
                    <IonGrid>
                      <IonRow>
                        <IonCol size="12" sizeMd="6">
                          <IonCard>
                            <IonCardHeader>
                              <IonCardTitle className="mp-card-title">
                                Highest intake
                                <IonChip color="warning" style={{ marginLeft: 8 }}>
                                  <IonIcon icon={medalOutline} />
                                  &nbsp;
                                  {bestDay
                                    ? Math.round(bestDay.roll.macros.calories)
                                    : "–"}{" "}
                                  kcal
                                </IonChip>
                              </IonCardTitle>
                              <IonCardSubtitle className="mp-card-subtitle">
                                {bestDay?.key || "—"}
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              {bestDay ? (
                                <ul style={{ margin: 0, paddingLeft: 16 }}>
                                  <li>
                                    Carbohydrates{" "}
                                    {bestDay.roll.macros.carbs.toFixed(0)} g
                                  </li>
                                  <li>
                                    Protein{" "}
                                    {bestDay.roll.macros.protein.toFixed(0)} g
                                  </li>
                                  <li>
                                    Fat {bestDay.roll.macros.fat.toFixed(0)} g
                                  </li>
                                </ul>
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
                                {lowDay?.key || "—"}
                              </IonCardSubtitle>
                            </IonCardHeader>
                            <IonCardContent>
                              {lowDay ? (
                                <ul style={{ margin: 0, paddingLeft: 16 }}>
                                  <li>
                                    Carbohydrates{" "}
                                    {lowDay.roll.macros.carbs.toFixed(0)} g
                                  </li>
                                  <li>
                                    Protein{" "}
                                    {lowDay.roll.macros.protein.toFixed(0)} g
                                  </li>
                                  <li>
                                    Fat {lowDay.roll.macros.fat.toFixed(0)} g
                                  </li>
                                </ul>
                              ) : (
                                "—"
                              )}
                            </IonCardContent>
                          </IonCard>
                        </IonCol>
                      </IonRow>
                    </IonGrid>

                    {/* Top foods table */}
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">
                          Top foods by calories
                        </IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Across the selected timeframe
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <div style={{ fontSize: 14 }}>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 120px 80px",
                              fontWeight: 700,
                              opacity: 0.8,
                            }}
                          >
                            <div>Food</div>
                            <div className="ion-text-right">Calories</div>
                            <div className="ion-text-right">Logs</div>
                          </div>
                          {topFoods.map((f, i) => (
                            <div
                              key={i}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 120px 80px",
                                padding: "6px 0",
                                borderBottom: "1px solid rgba(255,255,255,.08)",
                              }}
                            >
                              <div>
                                {f.name}
                                {f.brand ? ` · ${f.brand}` : ""}
                              </div>
                              <div className="ion-text-right">
                                {Math.round(f.calories)}
                              </div>
                              <div className="ion-text-right">{f.count}</div>
                            </div>
                          ))}
                        </div>
                      </IonCardContent>
                    </IonCard>

                    {/* Daily rollup list */}
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle className="mp-card-title">
                          Daily rollup
                        </IonCardTitle>
                        <IonCardSubtitle className="mp-card-subtitle">
                          Carbohydrates, protein, fat per day
                        </IonCardSubtitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <div
                          style={{
                            fontSize: 13,
                            lineHeight: 1.6,
                            opacity: 0.9,
                          }}
                        >
                          {nonEmptyDayTable.map((d) => (
                            <div
                              key={d.date}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "110px 1fr auto",
                                gap: 10,
                                alignItems: "center",
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{d.date}</div>
                              <div>
                                {d.calories} kcal · Carbohydrates{" "}
                                {d.carbs.toFixed(0)} g · Protein{" "}
                                {d.protein.toFixed(0)} g · Fat{" "}
                                {d.fat.toFixed(0)} g
                              </div>
                              <IonButton
                                size="small"
                                fill="outline"
                                onClick={() => viewDay(d.date)}
                              >
                                View day
                              </IonButton>
                            </div>
                          ))}
                        </div>
                      </IonCardContent>
                    </IonCard>
                  </>
                ) : (
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle className="mp-card-title">
                        Nutrition insights
                      </IonCardTitle>
                      <IonCardSubtitle className="mp-card-subtitle">
                        Log meals to unlock calorie and macro analytics.
                      </IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      Add some meals in Home to see calorie trends, macro splits,
                      and top foods here.
                    </IonCardContent>
                  </IonCard>
                )}
              </>
            ) : (
              <div
                style={{
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                <h2 style={{ margin: 0, fontSize: "2rem", fontWeight: 700 }}>
                  No analytics yet!
                </h2>
                <p
                  style={{
                    marginTop: "10px",
                    fontSize: "1.1rem",
                    opacity: 0.8,
                  }}
                >
                  Log some food to unlock your stats 🚀
                </p>
              </div>
            )}
          </>
        )}
      </IonContent>
      <IonActionSheet
        isOpen={exportMenuOpen}
        onDidDismiss={() => setExportMenuOpen(false)}
        header="Export summary"
        buttons={[
          {
            text: "PDF",
            handler: () => {
              void exportPDF();
            },
          },
          {
            text: "JSON",
            handler: () => {
              void exportJSON();
            },
          },
          {
            text: "CSV",
            handler: () => {
              void exportCSV();
            },
          },
          {
            text: "Cancel",
            role: "cancel",
          },
        ]}
      />
    </IonPage>
  );
};

export default Analytics;
