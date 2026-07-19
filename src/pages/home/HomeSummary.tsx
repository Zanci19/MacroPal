import React from "react";
import { IonButton, IonSpinner } from "@ionic/react";
import {
  NUTRIENTS_BY_KEY,
  EXTENDED_KEYS,
  VITAMIN_KEYS,
  MINERAL_KEYS,
  percentDV,
  type NutrientMeta,
} from "../../utils/nutrients";
import type { Nutrients } from "../../types";
import { useHomeLayout } from "../../hooks/useHomeLayout";
import "./HomeSummary.css";

export interface HomeSummaryProps {
  loading: boolean;
  isToday: boolean;
  progress: number;
  ringColor: string;
  kcalConsumed: number;
  kcalGoal: number;
  workoutCalories: number;
  summaryDifferenceLabel: string;
  summaryDifferenceValue: number;
  macroTargets: { proteinG: number; carbsG: number; fatG: number } | null;
  dayMacros: { protein: number; carbs: number; fat: number };
  nutritionTotals: Record<string, number>;
  showAchievements: boolean;
  streak: number;
  onCopySummary: () => void;
  onLogWeighIn: () => void;
}

type MacroDatum = { key: "protein" | "carbs" | "fat"; label: string; value: number; target: number };

const MACRO_VARS: Record<string, string> = {
  protein: "var(--mp-color-protein)",
  carbs: "var(--mp-color-carbs)",
  fat: "var(--mp-color-fat)",
};

/* ----- small shared pieces ----- */

const Ring: React.FC<{ size: number; stroke: number; progress: number; color: string; children: React.ReactNode }>
  = ({ size, stroke, progress, color, children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress || 0));
  return (
    <div className="hs-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Track uses --mp-border-strong, not --mp-surface-sunken: the sunken
            token is #eef1f7 on a white card (invisible) and, in dark mode,
            darker than the card itself (reads as a hole). border-strong stays
            visible against the card in both themes, so a low fill reads as a
            small arc on a ring rather than a blob floating in a void. */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mp-border-strong)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .5s var(--mp-ease-out)" }}
        />
      </svg>
      <div className="hs-ring__center">{children}</div>
    </div>
  );
};

const MacroBars: React.FC<{ macros: MacroDatum[] }> = ({ macros }) => (
  <div className="hs-macros">
    {macros.map((m) => {
      const pct = m.target ? Math.min(1, m.value / m.target) : 0;
      const over = m.key !== "protein" && !!m.target && m.value > m.target;
      return (
        <div className="hs-macro" key={m.key} style={{ ["--c" as string]: MACRO_VARS[m.key] }}>
          <div className="hs-macro__row">
            <span className="hs-macro__name">{m.label}</span>
            <span className={`hs-macro__val${over ? " is-over" : ""}`}>
              <strong>{Math.round(m.value)}</strong> / {m.target} g
            </span>
          </div>
          <div className="hs-track"><i style={{ width: `${pct * 100}%` }} /></div>
        </div>
      );
    })}
  </div>
);

/** Extended macros (fiber/sugar/sat fat/sodium) as a compact 4-up grid. */
const ExtendedGrid: React.FC<{ totals: Record<string, number> }> = ({ totals }) => {
  const cells = EXTENDED_KEYS
    .map((k) => ({ meta: NUTRIENTS_BY_KEY[k as string], value: totals[k as string] }))
    .filter((c) => c.meta && typeof c.value === "number");
  if (!cells.length) return null;
  return (
    <div className="hs-mini">
      {cells.slice(0, 4).map(({ meta, value }) => (
        <div className="hs-mini__cell" key={meta.key}>
          <div className="hs-mini__v">
            {Math.round((value as number) * 10) / 10}
            <small>{meta.unit}</small>
          </div>
          <div className="hs-mini__k">{meta.short}</div>
        </div>
      ))}
    </div>
  );
};

/** Collapsible micronutrient detail (vitamins + minerals, %DV). */
const MicroDetail: React.FC<{ totals: Record<string, number> }> = ({ totals }) => {
  const [open, setOpen] = React.useState(false);
  const rows = [...VITAMIN_KEYS, ...MINERAL_KEYS]
    .map((k) => NUTRIENTS_BY_KEY[k as string])
    .filter((meta): meta is NutrientMeta => !!meta && typeof totals[meta.key as string] === "number");
  if (!rows.length) return null;
  return (
    <div className="hs-micro">
      <button className="hs-micro__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>Micronutrients</span>
        <span className="hs-micro__chev" data-open={open}>›</span>
      </button>
      {open && (
        <div className="hs-micro__list">
          {rows.map((meta) => {
            const value = totals[meta.key as string];
            const dv = percentDV(meta.key as keyof Nutrients, value);
            const w = dv == null ? 0 : Math.min(100, dv);
            return (
              <div className="hs-micro__row" key={meta.key}>
                <span className="hs-micro__k">{meta.label}</span>
                <span className="hs-micro__track"><i style={{ width: `${w}%` }} /></span>
                <span className="hs-micro__p">{dv == null ? "—" : `${dv}%`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const HomeSummary: React.FC<HomeSummaryProps> = (props) => {
  const layout = useHomeLayout();
  const {
    loading, isToday, progress, ringColor, kcalConsumed, kcalGoal, workoutCalories,
    summaryDifferenceLabel, summaryDifferenceValue, macroTargets, dayMacros,
    nutritionTotals, showAchievements, streak, onCopySummary, onLogWeighIn,
  } = props;

  if (loading) {
    return (
      <div className="hs-card hs-loading">
        <IonSpinner name="dots" />
      </div>
    );
  }

  const macros: MacroDatum[] = macroTargets
    ? [
        { key: "protein", label: "Protein", value: dayMacros.protein, target: macroTargets.proteinG },
        { key: "carbs", label: "Carbs", value: dayMacros.carbs, target: macroTargets.carbsG },
        { key: "fat", label: "Fat", value: dayMacros.fat, target: macroTargets.fatG },
      ]
    : [];

  // calorie split (kcal) for the bold layout's stacked bar
  const cCarb = dayMacros.carbs * 4;
  const cFat = dayMacros.fat * 9;
  const cProt = dayMacros.protein * 4;
  const cTot = cCarb + cFat + cProt || 1;

  const actions = (
    <div className="hs-actions">
      <IonButton fill="outline" size="small" onClick={onCopySummary}>Copy summary</IonButton>
      <IonButton size="small" onClick={onLogWeighIn}>Log weigh-in</IonButton>
    </div>
  );

  /* ---------------- BOLD (default) ---------------- */
  if (layout === "bold") {
    return (
      <div className="hs-card hs-bold">
        <div className="hs-bold__cap">{isToday ? "Today" : "Calories"}</div>
        <div className="hs-bold__big">
          {kcalConsumed.toLocaleString()}<span> / {kcalGoal.toLocaleString()} kcal</span>
        </div>
        <div className="hs-bold__bar" role="img" aria-label="Calorie split by macro">
          <i style={{ width: `${(cCarb / cTot) * 100}%`, background: "var(--mp-color-carbs)" }} />
          <i style={{ width: `${(cProt / cTot) * 100}%`, background: "var(--mp-color-protein)" }} />
          <i style={{ width: `${(cFat / cTot) * 100}%`, background: "var(--mp-color-fat)" }} />
        </div>
        <div className="hs-bold__meta">
          <span>{summaryDifferenceLabel}: <strong>{summaryDifferenceValue.toLocaleString()}</strong> kcal</span>
          {workoutCalories > 0 && <span>Exercise +{workoutCalories}</span>}
          {showAchievements && streak > 0 && <span>🔥 {streak}-day streak</span>}
        </div>
        {macros.length > 0 && <MacroBars macros={macros} />}
        <ExtendedGrid totals={nutritionTotals} />
        <MicroDetail totals={nutritionTotals} />
        {actions}
      </div>
    );
  }

  /* ---------------- FRIENDLY ---------------- */
  if (layout === "friendly") {
    return (
      <div className="hs-card hs-friendly">
        <div className="hs-friendly__hi">
          {isToday ? "You're doing great today" : "Daily overview"}
        </div>
        <div className="hs-friendly__sub">
          {isToday
            ? `${summaryDifferenceValue.toLocaleString()} kcal ${summaryDifferenceLabel.toLowerCase()}`
            : `${summaryDifferenceLabel}: ${summaryDifferenceValue.toLocaleString()} kcal`}
          {showAchievements && streak > 0 ? ` · 🔥 ${streak}` : ""}
        </div>
        <div className="hs-friendly__ring">
          <Ring size={150} stroke={14} progress={progress} color={ringColor}>
            <span className="hs-ring__num">{kcalConsumed.toLocaleString()}</span>
            <span className="hs-ring__lbl">of {kcalGoal.toLocaleString()}</span>
          </Ring>
        </div>
        {macros.length > 0 && (
          <div className="hs-chips">
            {macros.map((m) => (
              <div className="hs-chip" key={m.key} style={{ ["--c" as string]: MACRO_VARS[m.key] }}>
                <span className="hs-chip__dot" />
                <span className="hs-chip__k">{m.label}</span>
                <span className="hs-chip__v">{Math.round(m.value)}<small> / {m.target}g</small></span>
              </div>
            ))}
          </div>
        )}
        <ExtendedGrid totals={nutritionTotals} />
        <MicroDetail totals={nutritionTotals} />
        {actions}
      </div>
    );
  }

  /* ---------------- DATA-FIRST ---------------- */
  return (
    <div className="hs-card hs-data">
      <div className="hs-data__top">
        <Ring size={112} stroke={12} progress={progress} color={ringColor}>
          <span className="hs-ring__num">{summaryDifferenceValue.toLocaleString()}</span>
          <span className="hs-ring__lbl">{summaryDifferenceLabel}</span>
        </Ring>
        <div className="hs-data__side">
          <div className="hs-data__cal">
            <b>{kcalConsumed.toLocaleString()}</b> <span>/ {kcalGoal.toLocaleString()} kcal</span>
          </div>
          {macros.length > 0 && <MacroBars macros={macros} />}
        </div>
      </div>
      <ExtendedGrid totals={nutritionTotals} />
      <MicroDetail totals={nutritionTotals} />
      {actions}
    </div>
  );
};

export default React.memo(HomeSummary);
