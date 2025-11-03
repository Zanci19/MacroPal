// src/pages/left/Left.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonSegment, IonSegmentButton, IonLabel, IonSpinner, IonButton, IonIcon, IonSelect, IonSelectOption, IonChip
} from "@ionic/react";
import {
  downloadOutline, barChartOutline, pieChartOutline, trendingUpOutline,
  analyticsOutline, medalOutline
} from "ionicons/icons";

import { auth, db } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";

// Recharts
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";

import ProgressRing from "../../components/ProgressRing";

/* ============================
   Types
   ============================ */
type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
type Macros = { calories: number; carbs: number; protein: number; fat: number };
type DiaryEntry = {
  fdcId?: number;
  code?: string;
  name: string;
  brand?: string | null;
  base?: { amount: number; unit: string; label: string };
  total: Macros & Record<string, any>;
  addedAt: string;
  [k: string]: any;
};
type DayDoc = Partial<Record<MealKey, DiaryEntry[]>>;
type Profile = {
  age: number;
  weight: number;
  height: number;
  gender: "male" | "female";
  goal: "lose" | "maintain" | "gain";
  activity: "sedentary" | "light" | "moderate" | "very" | "extra";
};

type TF = "7d" | "30d" | "60d";

/* ============================
   Helpers
   ============================ */
const MEALS: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];

const fmtDate = (iso: string) => iso.slice(5); // MM-DD
const dayKey = (d: Date) => d.toISOString().split("T")[0];
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function sumDay(doc: DayDoc) {
  const all = MEALS.flatMap((m) => doc[m] || []);
  const macros = all.reduce((a, it) => ({
    calories: a.calories + (it.total?.calories || 0),
    carbs: a.carbs + (it.total?.carbs || 0),
    protein: a.protein + (it.total?.protein || 0),
    fat: a.fat + (it.total?.fat || 0),
  }), { calories: 0, carbs: 0, protein: 0, fat: 0 } as Macros);

  const byMeal = MEALS.reduce((acc, m) => {
    const arr = (doc[m] || []);
    acc[m] = arr.reduce((a, it) => ({
      calories: a.calories + (it.total?.calories || 0),
      carbs: a.carbs + (it.total?.carbs || 0),
      protein: a.protein + (it.total?.protein || 0),
      fat: a.fat + (it.total?.fat || 0),
    }), { calories: 0, carbs: 0, protein: 0, fat: 0 } as Macros);
    return acc;
  }, {} as Record<MealKey, Macros>);

  return { macros, byMeal, items: all };
}

function collectMicroKeys(items: DiaryEntry[]) {
  const keys = new Set<string>();
  items.forEach((it) => {
    const t = it.total || {};
    Object.entries(t).forEach(([k, v]) => {
      if (["calories", "carbs", "protein", "fat"].includes(k)) return;
      if (typeof v === "number" && isFinite(v)) keys.add(k);
    });
  });
  return [...keys];
}

/* ============================
   Component
   ============================ */
const Left: React.FC = () => {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [tf, setTf] = useState<TF>("30d");
  const [days, setDays] = useState<{ key: string; data: DayDoc; roll: ReturnType<typeof sumDay> }[]>([]);

  const [microKey, setMicroKey] = useState<string | undefined>(undefined);
  const [weightEntries, setWeightEntries] = useState<{ date: string; weight: number }[]>([]);

  // Fetch last 60 days
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      setUid(user.uid);

      const p = await getDoc(doc(db, "users", user.uid));
      if (p.exists()) setProfile(p.data() as Profile);

      const today = new Date();
      const keys = Array.from({ length: 60 }, (_, i) => dayKey(addDays(today, -i)));
      const reads = keys.map((k) => getDoc(doc(db, "users", user.uid, "foods", k)));

      const weightQuery = query(
        collection(db, "users", user.uid, "weights"),
        orderBy("date", "asc")
      );

      const [snaps, weightSnap] = await Promise.all([
        Promise.all(reads),
        getDocs(weightQuery).catch(() => null),
      ]);

      // oldest first
      const list = snaps
        .map((s, i) => ({ key: keys[i], data: (s.data() || {}) as DayDoc }))
        .reverse()
        .map((d) => ({ ...d, roll: sumDay(d.data) }));

      setDays(list);

      if (weightSnap) {
        const weights = weightSnap.docs
          .map((d) => {
            const data = d.data() as { date?: string; weight?: number; value?: number };
            const date = data?.date || d.id;
            const raw = data?.weight ?? data?.value;
            const weight = typeof raw === "number" ? raw : Number(raw);
            if (!date || !isFinite(weight)) return null;
            return { date, weight: Number(weight.toFixed(1)) };
          })
          .filter((x): x is { date: string; weight: number } => !!x);
        setWeightEntries(weights);
      } else {
        setWeightEntries([]);
      }

      setLoading(false);
    });
    return () => unsub();
  }, []);

  // timeframe slice
  const view = useMemo(() => {
    if (days.length === 0) return [];
    if (tf === "7d") return days.slice(-7);
    if (tf === "30d") return days.slice(-30);
    return days.slice(-60);
  }, [days, tf]);

  const macroEnergyByDay = useMemo(() => view.map((d) => ({
    date: fmtDate(d.key),
    carbsK: d.roll.macros.carbs * 4,
    proteinK: d.roll.macros.protein * 4,
    fatK: d.roll.macros.fat * 9,
  })), [view]);

  const dayTable = useMemo(() => view.map((d) => ({
    date: d.key,
    calories: Math.round(d.roll.macros.calories),
    carbs: +d.roll.macros.carbs.toFixed(1),
    protein: +d.roll.macros.protein.toFixed(1),
    fat: +d.roll.macros.fat.toFixed(1),
  })), [view]);

  // macro totals and averages
  const totals = useMemo(() => dayTable.reduce((a, x) => ({
    calories: a.calories + x.calories,
    carbs: a.carbs + x.carbs,
    protein: a.protein + x.protein,
    fat: a.fat + x.fat,
  }), { calories: 0, carbs: 0, protein: 0, fat: 0 } as Macros), [dayTable]);

  const avg = useMemo(() => {
    const n = Math.max(1, dayTable.length);
    return {
      calories: Math.round(totals.calories / n),
      carbs: +(totals.carbs / n).toFixed(1),
      protein: +(totals.protein / n).toFixed(1),
      fat: +(totals.fat / n).toFixed(1),
    };
  }, [totals, dayTable.length]);

  const calorieGoal = useMemo(() => {
    if (!profile) return null;
    const { age, weight, height, gender, goal, activity } = profile;
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
    return Math.max(800, Math.round(daily));
  }, [profile]);

  const todayTotals = useMemo(() => {
    const key = dayKey(new Date());
    const found = days.find((d) => d.key === key);
    return found?.roll.macros ?? { calories: 0, carbs: 0, protein: 0, fat: 0 };
  }, [days]);

  const todayCalories = Math.round(todayTotals.calories);
  const caloriesRemaining = calorieGoal != null ? Math.max(0, calorieGoal - todayCalories) : null;
  const calorieProgress = calorieGoal ? Math.min(1, todayCalories / calorieGoal) : 0;
  const calorieColor =
    calorieProgress <= 0.9
      ? "var(--ion-color-success)"
      : calorieProgress <= 1.1
      ? "var(--ion-color-warning)"
      : "var(--ion-color-danger)";

  const todayMacroSummary = useMemo(
    () => ({
      carbs: +todayTotals.carbs.toFixed(1),
      protein: +todayTotals.protein.toFixed(1),
      fat: +todayTotals.fat.toFixed(1),
    }),
    [todayTotals]
  );

  const todayTargets = useMemo(() => {
    if (!profile || !calorieGoal) return null;
    const proteinG = Math.round(1.8 * profile.weight);
    const fatG = Math.max(45, Math.round(0.8 * profile.weight));
    const proteinK = proteinG * 4;
    const fatK = fatG * 9;
    const carbsG = Math.round(Math.max(0, calorieGoal - proteinK - fatK) / 4);
    return { proteinG, fatG, carbsG };
  }, [profile, calorieGoal]);

  const weightChartData = useMemo(
    () =>
      weightEntries.map((entry) => ({
        date: fmtDate(entry.date),
        weight: entry.weight,
      })),
    [weightEntries]
  );

  const latestWeight = weightEntries.length ? weightEntries[weightEntries.length - 1] : null;

  // macro donut data
  const macroDonut = useMemo(() => ([
    { name: "Carbohydrates", value: totals.carbs * 4 },
    { name: "Protein", value: totals.protein * 4 },
    { name: "Fat", value: totals.fat * 9 },
  ]), [totals]);

  // per-meal energy share
  const mealShare = useMemo(() => {
    const acc = { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 } as Record<MealKey, number>;
    view.forEach(d => MEALS.forEach(m => acc[m] += d.roll.byMeal[m].calories));
    return acc;
  }, [view]);

  // best/worst days
  const bestDay = useMemo(() => view.length ? [...view].sort((a,b)=>b.roll.macros.calories-a.roll.macros.calories)[0] : null, [view]);
  const lowDay  = useMemo(() => view.length ? [...view].sort((a,b)=>a.roll.macros.calories-b.roll.macros.calories)[0] : null, [view]);

  // micronutrient keys and series
  const microKeys = useMemo(() => collectMicroKeys(view.flatMap(d => d.roll.items)), [view]);
  useEffect(() => {
    if (!microKey && microKeys.length) setMicroKey(microKeys[0]);
  }, [microKeys, microKey]);

  const microSeries = useMemo(() => {
    if (!microKey) return [];
    return view.map(d => {
      const sum = d.roll.items.reduce((s, it) => s + (typeof it.total?.[microKey] === "number" ? it.total[microKey] : 0), 0);
      return { date: fmtDate(d.key), value: +(sum.toFixed(1)) };
    });
  }, [view, microKey]);

  // top foods by calories
  const topFoods = useMemo(() => {
    const map = new Map<string, { name: string; brand?: string; calories: number; count: number }>();
    view.forEach(d => d.roll.items.forEach(it => {
      const key = `${(it.name || "").toLowerCase()}|${(it.brand || "").toLowerCase()}`;
      const prev = map.get(key) || { name: it.name, brand: it.brand || undefined, calories: 0, count: 0 };
      prev.calories += (it.total?.calories || 0);
      prev.count += 1;
      map.set(key, prev);
    }));
    return [...map.values()].sort((a,b) => b.calories - a.calories).slice(0, 10);
  }, [view]);

  // export
  const exportCSV = () => {
    const rows = [
      ["date","calories","carbohydrates_g","protein_g","fat_g"].join(","),
      ...dayTable.map(r => [r.date, r.calories, r.carbs, r.protein, r.fat].join(","))
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `macropal_${tf}_summary.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const payload = { timeframe: tf, days: dayTable, totals, avg };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `macropal_${tf}_summary.json`; a.click(); URL.revokeObjectURL(url);
  };

  const palette = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#64748b"];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Insights & Analytics</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {loading && (
          <div className="ion-text-center" style={{ padding: 24 }}>
            <IonSpinner name="dots" />
          </div>
        )}

        {!loading && (
          <>
            {/* Controls */}
            <IonGrid>
              <IonRow className="ion-align-items-center">
                <IonCol size="7">
                  <IonSegment value={tf} onIonChange={(e) => setTf((e.detail.value as TF) ?? "30d")}>
                    <IonSegmentButton value="7d"><IonLabel>7 days</IonLabel></IonSegmentButton>
                    <IonSegmentButton value="30d"><IonLabel>30 days</IonLabel></IonSegmentButton>
                    <IonSegmentButton value="60d"><IonLabel>60 days</IonLabel></IonSegmentButton>
                  </IonSegment>
                </IonCol>
                <IonCol size="5" className="ion-text-right">
                  <IonButton fill="outline" onClick={exportCSV} style={{ marginRight: 8 }}>
                    <IonIcon icon={downloadOutline} slot="start" /> CSV
                  </IonButton>
                  <IonButton fill="outline" onClick={exportJSON}>
                    <IonIcon icon={downloadOutline} slot="start" /> JSON
                  </IonButton>
                </IonCol>
              </IonRow>
            </IonGrid>

            {/* Overview cards */}
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>
                        Average day
                        <IonChip color="success" style={{ marginLeft: 8 }}>
                          <IonIcon icon={trendingUpOutline} />&nbsp;{avg.calories} kcal
                        </IonChip>
                      </IonCardTitle>
                      <IonCardSubtitle>Across the selected range</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div>Carbohydrates {avg.carbs.toFixed(0)} g</div>
                      <div>Protein {avg.protein.toFixed(0)} g</div>
                      <div>Fat {avg.fat.toFixed(0)} g</div>
                    </IonCardContent>
                  </IonCard>
                </IonCol>

                <IonCol size="6">
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>Calories by meal</IonCardTitle>
                      <IonCardSubtitle>Aggregate share</IonCardSubtitle>
                    </IonCardHeader>
                      <IonCardContent>
                        <div style={{ width: "100%", height: 260 }}>
                          <ResponsiveContainer>
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
                                innerRadius={58}
                                outerRadius={96}
                                paddingAngle={2}
                                cx="50%"
                                cy="50%"
                              >
                                {["Breakfast","Lunch","Dinner","Snacks"].map((_, i) => (
                                  <Cell key={i} fill={palette[i % palette.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              {/* Legend removed */}
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

  {/* Custom legend below chart */}
  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 8, fontSize: 12 }}>
    {[
      { label: "Breakfast", color: palette[0] },
      { label: "Lunch", color: palette[1] },
      { label: "Dinner", color: palette[2] },
      { label: "Snacks", color: palette[3] },
    ].map((it) => (
      <div key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: it.color }} />
        <span>{it.label}</span>
      </div>
    ))}
  </div>
</IonCardContent>


                  </IonCard>
                </IonCol>
              </IonRow>
            </IonGrid>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>
                  Weight check-ins
                  {latestWeight && (
                    <IonChip color="secondary" style={{ marginLeft: 8 }}>
                      <IonIcon icon={analyticsOutline} />&nbsp;{latestWeight.weight.toFixed(1)} kg
                    </IonChip>
                  )}
                </IonCardTitle>
                <IonCardSubtitle>Tracked entries from the past 60 days</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent>
                {weightChartData.length === 0 ? (
                  <div className="ion-text-center" style={{ padding: 24, opacity: 0.7 }}>
                    No weight entries found yet.
                  </div>
                ) : (
                  <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={weightChartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="date" />
                        <YAxis unit=" kg" />
                        <Tooltip />
                        <Line type="monotone" dataKey="weight" stroke={palette[4]} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>
                  Today's calories
                  <IonChip color="medium" style={{ marginLeft: 8 }}>
                    Goal vs intake
                  </IonChip>
                </IonCardTitle>
                <IonCardSubtitle>Live progress for the current day</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent>
                {!profile || calorieGoal == null ? (
                  <div className="ion-text-center" style={{ padding: 24 }}><IonSpinner name="dots" /></div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
                    <div style={{ color: calorieColor }}><ProgressRing size={96} stroke={10} progress={calorieProgress} /></div>
                    <div style={{ flex: "1 1 220px", display: "grid", gap: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Goal</span><strong>{calorieGoal} kcal</strong></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Consumed</span><strong>{todayCalories} kcal</strong></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Remaining</span><strong>{caloriesRemaining != null ? `${caloriesRemaining} kcal` : "—"}</strong></div>
                      {todayTargets && (
                        <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Carbohydrates</span><span>{todayMacroSummary.carbs.toFixed(0)} / {todayTargets.carbsG} g</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Protein</span><span>{todayMacroSummary.protein.toFixed(0)} / {todayTargets.proteinG} g</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fat</span><span>{todayMacroSummary.fat.toFixed(0)} / {todayTargets.fatG} g</span></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </IonCardContent>
            </IonCard>

            {/* Macro energy stacked bars */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>
                  Macro energy split
                  <IonChip color="tertiary" style={{ marginLeft: 8 }}>
                    <IonIcon icon={barChartOutline} />&nbsp;kcal by day
                  </IonChip>
                </IonCardTitle>
                <IonCardSubtitle>Carbohydrates, protein, fat as kcal</IonCardSubtitle>
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
                      <Bar dataKey="carbsK" stackId="a" name="Carbohydrates kcal" fill={palette[0]} />
                      <Bar dataKey="proteinK" stackId="a" name="Protein kcal" fill={palette[1]} />
                      <Bar dataKey="fatK" stackId="a" name="Fat kcal" fill={palette[2]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </IonCardContent>
            </IonCard>

            {/* Macro ratio donut and radar vs averages */}
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>
                        Macro energy ratio
                        <IonChip color="primary" style={{ marginLeft: 8 }}>
                          <IonIcon icon={pieChartOutline} />&nbsp;Total mix
                        </IonChip>
                      </IonCardTitle>
                      <IonCardSubtitle>Share of kcal from macros</IonCardSubtitle>
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
                            >
                              {macroDonut.map((_, i) => (
                                <Cell key={i} fill={palette[i % palette.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            {/* Legend removed */}
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Custom legend below chart */}
                      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 8, fontSize: 12 }}>
                        {[
                          { label: "Carbohydrates", color: palette[0] },
                          { label: "Protein", color: palette[1] },
                          { label: "Fat", color: palette[2] },
                        ].map((it) => (
                          <div key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: it.color }} />
                            <span>{it.label}</span>
                          </div>
                        ))}
                      </div>
                    </IonCardContent>


                  </IonCard>
                </IonCol>

                <IonCol size="6">
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>
                        Macro grams vs average
                        <IonChip color="success" style={{ marginLeft: 8 }}>
                          <IonIcon icon={analyticsOutline} />&nbsp;Radar
                        </IonChip>
                      </IonCardTitle>
                      <IonCardSubtitle>Average daily grams across timeframe</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div style={{ width: "100%", height: 260 }}>
                        <ResponsiveContainer>
                          <RadarChart data={[
                            { metric: "Carbohydrates", g: avg.carbs },
                            { metric: "Protein", g: avg.protein },
                            { metric: "Fat", g: avg.fat },
                          ]}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="metric" />
                            <PolarRadiusAxis />
                            <Radar name="Avg g" dataKey="g" stroke={palette[0]} fill={palette[0]} fillOpacity={0.35} />
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

            {/* Micronutrient trend */}
            {microKeys.length > 0 && (
              <IonCard>
                <IonCardHeader>
                  <IonCardTitle>
                    Micronutrient trend
                    <IonChip color="medium" style={{ marginLeft: 8 }}>
                      <IonIcon icon={analyticsOutline} />&nbsp;{microKey}
                    </IonChip>
                  </IonCardTitle>
                  <IonCardSubtitle>Auto-detected numeric fields in your entries</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonGrid>
                    <IonRow className="ion-align-items-center">
                      <IonCol size="12" sizeMd="4">
                        <IonSelect value={microKey} onIonChange={(e) => setMicroKey(e.detail.value as string)} interface="popover">
                          {microKeys.map((k) => <IonSelectOption key={k} value={k}>{k}</IonSelectOption>)}
                        </IonSelect>
                      </IonCol>
                    </IonRow>
                  </IonGrid>
                  <div style={{ width: "100%", height: 240 }}>
                    <ResponsiveContainer>
                      <LineChart data={microSeries}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="value" name={microKey} stroke={palette[3]} dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            {/* Best and lowest days */}
            <IonGrid>
              <IonRow>
                <IonCol size="6">
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>
                        Highest intake
                        <IonChip color="warning" style={{ marginLeft: 8 }}>
                          <IonIcon icon={medalOutline} />&nbsp;{bestDay ? Math.round(bestDay.roll.macros.calories) : "–"} kcal
                        </IonChip>
                      </IonCardTitle>
                      <IonCardSubtitle>{bestDay?.key || "—"}</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {bestDay ? (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          <li>Carbohydrates {bestDay.roll.macros.carbs.toFixed(0)} g</li>
                          <li>Protein {bestDay.roll.macros.protein.toFixed(0)} g</li>
                          <li>Fat {bestDay.roll.macros.fat.toFixed(0)} g</li>
                        </ul>
                      ) : "—"}
                    </IonCardContent>
                  </IonCard>
                </IonCol>
                <IonCol size="6">
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>Lowest intake</IonCardTitle>
                      <IonCardSubtitle>{lowDay?.key || "—"}</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {lowDay ? (
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          <li>Carbohydrates {lowDay.roll.macros.carbs.toFixed(0)} g</li>
                          <li>Protein {lowDay.roll.macros.protein.toFixed(0)} g</li>
                          <li>Fat {lowDay.roll.macros.fat.toFixed(0)} g</li>
                        </ul>
                      ) : "—"}
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              </IonRow>
            </IonGrid>

            {/* Top foods table */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Top foods by calories</IonCardTitle>
                <IonCardSubtitle>Across the selected timeframe</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ fontSize: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px", fontWeight: 700, opacity: 0.8 }}>
                    <div>Food</div><div className="ion-text-right">Calories</div><div className="ion-text-right">Logs</div>
                  </div>
                  {topFoods.map((f, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                      <div>{f.name}{f.brand ? ` · ${f.brand}` : ""}</div>
                      <div className="ion-text-right">{Math.round(f.calories)}</div>
                      <div className="ion-text-right">{f.count}</div>
                    </div>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>

            {/* Daily rollup list */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Daily rollup</IonCardTitle>
                <IonCardSubtitle>Carbohydrates, protein, fat per day</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>
                  {dayTable.map((d) => (
                    <div key={d.date} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10 }}>
                      <div style={{ fontWeight: 700 }}>{d.date}</div>
                      <div>
                        {d.calories} kcal · Carbohydrates {d.carbs.toFixed(0)} g · Protein {d.protein.toFixed(0)} g · Fat {d.fat.toFixed(0)} g
                      </div>
                    </div>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Left;
