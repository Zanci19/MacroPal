import React from "react";
import {
  NUTRIENTS_BY_KEY,
  EXTENDED_KEYS,
  VITAMIN_KEYS,
  MINERAL_KEYS,
  percentDV,
  type NutrientMeta,
} from "../utils/nutrients";
import type { Nutrients } from "../types";
import "./NutrientBreakdown.css";

interface Props {
  /** Nutrient totals (or per-day averages) keyed by canonical nutrient key. */
  totals: Record<string, number>;
  /** Optional caption under the heading, e.g. "Daily average · 14 days". */
  subtitle?: string;
}

const round = (v: number, dp: number) => Number(v.toFixed(dp));

const NutrientBreakdown: React.FC<Props> = ({ totals, subtitle }) => {
  const present = (k: string) => typeof totals[k] === "number" && totals[k] > 0;

  const extended = EXTENDED_KEYS.filter((k) => present(k as string))
    .map((k) => NUTRIENTS_BY_KEY[k as string])
    .filter(Boolean) as NutrientMeta[];

  const micros = [...VITAMIN_KEYS, ...MINERAL_KEYS]
    .filter((k) => present(k as string))
    .map((k) => NUTRIENTS_BY_KEY[k as string])
    .filter(Boolean) as NutrientMeta[];

  if (!extended.length && !micros.length) {
    return (
      <div className="nb">
        <p className="nb__empty">
          Log foods with detailed nutrition to see fiber, sugar, vitamins and minerals here.
        </p>
      </div>
    );
  }

  return (
    <div className="nb">
      {subtitle && <div className="nb__subtitle">{subtitle}</div>}

      {extended.length > 0 && (
        <>
          <div className="nb__section">Extended macros</div>
          <div className="nb__grid">
            {extended.map((m) => (
              <div className="nb__cell" key={m.key}>
                <div className="nb__v">
                  {round(totals[m.key as string], m.decimals)}
                  <small>{m.unit}</small>
                </div>
                <div className="nb__k">{m.short}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {micros.length > 0 && (
        <>
          <div className="nb__section">Vitamins &amp; minerals</div>
          <div className="nb__rows">
            {micros.map((m) => {
              const value = totals[m.key as string];
              const dv = percentDV(m.key as keyof Nutrients, value);
              const w = dv == null ? 0 : Math.min(100, dv);
              return (
                <div className="nb__row" key={m.key}>
                  <span className="nb__label">{m.label}</span>
                  <span className="nb__track"><i style={{ width: `${w}%` }} /></span>
                  <span className="nb__amt">
                    {round(value, m.decimals)}
                    {m.unit}
                  </span>
                  <span className="nb__dv">{dv == null ? "—" : `${dv}%`}</span>
                </div>
              );
            })}
          </div>
          <p className="nb__note">% of daily value</p>
        </>
      )}
    </div>
  );
};

export default React.memo(NutrientBreakdown);
